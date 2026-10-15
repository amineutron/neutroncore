import { useState, type ReactNode } from 'react'

const CLE = 'neutroncore_lumiere_blocs'
const lire = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(CLE) ?? '{}') as Record<string, boolean> } catch { return {} } }

/** Un bloc de l'écran lumière, repliable d'un clic sur son titre ; replié, il ne garde que son titre et son résumé.
 * L'état de chaque bloc est retenu sur cet appareil. */
export function Bloc({ id, title, lite, ouvertAuDepart = true, children }: { id: string; title: string; lite?: string; ouvertAuDepart?: boolean; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(() => lire()[id] ?? ouvertAuDepart)
  const basculer = () => {
    const next = !ouvert
    setOuvert(next)
    try { localStorage.setItem(CLE, JSON.stringify({ ...lire(), [id]: next })) } catch { /* stockage indisponible : le bloc se replie quand même */ }
  }
  return (
    <div className={`card lu-bloc ${ouvert ? 'ouvert' : ''}`}>
      <h3>
        <button type="button" className="lu-bloc-titre" aria-expanded={ouvert} onClick={basculer}>
          <i className="lu-chevron" aria-hidden />{title}{lite && <span className="lite">{lite}</span>}
        </button>
      </h3>
      {ouvert && children}
    </div>
  )
}
