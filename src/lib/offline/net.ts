// Etat du reseau : navigator.onLine ment (wifi connecte sans route, VPN tombe,
// serveur eteint), donc on SONDE /health. Un seul echec ne suffit pas a declarer
// « hors ligne » (hysteresis), sauf si le navigateur le dit aussi.

export type NetState = 'unknown' | 'online' | 'offline'
export type NetModel = { state: NetState; fails: number }

export const INITIAL: NetModel = { state: 'unknown', fails: 0 }
export const PROBE_TIMEOUT_MS = 4_000
export const OFFLINE_AFTER = 2

/** Transition pure : un resultat de sonde (ou de requete) fait avancer le modele. */
export function step(m: NetModel, ok: boolean, browserOnline: boolean): NetModel {
  if (ok) return { state: 'online', fails: 0 }
  const fails = m.fails + 1
  const down = fails >= OFFLINE_AFTER || !browserOnline
  return { state: down ? 'offline' : m.state, fails }
}

/** Delai avant la prochaine sonde : calme en ligne, recul progressif hors ligne. */
export function nextDelay(m: NetModel): number {
  if (m.fails === 0) return 30_000
  return Math.min(30_000, 2_000 * 2 ** (m.fails - 1))
}

/** Vrai si /health repond 2xx dans le delai ; ne leve jamais. Sans en-tete d'authentification (route publique). */
export async function probeOnce(
  fetchFn: typeof fetch,
  url: string,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetchFn(url, { cache: 'no-store', signal: ctl.signal })
    return r.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export type NetDeps = {
  probe: () => Promise<boolean>
  browserOnline: () => boolean
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (h: unknown) => void
}

export function createNetwork(d: NetDeps) {
  let model = INITIAL
  let timer: unknown = null
  let running = false
  let started = false
  const subs = new Set<() => void>()

  function apply(next: NetModel): void {
    const changed = next.state !== model.state
    model = next
    if (changed) subs.forEach((f) => f())
  }

  function schedule(): void {
    if (!started) return
    if (timer !== null) d.clearTimer(timer)
    timer = d.setTimer(() => void tick(), nextDelay(model))
  }

  async function tick(): Promise<NetState> {
    if (running) return model.state
    running = true
    try {
      apply(step(model, await d.probe(), d.browserOnline()))
    } finally {
      running = false
      schedule()
    }
    return model.state
  }

  return {
    state: (): NetState => model.state,
    subscribe(fn: () => void): () => void {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    start(): void {
      if (started) return
      started = true
      void tick()
    },
    stop(): void {
      started = false
      if (timer !== null) d.clearTimer(timer)
      timer = null
    },
    /** Sonde tout de suite (retour du reseau, bouton « reessayer »). */
    probeNow: (): Promise<NetState> => tick(),
    /** Une requete a reussi, ou le serveur a repondu : c'est la meilleure des sondes. */
    reportSuccess(): void {
      if (model.state !== 'online' || model.fails !== 0) apply({ state: 'online', fails: 0 })
    },
    /** Une requete a echoue au niveau reseau : compte comme un echec, puis on verifie par la sonde. */
    async reportFailure(): Promise<NetState> {
      apply(step(model, false, d.browserOnline()))
      return tick()
    },
  }
}

export type Network = ReturnType<typeof createNetwork>
