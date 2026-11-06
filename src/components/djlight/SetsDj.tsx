import { useState } from 'react'
import { nouvelId, type FinPas, type PasDj, type Profil, type SetDj } from '../../lib/djCouches'
import { avancement, mesuresTotales, pasEnCours, type LectureSet } from '../../lib/djSet'
import type { Scene } from '../../lib/spatialFx'
import { confirmDialog } from '../../lib/dialog'
import { NumField } from '../NumField'

const MAX_SETS = 24, MAX_PAS = 64
const FINS: { id: FinPas; label: string; quoi: string }[] = [
  { id: 'mesures', label: 'après N mesures', quoi: 'Passe au pas suivant quand le nombre de mesures est écoulé.' },
  { id: 'drop', label: 'au prochain drop', quoi: 'Attend un drop (au moins une mesure avant) : la scène change sur le coup fort.' },
  { id: 'manuel', label: 'quand je le décide', quoi: 'Reste jusqu’à « suivant ».' },
]

type Props = {
  sets: SetDj[]
  scenes: Scene[]
  profils: Profil[]
  lecture: LectureSet | null
  beat: number
  onChange: (sets: SetDj[]) => void
  onLancer: (set: SetDj) => void
  onSuivant: () => void
  onPrecedent: () => void
  onArreter: () => void
}

/** Les sets : une suite de scènes (et de profils) qui s'enchaînent sur les mesures, sur un drop ou à la main. */
export function SetsDj({ sets, scenes, profils, lecture, beat, onChange, onLancer, onSuivant, onPrecedent, onArreter }: Props) {
  const [choisi, setChoisi] = useState<string | null>(null)
  const set = sets.find((s) => s.id === choisi) ?? sets[0]
  const joue = lecture && set && lecture.set === set.id
  const maj = (patch: Partial<SetDj>) => set && onChange(sets.map((s) => (s.id === set.id ? { ...s, ...patch } : s)))
  const majPas = (i: number, patch: Partial<PasDj>) => set && maj({ pas: set.pas.map((p, k) => (k === i ? { ...p, ...patch } : p)) })
  const nouveau = () => {
    if (sets.length >= MAX_SETS || scenes.length === 0) return
    const s: SetDj = { id: nouvelId(), nom: 'nouveau set', boucle: true, pas: [{ scene: scenes[0].id, profil: null, mesures: 8, fin: 'mesures' }] }
    onChange([...sets, s]); setChoisi(s.id)
  }
  const ajouterPas = () => set && set.pas.length < MAX_PAS && maj({ pas: [...set.pas, { scene: scenes[0]?.id ?? '', profil: null, mesures: 8, fin: 'mesures' }] })
  const deplacerPas = (i: number, sens: -1 | 1) => {
    if (!set || i + sens < 0 || i + sens >= set.pas.length) return
    const pas = [...set.pas]; [pas[i], pas[i + sens]] = [pas[i + sens], pas[i]]
    maj({ pas })
  }
  const supprimer = async () => {
    if (!set || !(await confirmDialog({ title: `supprimer le set « ${set.nom} » ?`, ok: 'supprimer', danger: true }))) return
    if (lecture?.set === set.id) onArreter()
    onChange(sets.filter((s) => s.id !== set.id)); setChoisi(null)
  }
  const nomDe = (id: string) => scenes.find((s) => s.id === id)?.nom ?? 'scène introuvable'

  return (
    <div className="dj-sets">
      <div className="dj-puces" role="radiogroup" aria-label="Set">
        {sets.map((s) => <button key={s.id} type="button" role="radio" aria-checked={s.id === set?.id} className="dj-puce" aria-pressed={s.id === set?.id} onClick={() => setChoisi(s.id)}>{lecture?.set === s.id ? '● ' : ''}{s.nom}</button>)}
        <button type="button" className="btn sm" onClick={nouveau} disabled={scenes.length === 0}>+ nouveau set</button>
      </div>
      {!set && <p className="dj-note">Un set enchaîne des scènes du pad : sur un nombre de mesures, au prochain drop, ou quand tu le décides. Crée-en un pour commencer.</p>}
      {set && (<>
        <div className="dj-ligne">
          <input className="bp-text" value={set.nom} maxLength={40} aria-label="Nom du set" onChange={(e) => maj({ nom: e.target.value })} />
          <label className="dj-inverse"><input type="checkbox" checked={set.boucle} onChange={(e) => maj({ boucle: e.target.checked })} />en boucle</label>
          <span className="dj-note">{set.pas.length} pas · {mesuresTotales(set)} mesures</span>
          <button type="button" className="btn sm danger" onClick={() => void supprimer()}>supprimer</button>
        </div>
        <ol className="dj-pas">
          {set.pas.map((p, i) => {
            const actuel = joue && lecture.index === i
            return (
              <li key={i} className={actuel ? 'en-cours' : ''}>
                <span className="dj-num">{i + 1}</span>
                <select value={p.scene} aria-label={`Scène du pas ${i + 1}`} onChange={(e) => majPas(i, { scene: e.target.value })}>
                  {!scenes.some((s) => s.id === p.scene) && <option value={p.scene}>{nomDe(p.scene)}</option>}
                  {scenes.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
                <select value={p.profil ?? ''} aria-label={`Profil du pas ${i + 1}`} onChange={(e) => majPas(i, { profil: e.target.value || null })}>
                  <option value="">profil en cours</option>
                  {profils.map((pr) => <option key={pr.id} value={pr.id}>profil : {pr.nom}</option>)}
                </select>
                <select value={p.fin} aria-label={`Fin du pas ${i + 1}`} title={FINS.find((f) => f.id === p.fin)?.quoi} onChange={(e) => majPas(i, { fin: e.target.value as FinPas })}>
                  {FINS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                {p.fin === 'mesures' ? <span className="dj-mes"><NumField value={p.mesures} min={1} max={64} label={`Mesures du pas ${i + 1}`} onCommit={(v) => majPas(i, { mesures: v })} /><em>mes.</em></span> : <span />}
                <span className="dj-ord2">
                  <button type="button" className="dj-ic" disabled={i === 0} aria-label="Monter le pas" onClick={() => deplacerPas(i, -1)}>▲</button>
                  <button type="button" className="dj-ic" disabled={i === set.pas.length - 1} aria-label="Descendre le pas" onClick={() => deplacerPas(i, 1)}>▼</button>
                  <button type="button" className="dj-ic" disabled={set.pas.length <= 1} aria-label="Retirer le pas" onClick={() => maj({ pas: set.pas.filter((_, k) => k !== i) })}>×</button>
                </span>
                {actuel && <div className="dj-barre dj-pas-barre"><i style={{ width: `${Math.round(avancement(set, lecture, beat) * 100)}%` }} /></div>}
              </li>
            )
          })}
        </ol>
        <div className="dj-ligne">
          <button type="button" className="btn sm" onClick={ajouterPas}>+ pas</button>
          {!joue
            ? <button type="button" className="btn solid" onClick={() => onLancer(set)}>lancer le set</button>
            : <>
              <button type="button" className="btn sm" onClick={onPrecedent}>précédent</button>
              <button type="button" className="btn sm solid" onClick={onSuivant}>suivant</button>
              <button type="button" className="btn sm" onClick={onArreter}>arrêter</button>
              <span className="dj-note">pas {lecture.index + 1} : {nomDe(pasEnCours(set, lecture)?.scene ?? '')}</span>
            </>}
        </div>
      </>)}
    </div>
  )
}
