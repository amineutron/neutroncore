import { BRI_MAX, cheminCourbe, dureeLisible, type Rampe } from '../../lib/rampes'
import {
  COULEURS, MODELES_SIMPLES, maxPourcent, phraseRampe, problemeRampe, reglerCouleurs, reglerDuree, reglerMax,
  depuisModeleSimple,
} from '../../lib/rampesAssistant'
import type { Lecture } from '../../lib/reveil'
import { Card } from '../ui'
import { NumField } from '../NumField'
import { Apercu } from './Apercu'
import { CourbeEditeur } from './CourbeEditeur'
import { SelecteurLampes, type Lampes } from './SelecteurLampes'
import type { Limites } from './RampeEditeur'
import './reveil.css'
import './assistant.css'

/** Petite courbe de luminosité d'un modèle (ou d'une rampe) : on voit la forme avant de choisir. */
export function Courbette({ r }: { r: Rampe }) {
  const p = r.pistes[0]?.bri ?? []
  return (
    <svg viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${cheminCourbe(p, r.duree_s, 0, BRI_MAX, 120, 38)} L120 40 L0 40 Z`} fill="var(--gold)" opacity=".15" />
      <path d={cheminCourbe(p, r.duree_s, 0, BRI_MAX, 120, 38)} fill="none" stroke="var(--gold)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Choix du modèle : quatre cartes nommées, avec leur courbe. */
export function ModelesRampe({ onChoisir, choisi }: { onChoisir: (id: string) => void; choisi?: string | null }) {
  return (
    <div className="mo-grille">
      {MODELES_SIMPLES.map((m) => (
        <button key={m.id} type="button" className="mo-carte" aria-pressed={choisi === m.id} onClick={() => onChoisir(m.id)}>
          <Courbette r={{ id: m.id, ...depuisModeleSimple(m.id, [])! }} />
          <b>{m.nom}</b>
          <small>{m.desc} · {m.duree_min} min</small>
        </button>
      ))}
    </div>
  )
}

/** Éditeur simple d'une montée : nom, durée en minutes, lampes par leur nom, une courbe à tirer, un aperçu qui ne touche pas aux lampes. */
export function RampeSimple({ r, lampes, limites, lecture, onChange }: {
  r: Rampe; lampes: Lampes; limites: Limites; lecture: Lecture | null; onChange: (r: Rampe) => void
}) {
  const noms = Object.fromEntries(Object.entries(lampes).map(([id, l]) => [id, l.name]))
  const piste = r.pistes[0]
  const maj = (p: Partial<typeof piste>) => onChange({ ...r, pistes: [{ ...piste, ...p }] })
  const k = piste.kelvin
  const procheDe = (v: number) => COULEURS.reduce((a, b) => (Math.abs(b.k - v) < Math.abs(a.k - v) ? b : a)).k
  const probleme = problemeRampe(r)
  return (
    <Card title={`ma montée : ${r.nom || 'sans nom'}`} lite={dureeLisible(r.duree_s)}>
      <div className="mo-etape">
        <h4>1. un nom et une durée</h4>
        <div className="rv-grille">
          <label className="rv-champ">nom<input type="text" maxLength={60} value={r.nom} onChange={(e) => onChange({ ...r, nom: e.target.value })} /></label>
          <label className="rv-champ">durée (minutes)
            <NumField value={Math.max(1, Math.round(r.duree_s / 60))} min={Math.ceil(limites.duree_min_s / 60)} max={Math.floor(limites.duree_max_s / 60)} label="durée en minutes" onCommit={(m) => onChange(reglerDuree(r, m))} />
          </label>
          <label className="rv-ligne"><input type="checkbox" checked={r.boucle} onChange={(e) => onChange({ ...r, boucle: e.target.checked })} /> recommencer sans fin (jusqu’à l’arrêt)</label>
        </div>
      </div>
      <div className="mo-etape">
        <h4>2. les lampes concernées</h4>
        <SelecteurLampes lampes={lampes} choisies={piste.lampes} max={limites.lampes_par_piste} onChange={(l) => maj({ lampes: l })} />
      </div>
      <div className="mo-etape">
        <h4>3. la forme de la lumière</h4>
        <p className="rv-aide">Tire les points vers le haut pour plus de lumière. À gauche c’est le début, à droite la fin ({dureeLisible(r.duree_s)}). Touche le fond pour ajouter un point, double-clic pour en enlever un.</p>
        <CourbeEditeur titre="luminosité" points={piste.bri} duree={r.duree_s} lo={0} hi={BRI_MAX} max={limites.points} couleur="var(--gold)" pas={5}
          formatV={(v) => `${Math.round((v / BRI_MAX) * 100)} %`} curseur={lecture?.id === r.id ? lecture.t : null} onChange={(bri) => maj({ bri })} />
        <label className="rv-champ">lumière la plus forte ({maxPourcent(r)} %)
          <input type="range" min={1} max={100} value={maxPourcent(r)} onChange={(e) => onChange(reglerMax(r, Number(e.target.value)))} />
        </label>
      </div>
      <div className="mo-etape">
        <h4>4. la couleur de la lumière</h4>
        {k.length > 0
          ? (
            <div className="rv-grille">
              <label className="rv-champ">au début
                <select value={procheDe(k[0].v)} onChange={(e) => onChange(reglerCouleurs(r, Number(e.target.value), k[k.length - 1].v))}>{COULEURS.map((x) => <option key={x.k} value={x.k}>{x.nom}</option>)}</select>
              </label>
              <label className="rv-champ">à la fin
                <select value={procheDe(k[k.length - 1].v)} onChange={(e) => onChange(reglerCouleurs(r, k[0].v, Number(e.target.value)))}>{COULEURS.map((x) => <option key={x.k} value={x.k}>{x.nom}</option>)}</select>
              </label>
              <button type="button" className="btn sm" onClick={() => maj({ kelvin: [] })}>ne pas toucher à la couleur</button>
            </div>
          )
          : <button type="button" className="btn sm" onClick={() => onChange(reglerCouleurs(r, 2700, 4000))}>choisir la couleur de la lumière (aujourd’hui : celle des lampes)</button>}
      </div>
      <div className="as-apercu" aria-live="polite"><b>ce qui va se passer</b><p>{phraseRampe(r, noms)}</p></div>
      <h4 style={{ margin: '12px 0 6px' }}>voir l’effet (sans toucher aux lampes)</h4>
      <Apercu rampe={r} noms={noms} lecture={lecture} />
      {probleme && <p className="rv-note" role="status">pour enregistrer : {probleme}</p>}
    </Card>
  )
}
