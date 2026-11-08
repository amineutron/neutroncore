import { ELEMENTS_CARTE, type ElementId, type Elements } from '../../lib/godeye/elements'
import { GRILLES, type GrilleReglage } from '../../lib/godeye/apparence'
import { ecrireCarte, useReglagesCarte } from '../../lib/godeye/carteStore'
import { Case } from './Champs'

const nomGrille = (g: GrilleReglage): string => (g === 'auto' ? 'auto' : `${g}°`)

/** Section « carte » des réglages : rendu du fond (texture, satellite, nuit), regroupement et quadrillage. */
export function SectionCarte({ elements, onElements }: { elements: Elements; onElements: (e: Elements) => void }) {
  const r = useReglagesCarte()
  const basculer = (id: ElementId, v: boolean) => onElements({ ...elements, [id]: v })
  return (
    <details className="ge-section">
      <summary><span className="ge-section-t">carte</span><span className="ge-section-r">{elements.satellite ? 'vue satellite' : 'fond normal'}</span></summary>
      <div className="ge-section-c">
        {ELEMENTS_CARTE.map((e) => (
          <div key={e.id} className="ge-element">
            <Case label={e.nom} on={elements[e.id]} onChange={(v) => basculer(e.id, v)} title={e.aide} />
            <span className="ge-element-a">{e.aide}</span>
          </div>
        ))}
        <div className="ge-bloc-t">pas du quadrillage</div>
        <div className="ge-seg" role="group" aria-label="pas du quadrillage">
          {GRILLES.map((g) => (
            <button key={String(g)} type="button" className={r.grille === g ? 'on' : ''} aria-pressed={r.grille === g} onClick={() => ecrireCarte({ grille: g })}>{nomGrille(g)}</button>
          ))}
        </div>
        <p className="ge-note">Auto : plus fin à mesure qu'on zoome sur la carte à plat, 15° sur le globe.</p>
        <div className="ge-element"><Case label="équateur" on={r.equateur} onChange={(v) => ecrireCarte({ equateur: v })} /></div>
        <div className="ge-element"><Case label="tropiques" on={r.tropiques} onChange={(v) => ecrireCarte({ tropiques: v })} /></div>
      </div>
    </details>
  )
}
