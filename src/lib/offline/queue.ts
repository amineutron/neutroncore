// File d'actions en attente : logique PURE (aucun reseau, aucun stockage).
// Seules les actions que `classify` accepte y entrent ; la persistance
// (`createQueueStore`) les revalide a chaque lecture.

import type { StorageLike } from './cache'
import { classify } from './eligibility'

export type QueueItem = {
  id: string
  method: 'PUT' | 'POST'
  path: string
  body?: unknown
  key: string
  queuedAt: number
}

export const MAX_ITEMS = 50
export const MAX_AGE_MS = 24 * 3_600_000 // au-dela, l'etat a pu changer ailleurs : on n'ecrase pas

export type EnqueueResult = { items: QueueItem[]; overflow: number }

/** Ajoute (ou remplace par cle) ; retourne une NOUVELLE liste. */
export function enqueue(
  items: readonly QueueItem[],
  req: { method: 'PUT' | 'POST'; path: string; body?: unknown; key: string },
  now: number,
  id: string,
): EnqueueResult {
  const base = items.filter((i) => i.key !== req.key)
  const next: QueueItem[] = [...base, { id, ...req, queuedAt: now }]
  const overflow = Math.max(0, next.length - MAX_ITEMS)
  return { items: next.slice(overflow), overflow }
}

export function pruneExpired(items: readonly QueueItem[], now: number): { kept: QueueItem[]; expired: QueueItem[] } {
  const kept: QueueItem[] = []
  const expired: QueueItem[] = []
  for (const i of items) (now - i.queuedAt > MAX_AGE_MS ? expired : kept).push(i)
  return { kept, expired }
}

export type DrainReport = {
  remaining: QueueItem[]
  done: number
  rejected: QueueItem[] // refuse par le serveur (4xx) : abandonne, jamais reessaye
  expired: QueueItem[]
}

/**
 * Rejoue dans l'ordre. `send` rend le code HTTP et LEVE en cas d'erreur reseau.
 * - 2xx/3xx : fait ; 401/403/408/429/5xx ou erreur reseau : on s'arrete, l'element
 *   et la suite restent en file ; autre 4xx : abandonne et signale.
 */
export async function drain(
  items: readonly QueueItem[],
  send: (i: QueueItem) => Promise<number>,
  now: number,
): Promise<DrainReport> {
  const { kept, expired } = pruneExpired(items, now)
  const rejected: QueueItem[] = []
  let done = 0
  let idx = 0
  for (; idx < kept.length; idx++) {
    let status: number
    try {
      status = await send(kept[idx])
    } catch {
      break
    }
    if (status < 400) { done++; continue }
    if ([401, 403, 408, 429].includes(status) || status >= 500) break
    rejected.push(kept[idx])
  }
  return { remaining: kept.slice(idx), done, rejected, expired }
}

// ---- persistance -----------------------------------------------------------

export const QUEUE_KEY = 'nc_oq'

export function createQueueStore(storage: StorageLike) {
  function load(): QueueItem[] {
    let raw: unknown
    try {
      raw = JSON.parse(storage.getItem(QUEUE_KEY) ?? '[]')
    } catch {
      return []
    }
    if (!Array.isArray(raw)) return []
    const out: QueueItem[] = []
    for (const r of raw as Partial<QueueItem>[]) {
      if (!r || typeof r.id !== 'string' || typeof r.queuedAt !== 'number') continue
      if (r.method !== 'PUT' && r.method !== 'POST') continue
      if (typeof r.path !== 'string') continue
      // revalidation : un contenu edite a la main ne peut pas faire rejouer autre chose
      const v = classify(r.method, r.path, r.body)
      if (v.kind !== 'queue') continue
      out.push({ id: r.id, method: r.method, path: r.path, body: r.body, key: v.key, queuedAt: r.queuedAt })
    }
    return out
  }
  function save(items: readonly QueueItem[]): boolean {
    try {
      if (items.length === 0) storage.removeItem(QUEUE_KEY)
      else storage.setItem(QUEUE_KEY, JSON.stringify(items))
      return true
    } catch {
      return false
    }
  }
  return { load, save }
}
