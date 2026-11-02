import { useEffect, useState } from 'react'

/** Heure locale en ms, rafraîchie toutes les `ms` tant que l'onglet est visible (décompte des minuteurs). */
export function useTick(ms = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => { setNow(Date.now()); timer = setInterval(() => setNow(Date.now()), ms) }
    const stop = () => { if (timer) clearInterval(timer); timer = null }
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    if (!document.hidden) start()
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [ms])
  return now
}
