// Client hors ligne : assemble cache de lecture, file d'actions et etat reseau.
// Aucune dependance au navigateur : tout est injecte (testable sous node).

import { isCacheable, type ReadCache } from './cache'
import { classify } from './eligibility'
import type { Network, NetState } from './net'
import { drain, enqueue, createQueueStore, type QueueItem } from './queue'

export type FlushNote = { at: number; done: number; rejected: number; expired: number }

export type OfflineSnapshot = {
  net: NetState
  pending: number
  /** horodatage de la plus ancienne donnee servie depuis le cache, null si aucune */
  staleSince: number | null
  lastFlush: FlushNote | null
}

export type QueuedAck = { success: true; queued: true; offline: true }

export type ClientDeps = {
  cache: ReadCache
  queueStore: ReturnType<typeof createQueueStore>
  net: Network
  now: () => number
  enabled: boolean
  getTimeoutMs?: number
}

export type Configure = {
  /** rejoue une action en attente ; rend le code HTTP, LEVE si le reseau echoue */
  send: (item: QueueItem) => Promise<number>
  makeError: (status: number, message: string) => Error
}

const TIMEOUT = new Error('delai depasse')
TIMEOUT.name = 'TimeoutError'

/** Echec de transport (pas une reponse HTTP) : fetch leve TypeError, ou delai/abandon. */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true
  const n = (e as { name?: string } | null)?.name
  return n === 'TimeoutError' || n === 'AbortError'
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(TIMEOUT), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

export function createOfflineClient(d: ClientDeps) {
  let cfg: Configure | null = null
  let items: QueueItem[] = d.enabled ? d.queueStore.load() : []
  const stale = new Map<string, number>()
  let lastFlush: FlushNote | null = null
  let inflight: Promise<void> | null = null
  let seq = 0
  const subs = new Set<() => void>()

  const build = (): OfflineSnapshot => ({
    net: d.net.state(),
    pending: items.length,
    staleSince: stale.size ? Math.min(...stale.values()) : null,
    lastFlush,
  })
  let snap = build()
  function emit(): void {
    snap = build()
    subs.forEach((f) => f())
  }

  function markStale(path: string, savedAt: number): void {
    if (stale.get(path) === savedAt) return
    stale.set(path, savedAt)
    emit()
  }

  function persist(next: QueueItem[]): void {
    items = next
    d.queueStore.save(items)
  }

  function fail(status: number, msg: string): Error {
    return cfg ? cfg.makeError(status, msg) : new Error(msg)
  }

  function flush(): Promise<void> {
    if (inflight) return inflight
    if (!d.enabled || !cfg || items.length === 0) return Promise.resolve()
    inflight = doFlush(cfg.send).finally(() => { inflight = null })
    return inflight
  }

  async function doFlush(send: Configure['send']): Promise<void> {
    const before = items
    const ids = new Set(before.map((i) => i.id))
    const rep = await drain(before, send, d.now())
    const addedMeanwhile = items.filter((i) => !ids.has(i.id))
    persist([...rep.remaining, ...addedMeanwhile])
    if (rep.done + rep.rejected.length + rep.expired.length > 0) {
      lastFlush = { at: d.now(), done: rep.done, rejected: rep.rejected.length, expired: rep.expired.length }
    }
    if (rep.remaining.length > 0) void d.net.probeNow() // arret sur erreur : on verifie l'etat
    emit()
  }

  if (d.enabled) {
    let prev = d.net.state()
    d.net.subscribe(() => {
      const cur = d.net.state()
      if (cur === 'online' && prev !== 'online') {
        stale.clear() // les ecrans qui sondent vont recharger du frais
        void flush()
      }
      prev = cur
      emit()
    })
  }

  function decide<T>(method: string, path: string, body: unknown, extra?: Record<string, string>): T {
    const v = classify(method, path, body, extra)
    if (v.kind === 'refuse') throw fail(0, `hors ligne : ${v.reason}`)
    const m = method.toUpperCase() as 'PUT' | 'POST'
    const res = enqueue(items, { method: m, path, body, key: v.key }, d.now(), `${d.now()}-${++seq}`)
    persist(res.items)
    emit()
    return { success: true, queued: true, offline: true } satisfies QueuedAck as unknown as T
  }

  return {
    getSnapshot: (): OfflineSnapshot => snap,
    subscribe(fn: () => void): () => void {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    configure(c: Configure): void {
      cfg = c
      if (d.net.state() === 'online') void flush()
    },
    flush,

    /** GET reseau-d'abord ; repli sur le cache SEULEMENT si le reseau est vraiment tombe. */
    async get<T>(path: string, fetcher: () => Promise<T>): Promise<T> {
      if (!d.enabled || !isCacheable(path)) return fetcher()
      if (d.net.state() === 'offline') {
        const hit = d.cache.get<T>(path)
        if (hit) { markStale(path, hit.savedAt); return hit.data }
      }
      try {
        const data = await withTimeout(fetcher(), d.getTimeoutMs ?? 12_000)
        d.cache.put(path, data)
        if (stale.delete(path)) emit()
        d.net.reportSuccess()
        return data
      } catch (e) {
        if (!isNetworkError(e)) {
          d.net.reportSuccess() // le serveur a repondu (meme en erreur) : il est joignable
          throw e
        }
        if ((await d.net.reportFailure()) === 'offline') {
          const hit = d.cache.get<T>(path)
          if (hit) { markStale(path, hit.savedAt); return hit.data }
        }
        throw e
      }
    },

    /** Ecriture : directe si possible ; sinon file (actions eligibles) ou refus clair. */
    async write<T>(
      method: string,
      path: string,
      body: unknown,
      extra: Record<string, string> | undefined,
      send: () => Promise<T>,
    ): Promise<T> {
      if (!d.enabled) return send()
      if (d.net.state() === 'offline') return decide(method, path, body, extra) // rien n'est parti
      try {
        const r = await send()
        d.net.reportSuccess()
        return r
      } catch (e) {
        if (!isNetworkError(e)) {
          d.net.reportSuccess()
          throw e
        }
        if ((await d.net.reportFailure()) !== 'offline') throw e
        // la requete a peut-etre atteint le serveur : on ne met en file que l'idempotent
        if (classify(method, path, body, extra).kind === 'queue') return decide(method, path, body, extra)
        throw fail(0, 'réseau interrompu pendant l’envoi : vérifie le résultat avant de recommencer')
      }
    },

    /** Pour les actions qui demandent d'abord un jeton (X-Confirm) : inutile d'essayer hors ligne. */
    requireOnline(why: string): void {
      if (d.enabled && d.net.state() === 'offline') throw fail(0, `hors ligne : ${why}`)
    },

    discardQueue(): void {
      persist([])
      emit()
    },
    dismissNote(): void {
      lastFlush = null
      emit()
    },
    onKeyChange(): void {
      d.cache.clear()
      stale.clear()
      persist([])
      emit()
    },
  }
}

export type OfflineClient = ReturnType<typeof createOfflineClient>
