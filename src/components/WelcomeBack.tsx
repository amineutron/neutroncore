import { useEffect, useRef, useState } from 'react'
import { getSettings } from '../lib/settings'
import { Mascot } from './Mascot'

// Animation de retour : version courte et chaleureuse de l'ecran de lancement.
// Elle joue quand l'app est rouverte peu de temps apres avoir ete quittee,
// la sequence complete etant reservee a la premiere ouverture de la journee.
// Environ 1,8 s, passable au toucher ou a la touche.

/** Salutation selon l'heure — la nuit, la mascotte se permet un clin d'oeil. */
function greeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'bon retour'
  if (h >= 12 && h < 18) return 'te revoilà'
  if (h >= 18 && h < 23) return 'bonsoir'
  return 'encore debout ?'
}

/** « il y a 12 min », « il y a 2 h » — depuis la derniere visite. */
function since(awayMs: number): string | null {
  if (!awayMs || awayMs < 60_000) return null
  const min = Math.round(awayMs / 60_000)
  if (min < 60) return `dernière visite il y a ${min} min`
  const h = Math.round(min / 60)
  return `dernière visite il y a ${h} h`
}

export function WelcomeBack({ awayMs, onDone }: { awayMs: number; onDone: () => void }) {
  const [out, setOut] = useState(false)
  const doneRef = useRef(false)
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    setOut(true)
    setTimeout(onDone, 360)
  }

  useEffect(() => {
    if (reduced) { finish(); return }
    const t = setTimeout(finish, 1800)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const skip = () => finish()
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const s = getSettings()
  const sub = since(awayMs)

  return (
    <div className={`wb ${out ? 'out' : ''}`} role="presentation">
      <div className="wb-halo" />
      {s.mascots && (
        <div className="wb-mascot">
          <Mascot kind="fast" name={s.mascotFast} state="ok" size={11} />
        </div>
      )}
      <div className="wb-hi">{greeting()}</div>
      {sub && <div className="wb-sub">{sub}</div>}
      <div className="wb-rule" />
    </div>
  )
}
