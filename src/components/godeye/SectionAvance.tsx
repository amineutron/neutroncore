import { useState } from 'react'
import { MAX_ETAPES, nomEtape, SECONDES_MAX, SECONDES_MIN, type Etape } from '../../lib/godeye/rotation'
import { HISTORIQUE_MAX, HISTORIQUE_MIN } from '../../lib/godeye/reglagesServeur'
import { libelleHeures } from '../../lib/godeye/periode'
import { Case, Curseur } from './Champs'
import { useContexteAvance } from './useAvance'
import './avance.css'

/** Réglages gardés côté serveur : durée de l'historique et rotation automatique entre étapes. Lit son état dans le contexte de l'écran. */
export function SectionAvance() {
  const { avance, onAvance, zones } = useContexteAvance()
  const r = avance.rotation
  const [zoneChoisie, setZoneChoisie] = useState('')
  const rot = (p: Partial<typeof r>) => onAvance({ ...avance, rotation: { ...r, ...p } })
  const ajouter = (e: Etape) => { if (r.etapes.length < MAX_ETAPES) rot({ etapes: [...r.etapes, e] }) }
  const retirer = (i: number) => rot({ etapes: r.etapes.filter((_, j) => j !== i) })
  const monter = (i: number) => { if (i > 0) { const n = [...r.etapes]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; rot({ etapes: n }) } }
  return (
    <>
      <details className="ge-section" open>
        <summary><span className="ge-section-t">historique</span><span className="ge-section-r">{libelleHeures(avance.historique_heures)}</span></summary>
        <div className="ge-section-c">
          <p className="ge-note">Le serveur garde les séismes et événements vus. Il les complète quand une source tombe ou quand on remonte plus loin que ce que le flux donne.</p>
          <Curseur label="durée gardée" valeur={avance.historique_heures} min={HISTORIQUE_MIN} max={HISTORIQUE_MAX} pas={1} format={libelleHeures}
            onChange={(historique_heures) => onAvance({ ...avance, historique_heures })} />
        </div>
      </details>
      <details className="ge-section">
        <summary><span className="ge-section-t">rotation automatique</span><span className="ge-section-r">{r.actif ? `toutes les ${r.secondes} s` : 'coupée'}</span></summary>
        <div className="ge-section-c">
          <p className="ge-note">La vue passe d'étape en étape. Le moindre geste, ou un objet sélectionné, la met en pause pendant 30 s au moins.</p>
          <Case label="activer la rotation" on={r.actif} onChange={(actif) => rot({ actif })} />
          <Curseur label="durée par étape" valeur={r.secondes} min={SECONDES_MIN} max={SECONDES_MAX} pas={5} format={(v) => `${v} s`} onChange={(secondes) => rot({ secondes })} />
          <div className="ge-bloc-t">étapes</div>
          <ol className="ge-etapes">
            {r.etapes.map((e, i) => (
              <li key={`${i}-${e.type === 'zone' ? e.zone_id : 'monde'}`}>
                <span>{nomEtape(e, zones)}</span>
                <button type="button" onClick={() => monter(i)} disabled={i === 0} aria-label={`monter ${nomEtape(e, zones)}`}>monter</button>
                <button type="button" onClick={() => retirer(i)} disabled={r.etapes.length <= 1} aria-label={`retirer ${nomEtape(e, zones)}`}>retirer</button>
              </li>
            ))}
          </ol>
          <div className="ge-etapes-ajout">
            <button type="button" onClick={() => ajouter({ type: 'monde' })} disabled={r.etapes.length >= MAX_ETAPES}>ajouter le monde</button>
            <select value={zoneChoisie} onChange={(e) => setZoneChoisie(e.target.value)} aria-label="zone à ajouter" disabled={zones.length === 0}>
              <option value="">{zones.length ? 'une zone...' : 'aucune zone surveillée'}</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.nom}</option>)}
            </select>
            <button type="button" disabled={!zoneChoisie || r.etapes.length >= MAX_ETAPES} onClick={() => { ajouter({ type: 'zone', zone_id: zoneChoisie }); setZoneChoisie('') }}>ajouter la zone</button>
          </div>
        </div>
      </details>
    </>
  )
}
