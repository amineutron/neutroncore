import { couleurObjet } from '../../lib/godeye/couleurs'
import type { Filtres, VueEnregistree } from '../../lib/godeye/filtres'
import type { CoucheId, Info, Objet, SourceInfo } from '../../lib/godeye/modele'
import { ageTexte } from '../../lib/vueMonde'
import { FilInfos } from './FilInfos'
import { PanneauCouches } from './PanneauCouches'
import { PanneauVues } from './PanneauVues'
import { ONGLETS, type Onglet } from './ControlesStage'
import type { EtatFlux } from './useFlux'

type VuesProps = Parameters<typeof PanneauVues>[0]

type Props = {
  onglet: Onglet
  onOnglet: (o: Onglet) => void
  onFermer: () => void
  f: Filtres
  onChange: (f: Filtres) => void
  nombres: Record<CoucheId, number>
  etats: Record<CoucheId, EtatFlux>
  couvreAvions: string
  sourcesInfos: SourceInfo[]
  fil: readonly Info[]
  choisi: string | null
  onChoisirInfo: (a: Info) => void
  une: readonly Objet[]
  onChoisirObjet: (o: Objet) => void
  vues: VuesProps
  onAppliquerVue: (v: VueEnregistree) => void
}

/** Panneau latéral de la scène : fil d'actualités, à la une, filtres, vues enregistrées. */
export function Tiroir(p: Props) {
  return (
    <aside className="ge-tiroir" data-bloque="1" aria-label="panneau">
      <div className="ge-tiroir-tete">
        <div className="ge-onglets" role="tablist">
          {ONGLETS.map((o) => (
            <button key={o.id} type="button" role="tab" aria-selected={p.onglet === o.id} className={p.onglet === o.id ? 'on' : ''} onClick={() => p.onOnglet(o.id)}>{o.nom}</button>
          ))}
        </div>
        <button type="button" className="ge-x" onClick={p.onFermer} aria-label="fermer le panneau">fermer</button>
      </div>
      <div className="ge-tiroir-corps">
        {p.onglet === 'fil' && (p.f.couches.infos
          ? <FilInfos infos={p.fil} max={40} choisi={p.choisi?.startsWith('inf:') ? p.choisi.slice(4) : null} onChoisir={p.onChoisirInfo} />
          : <p className="nc-empty">La couche « actualités » est coupée : l'allumer pour voir le fil.</p>)}
        {p.onglet === 'une' && (p.une.length === 0 ? <p className="nc-empty">rien à signaler avec ces filtres</p> : (
          <ul className="ge-une">
            {p.une.map((o) => (
              <li key={o.id} className={o.id === p.choisi ? 'on' : ''} style={{ '--c': couleurObjet(o) } as React.CSSProperties}>
                <button type="button" onClick={() => p.onChoisirObjet(o)}>
                  <i className="ge-pt" aria-hidden="true" />
                  <span className="ge-une-t">{o.titre}</span>
                  <span className="ge-une-m">{o.t ? `${ageTexte(o.t, Date.now())} - ` : ''}{o.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
        {p.onglet === 'filtres' && <PanneauCouches f={p.f} onChange={p.onChange} nombres={p.nombres} etats={p.etats} couvreAvions={p.couvreAvions} sourcesInfos={p.sourcesInfos} />}
        {p.onglet === 'vues' && <PanneauVues {...p.vues} onAppliquer={p.onAppliquerVue} />}
      </div>
    </aside>
  )
}
