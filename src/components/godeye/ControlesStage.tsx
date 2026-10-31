import { COULEURS_COUCHE } from '../../lib/godeye/couleurs'
import { basculerCouche, type Filtres } from '../../lib/godeye/filtres'
import { COUCHES, type CoucheId } from '../../lib/godeye/modele'
import type { EtatFlux } from './useFlux'

export type Affichage = { mode: 'globe' | 'plat'; rotation: boolean; jourNuit: boolean; tiroir: Onglet | null }
export type Onglet = 'fil' | 'filtres' | 'vues' | 'une'
export const ONGLETS: { id: Onglet; nom: string }[] = [
  { id: 'fil', nom: 'fil' }, { id: 'une', nom: 'à la une' }, { id: 'filtres', nom: 'filtres' }, { id: 'vues', nom: 'vues' },
]

/** Commandes en haut à droite de la scène : mode, rotation, jour et nuit, recentrage, plein écran. */
export function BarreStage({ aff, onAff, plein, onPlein, onRecentrer, enrouler }: {
  aff: Affichage; onAff: (a: Affichage) => void; plein: boolean; onPlein: () => void; onRecentrer: () => void; enrouler: boolean
}) {
  const globe = aff.mode === 'globe'
  return (
    <div className="ge-barre" data-bloque="1">
      <div className="ge-seg" role="group" aria-label="mode d'affichage">
        <button type="button" className={globe ? 'on' : ''} aria-pressed={globe} onClick={() => onAff({ ...aff, mode: 'globe' })}>globe 3d</button>
        <button type="button" className={!globe ? 'on' : ''} aria-pressed={!globe} onClick={() => onAff({ ...aff, mode: 'plat' })}>carte</button>
      </div>
      {globe && (
        <>
          <button type="button" className={`ge-tog${aff.rotation ? ' on' : ''}`} aria-pressed={aff.rotation} onClick={() => onAff({ ...aff, rotation: !aff.rotation })}
            title={enrouler ? 'La rotation fait une pause tant qu\'un élément est sélectionné' : 'Fait tourner la Terre doucement ; toucher le globe met la rotation en pause'}>
            <i className="ge-led" aria-hidden="true" />rotation {aff.rotation ? 'activée' : 'coupée'}
          </button>
          <button type="button" className={`ge-tog${aff.jourNuit ? ' on' : ''}`} aria-pressed={aff.jourNuit} onClick={() => onAff({ ...aff, jourNuit: !aff.jourNuit })}
            title="Éclaire la Terre avec la position réelle du soleil">
            <i className="ge-led" aria-hidden="true" />jour et nuit
          </button>
        </>
      )}
      <button type="button" className="ge-tog" onClick={onRecentrer}>recentrer</button>
      <button type="button" className="ge-tog" onClick={onPlein}>{plein ? 'quitter le plein écran' : 'plein écran'}</button>
      <button type="button" className={`ge-tog${aff.tiroir ? ' on' : ''}`} aria-pressed={aff.tiroir !== null} onClick={() => onAff({ ...aff, tiroir: aff.tiroir ? null : 'fil' })}>
        panneau
      </button>
    </div>
  )
}

/** Couches en haut à gauche : un interrupteur coloré par couche, avec son décompte ; « régler » ouvre les filtres. */
export function RailCouches({ f, onChange, nombres, etats, onRegler }: {
  f: Filtres; onChange: (f: Filtres) => void; nombres: Record<CoucheId, number>; etats: Record<CoucheId, EtatFlux>; onRegler: () => void
}) {
  return (
    <div className="ge-rail" data-bloque="1" role="group" aria-label="couches">
      {COUCHES.filter((c) => c.id !== 'cyber').map((c) => {
        const on = f.couches[c.id]
        const e = etats[c.id]
        return (
          <button key={c.id} type="button" className={`ge-rail-l${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onChange(basculerCouche(f, c.id))}
            style={{ '--c': COULEURS_COUCHE[c.id] } as React.CSSProperties} title={`${c.nom} - ${c.source}`}>
            <i className="ge-pt" aria-hidden="true" />
            <span className="ge-rail-n">{c.nom}</span>
            <span className="ge-rail-c">{on ? (e.erreur ? '!' : nombres[c.id]) : ''}</span>
          </button>
        )
      })}
      <button type="button" className="ge-rail-regler" onClick={onRegler}>régler les filtres</button>
    </div>
  )
}
