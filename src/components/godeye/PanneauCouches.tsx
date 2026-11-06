import { useState } from 'react'
import { basculerCouche, modifier, type Filtres } from '../../lib/godeye/filtres'
import { COUCHES, type CoucheId, type SourceInfo } from '../../lib/godeye/modele'
import { ageTexte } from '../../lib/vueMonde'
import type { EtatFlux } from './useFlux'
import { FiltresCouche } from './FiltresCouches'
import { Case } from './Champs'

type Props = {
  f: Filtres
  onChange: (f: Filtres) => void
  /** Nombre d'objets affichés par couche (après filtres). */
  nombres: Record<CoucheId, number>
  etats: Record<CoucheId, EtatFlux>
  couvreAvions: string
  sourcesInfos: SourceInfo[]
}

/** Une ligne par couche : interrupteur, décompte, état de la source ; les réglages se déplient sous la ligne. */
export function PanneauCouches({ f, onChange, nombres, etats, couvreAvions, sourcesInfos }: Props) {
  const [ouvert, setOuvert] = useState<CoucheId | null>(null)
  return (
    <div className="ge-couches">
      {COUCHES.map((c) => {
        const on = f.couches[c.id]
        const e = etats[c.id]
        return (
          <div key={c.id} className={`ge-couche${on ? ' on' : ''}`}>
            <div className="ge-couche-tete">
              <label className="ge-couche-nom">
                <input type="checkbox" checked={on} onChange={() => onChange(basculerCouche(f, c.id))} aria-label={`couche ${c.nom}`} />
                <i className={`ge-sw ge-${c.id}`} aria-hidden="true" />
                <span>{c.nom}</span>
              </label>
              <span className="ge-couche-n" title={c.source}>{on ? nombres[c.id] : ''}</span>
              <span className={`ge-couche-etat${e.erreur ? ' err' : ''}`}>
                {!on ? '' : e.erreur ? 'source en panne' : e.charge && !e.maj ? 'chargement...' : e.maj ? ageTexte(e.maj, Date.now()) : ''}
              </span>
              <button type="button" className="ge-plier" disabled={!on} aria-expanded={ouvert === c.id && on}
                onClick={() => setOuvert(ouvert === c.id ? null : c.id)}>{ouvert === c.id && on ? 'replier' : 'régler'}</button>
            </div>
            {on && e.erreur && <p className="ge-note err">{e.erreur}. Nouvel essai automatique (source : {c.source}).</p>}
            {on && ouvert === c.id && <FiltresCouche id={c.id} f={f} onChange={onChange} couvreAvions={couvreAvions} sourcesInfos={sourcesInfos} />}
          </div>
        )
      })}
      <div className="ge-global">
        <label className="ge-recherche">
          <span className="ge-curseur-t">rechercher</span>
          <input value={f.texte} maxLength={60} placeholder="indicatif, lieu, satellite..." aria-label="rechercher dans les couches"
            onChange={(e) => onChange(modifier(f, 'texte', e.target.value))} />
        </label>
        <Case label="zone visible seulement" on={f.vueSeule} onChange={(vueSeule) => onChange({ ...f, vueSeule })}
          title="Cache tout ce qui est hors de l'écran : les compteurs et la liste ne parlent plus que de la région regardée." />
      </div>
    </div>
  )
}
