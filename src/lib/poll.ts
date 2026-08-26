import { useCallback, useEffect, useRef, useState } from 'react'
import { pollMultiplier } from './settings'

// Polling différencié gaté par visibilité (pattern Backend.qml de HALO) :
// l'intervalle ne tourne que si l'onglet est visible, refresh immédiat au retour.
export function usePoll<T>(fetcher: () => Promise<T>, intervalMs: number): {
  data: T | null
  error: string | null
  refresh: () => void
} {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const tick = useCallback(() => {
    fetcherRef.current()
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      tick()
      timer = setInterval(tick, intervalMs * pollMultiplier())
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
    }
    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden) start()
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, tick])

  return { data, error, refresh: tick }
}

export function fmtBytes(n: number): string {
  if (!n) return '0'
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(0)} Mo`
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(1)} Go`
  return `${(n / 1024 ** 4).toFixed(2)} To`
}

// Temps restant estimé, décroissant : recalculé à chaque rendu à partir de
// la progression réelle (elapsed × restant/fait). Null tant que trop tôt.
export function fmtRemaining(createdAt: string | undefined, pct: number): string | null {
  if (!createdAt) return null
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000
  if (!isFinite(elapsed) || elapsed < 10) return null
  if (pct <= 3) return `${Math.max(1, Math.round(elapsed / 60))} min écoulées`
  const remaining = (elapsed * (100 - pct)) / pct
  if (remaining < 60) return '< 1 min restante'
  return `~${Math.round(remaining / 60)} min restantes`
}

export function fmtAgo(ts: number | null): string {
  if (!ts) return '—'
  const s = Date.now() / 1000 - ts
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  return `il y a ${Math.round(s / 86400)} j`
}
