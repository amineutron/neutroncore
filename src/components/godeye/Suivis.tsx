import { depuisTexte, distanceParcourueKm, MAX_SUIVIS, type Suivi } from '../../lib/godeye/suivi'
import './exploration.css'

type Props = { suivis: readonly Suivi[]; maintenant: number; onVoir: (s: Suivi) => void; onRetirer: (s: Suivi) => void }
const NOM: Record<Suivi['type'], string> = { avion: 'avion', navire: 'navire', satellite: 'satellite' }

/** Objets marqués : nom, depuis quand, nombre de positions enregistrées, distance parcourue, retrait. */
export function Suivis({ suivis, maintenant, onVoir, onRetirer }: Props) {
  if (suivis.length === 0) return <p className="nc-empty">Aucun objet marqué. Toucher un avion, un navire ou un satellite, puis « marquer » : sa position est enregistrée chaque minute à partir de ce moment.</p>
  return (
    <div className="ge-suivis">
      <p className="ge-note">{suivis.length} / {MAX_SUIVIS} objets marqués ; leur trace s'affiche en jaune sur la scène.</p>
      <ul>
        {suivis.map((s) => {
          const km = Math.round(distanceParcourueKm(s.points))
          return (
            <li key={`${s.type}:${s.id}`}>
              <button type="button" className="ge-suivi-v" onClick={() => onVoir(s)}>
                <span className="ge-rech-type">{NOM[s.type]}</span>
                <span className="ge-rech-t">{s.nom}</span>
                <span className="ge-rech-d">{depuisTexte(s.depuis, maintenant)} - {s.points.length} position{s.points.length > 1 ? 's' : ''}{km > 0 ? ` - ${km} km` : ''}</span>
              </button>
              <button type="button" className="ge-suivi-x" onClick={() => onRetirer(s)} aria-label={`ne plus marquer ${s.nom}`}>retirer</button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
