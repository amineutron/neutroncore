// Cache des derniers GET reussis (localStorage), avec expiration et plafonds.
// Format d'une entree : "<epoch ms>|<json>" -> on lit l'age sans parser le json.
// Jamais de donnee « fraiche » : une lecture rend toujours son horodatage.

export type StorageLike = {
  readonly length: number
  key(i: number): string | null
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

export type CacheHit<T = unknown> = { data: T; savedAt: number; ageMs: number }

export type CacheOptions = {
  storage: StorageLike
  now: () => number
  ttlMs?: number
  maxEntries?: number
  maxEntryChars?: number
  maxTotalChars?: number
}

export const PREFIX = 'nc_oc:'
export const DAY = 86_400_000

// Jamais gardes : jetons, flux, apercus, tout ce qui ressemble a un secret.
const DENY = [
  /^\/auth\//, /^\/health/, /token/i, /secret|password|cred/i,
  /\/events$/, /^\/lyra\/chat/, /^\/camera\/(apercu|flux)/, /\/stream/,
]

export function isCacheable(path: string): boolean {
  const p = path.split('#')[0]
  return p.startsWith('/') && !DENY.some((r) => r.test(p))
}

export function createReadCache(o: CacheOptions) {
  const ttl = o.ttlMs ?? 7 * DAY
  const maxEntries = o.maxEntries ?? 80
  const maxEntry = o.maxEntryChars ?? 200_000
  const maxTotal = o.maxTotalChars ?? 2_000_000
  const { storage, now } = o

  function entries(): { k: string; t: number; size: number }[] {
    const out: { k: string; t: number; size: number }[] = []
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (!k || !k.startsWith(PREFIX)) continue
      const v = storage.getItem(k) ?? ''
      const t = Number(v.slice(0, v.indexOf('|')))
      out.push({ k, t: Number.isFinite(t) ? t : 0, size: v.length })
    }
    return out
  }

  function evict(room: number): void {
    const all = entries().sort((a, b) => a.t - b.t) // plus ancien d'abord
    let total = all.reduce((s, e) => s + e.size, 0)
    let count = all.length
    for (const e of all) {
      if (count <= maxEntries - 1 && total + room <= maxTotal) break
      storage.removeItem(e.k)
      total -= e.size
      count -= 1
    }
  }

  return {
    put(path: string, data: unknown): boolean {
      if (!isCacheable(path)) return false
      let json: string | undefined
      try {
        json = JSON.stringify(data)
      } catch {
        return false
      }
      if (json === undefined || json.length > maxEntry) return false
      const value = `${now()}|${json}`
      const key = PREFIX + path
      try {
        storage.removeItem(key)
        evict(value.length)
        storage.setItem(key, value)
        return true
      } catch {
        // quota : on libere la moitie la plus ancienne et on retente une fois
        try {
          const all = entries().sort((a, b) => a.t - b.t)
          all.slice(0, Math.ceil(all.length / 2)).forEach((e) => storage.removeItem(e.k))
          storage.setItem(key, value)
          return true
        } catch {
          return false
        }
      }
    },

    get<T = unknown>(path: string): CacheHit<T> | null {
      const raw = storage.getItem(PREFIX + path)
      if (raw === null) return null
      const cut = raw.indexOf('|')
      const savedAt = Number(raw.slice(0, cut))
      const age = now() - savedAt
      if (cut < 0 || !Number.isFinite(savedAt) || age > ttl || age < -60_000) {
        storage.removeItem(PREFIX + path) // perime, ou horloge incoherente
        return null
      }
      try {
        return { data: JSON.parse(raw.slice(cut + 1)) as T, savedAt, ageMs: Math.max(0, age) }
      } catch {
        storage.removeItem(PREFIX + path)
        return null
      }
    },

    /** A appeler quand la cle API change : les donnees d'un autre compte ne se melangent pas. */
    clear(): void {
      entries().forEach((e) => storage.removeItem(e.k))
    },

    sweepExpired(): number {
      let n = 0
      for (const e of entries()) {
        if (now() - e.t > ttl) { storage.removeItem(e.k); n++ }
      }
      return n
    },

    size(): number {
      return entries().length
    },
  }
}

export type ReadCache = ReturnType<typeof createReadCache>
