// Instance unique, branchee sur le navigateur. Le reste du module est pur.
// Desactive en mode demo (aucun reseau) : toutes les methodes deviennent des passe-plats.

import { createReadCache } from './cache'
import { createOfflineClient } from './client'
import { createNetwork, probeOnce } from './net'
import { createQueueStore } from './queue'

export const OFFLINE_ENABLED = import.meta.env.VITE_MOCK_API !== '1' && typeof window !== 'undefined'

// Route publique du backend, a la racine de l'origine (pas sous /app/).
export const HEALTH_URL = '/health'

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

function pickStorage() {
  try {
    const t = '__nc_probe__'
    window.localStorage.setItem(t, '1')
    window.localStorage.removeItem(t)
    return window.localStorage
  } catch {
    return memoryStorage() // navigation privee / stockage bloque : tout marche, rien ne survit
  }
}

const storage = OFFLINE_ENABLED ? pickStorage() : memoryStorage()
const now = () => Date.now()

export const network = createNetwork({
  probe: () => probeOnce(fetch.bind(window), HEALTH_URL),
  browserOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
})

export const offline = createOfflineClient({
  cache: createReadCache({ storage, now }),
  queueStore: createQueueStore(storage),
  net: network,
  now,
  enabled: OFFLINE_ENABLED,
})

let started = false
/** Demarre la sonde et ses declencheurs ; appele une fois par OfflineBanner. */
export function startOffline(): () => void {
  if (!OFFLINE_ENABLED || started) return () => {}
  started = true
  const probe = () => void network.probeNow()
  const onVisible = () => (document.hidden ? network.stop() : network.start())
  window.addEventListener('online', probe)
  window.addEventListener('offline', probe)
  document.addEventListener('visibilitychange', onVisible)
  if (!document.hidden) network.start()
  return () => {
    started = false
    network.stop()
    window.removeEventListener('online', probe)
    window.removeEventListener('offline', probe)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
