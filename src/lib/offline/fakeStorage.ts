// Stockage factice pour les tests (non importe par l'application).
import type { StorageLike } from './cache'

export function fakeStorage(quota = Infinity): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    get length() { return map.size },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem(k, v) {
      const used = [...map.entries()].reduce((s, [kk, vv]) => s + (kk === k ? 0 : kk.length + vv.length), 0)
      if (used + k.length + v.length > quota) throw new Error('QuotaExceededError')
      map.set(k, v)
    },
    removeItem: (k) => void map.delete(k),
  }
}
