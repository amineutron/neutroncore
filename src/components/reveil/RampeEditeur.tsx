import { useState } from 'react'
import { BRI_MAX, K_MAX, K_MIN, courbeLineaire, dureeLisible, mettreALechelle, type Piste, type Rampe } from '../../lib/rampes'
import type { Lecture } from '../../lib/reveil'
import { Card } from '../ui'
import { NumField } from '../NumField'
import { Apercu } from './Apercu'
import { CourbeEditeur } from './CourbeEditeur'
import { SelecteurLampes, type Lampes } from './SelecteurLampes'
import './reveil.css'

export type Limites = { duree_min_s: number; duree_max_s: number; pistes: number; points: number; lampes_par_piste: number; pas_min_s: number; pas_max_s: number }

/** Édition d'une rampe : une piste à la fois (onglets), deux courbes par piste, aperçu en couleurs en bas. */
export function RampeEditeur({ r, lampes, limites, lecture, onChange }: {
  r: Rampe; lampes: Lampes; limites: Limites; lecture: Lecture | null; onChange: (r: Rampe) => void
}) {
  const [i, setI] = useState(0)
  const idx = Math.min(i, r.pistes.length - 1)
  const piste = r.pistes[idx]
  const noms = Object.fromEntries(Object.entries(lampes).map(([id, l]) => [id, l.name]))
  const majPiste = (p: Partial<Piste>) => onChange({ ...r, pistes: r.pistes.map((x, k) => (k === idx ? { ...x, ...p } : x)) })
  const prises = r.pistes.flatMap((p, k) => (k === idx ? [] : p.lampes))
  const curseur = lecture?.id === r.id ? lecture.t : null
  const nomPiste = (p: Piste) => p.lampes.map((l) => noms[l] ?? l).join(' + ') || 'sans lampe'
  return (
    <Card title={`modifier : ${r.nom || 'sans nom'}`} lite={dureeLisible(r.duree_s)}>
      <div className="rv-grille">
        <label className="rv-champ">nom<input type="text" maxLength={60} value={r.nom} onChange={(e) => onChange({ ...r, nom: e.target.value })} /></label>
        <label className="rv-champ">durée (secondes)
          <NumField value={Math.round(r.duree_s)} min={limites.duree_min_s} max={limites.duree_max_s} label="durée en secondes"
            onCommit={(s) => onChange({ ...r, duree_s: s, pistes: r.pistes.map((p) => ({ ...p, bri: mettreALechelle(p.bri, r.duree_s, s), kelvin: mettreALechelle(p.kelvin, r.duree_s, s) })) })} />
        </label>
        <label className="rv-champ">pas de mise à jour des lampes ({r.pas_s} s)
          <input type="range" min={limites.pas_min_s} max={limites.pas_max_s} value={r.pas_s} onChange={(e) => onChange({ ...r, pas_s: Number(e.target.value) })} />
        </label>
        <label className="rv-ligne"><input type="checkbox" checked={r.boucle} onChange={(e) => onChange({ ...r, boucle: e.target.checked })} /> en boucle jusqu’à l’arrêt</label>
      </div>
      <div className="rv-filtres" style={{ margin: '12px 0 6px' }} role="tablist" aria-label="groupes de lampes">
        {r.pistes.map((p, k) => <button key={k} role="tab" aria-selected={k === idx} aria-pressed={k === idx} className="btn sm" onClick={() => setI(k)}>groupe {k + 1} : {nomPiste(p)}</button>)}
        {r.pistes.length < limites.pistes && (
          <button className="btn sm" onClick={() => { onChange({ ...r, pistes: [...r.pistes, { lampes: [], bri: courbeLineaire(r.duree_s, 20, 200), kelvin: [] }] }); setI(r.pistes.length) }}>+ groupe de lampes</button>
        )}
        {r.pistes.length > 1 && <button className="btn sm" onClick={() => { onChange({ ...r, pistes: r.pistes.filter((_, k) => k !== idx) }); setI(0) }}>retirer ce groupe</button>}
      </div>
      <SelecteurLampes lampes={lampes} choisies={piste.lampes} max={limites.lampes_par_piste} exclues={prises} onChange={(l) => majPiste({ lampes: l })} />
      <CourbeEditeur titre="luminosité" points={piste.bri} duree={r.duree_s} lo={0} hi={BRI_MAX} max={limites.points} couleur="var(--gold)" pas={5}
        formatV={(v) => `${Math.round((v / BRI_MAX) * 100)} %`} curseur={curseur} onChange={(bri) => majPiste({ bri })} />
      {piste.kelvin.length > 0
        ? <>
          <CourbeEditeur titre="température de couleur" points={piste.kelvin} duree={r.duree_s} lo={K_MIN} hi={K_MAX} max={limites.points} couleur="var(--rose)" pas={100}
            formatV={(v) => `${Math.round(v)} K`} curseur={curseur} onChange={(kelvin) => majPiste({ kelvin })} />
          <button className="btn sm" onClick={() => majPiste({ kelvin: [] })}>ne plus toucher à la couleur</button>
        </>
        : <button className="btn sm" onClick={() => majPiste({ kelvin: courbeLineaire(r.duree_s, 2700, 4000) })}>+ courbe de température de couleur</button>}
      <h4 style={{ margin: '14px 0 6px' }}>aperçu (tous les groupes)</h4>
      <Apercu rampe={r} noms={noms} lecture={lecture} />
    </Card>
  )
}
