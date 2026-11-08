import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api'
import { lireResume, phrases, type Resume as DonneesResume } from '../../lib/godeye/resume'
import { useContexteAvance } from './useAvance'
import './avance.css'

/** Résumé du matin : ce qui s'est passé depuis `heures` (séismes, événements, suivis, zones). `tele` : grandes lettres. */
export function Resume({ heures, tele = false }: { heures?: number; tele?: boolean }) {
  const { avance } = useContexteAvance()
  const h = heures ?? Math.min(24, avance.historique_heures)
  const [r, setR] = useState<DonneesResume | null>(null)
  const [erreur, setErreur] = useState(false)
  useEffect(() => {
    let vivant = true
    const un = () => apiGet(`/godeye/resume?heures=${h}`).then((x) => { if (vivant) { setR(lireResume(x)); setErreur(false) } }).catch(() => { if (vivant) setErreur(true) })
    void un()
    const t = window.setInterval(() => { if (!document.hidden) void un() }, 10 * 60_000)
    return () => { vivant = false; window.clearInterval(t) }
  }, [h])
  if (!r) return erreur ? <p className="ge-note">résumé indisponible pour le moment</p> : null
  return (
    <section className={`ge-resume${tele ? ' tele' : ''}`} aria-label="résumé">
      <h3>résumé des {h} dernières heures</h3>
      <ul>{phrases(r, h).map((l) => <li key={l}>{l}</li>)}</ul>
    </section>
  )
}
