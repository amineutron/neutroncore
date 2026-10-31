import { couleurObjet } from '../../lib/godeye/couleurs'
import type { Objet } from '../../lib/godeye/modele'
import { THEMES } from '../../lib/godeye/modele'

/** Bandeau défilant en bas de la scène : les derniers événements importants, un clic centre la carte dessus. */
export function Bandeau({ items, onChoisir }: { items: readonly Objet[]; onChoisir: (o: Objet) => void }) {
  if (items.length === 0) return null
  const ligne = items.slice(0, 14)
  const duree = Math.max(40, ligne.length * 7)
  return (
    <div className="ge-bandeau" data-bloque="1" aria-label="derniers événements importants">
      <span className="ge-bandeau-tag">en direct</span>
      <div className="ge-bandeau-piste">
        <div className="ge-bandeau-defile" style={{ animationDuration: `${duree}s` }}>
          {[0, 1].map((copie) => (
            <span className="ge-bandeau-lot" key={copie} aria-hidden={copie === 1}>
              {ligne.map((o) => (
                <button key={`${copie}-${o.id}`} type="button" tabIndex={copie === 1 ? -1 : 0} onClick={() => onChoisir(o)} style={{ '--c': couleurObjet(o) } as React.CSSProperties}>
                  <b>{o.couche === 'infos' ? (THEMES.find((t) => t.id === o.sorte)?.nom ?? 'monde') : o.couche === 'seismes' ? 'séisme' : o.couche === 'avions' ? 'avion' : o.couche}</b> {o.titre}
                </button>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
