import { NumField } from '../NumField'
import { CIBLES_COULEUR, CIBLES_MOD, MODES, infoCible, sortieDe, type Cible, type Couche, type ModeCouche } from '../../lib/djCouches'
import { SIGNAUX, SIGNAUX_INFO, type SignalId } from '../../lib/djSignaux'
import { EFFETS, PALETTES, type FxId, type Scene } from '../../lib/spatialFx'

const IMPULSIONS = SIGNAUX.filter((s) => SIGNAUX_INFO[s].genre === 'impulsion')
const CONTINUS = SIGNAUX.filter((s) => SIGNAUX_INFO[s].genre === 'continu')
const LISSAGE = (v: number): string => (v === 0 ? 'd’un coup' : v < 30 ? 'vif' : v < 65 ? 'doux' : 'très lent')
const SEUIL = (v: number): string => (v === 0 ? 'tout compte' : `au-delà de ${v} %`)

/** Les bornes que prennent `min` et `max` selon le mode : la plage de la cible, un écart autour de zéro, ou un pourcentage. */
export function plageDeSortie(cible: Cible, mode: ModeCouche): [number, number] {
  const { lo, hi } = infoCible(cible)
  if (mode === 'multiplie') return [0, 200]
  if (mode === 'ajoute') return [-(hi - lo), hi - lo]
  return [lo, hi]
}

type Props = {
  c: Couche
  scenes: Scene[]
  signal: number                                   // valeur lissée actuelle de son signal
  onChange: (patch: Partial<Couche>) => void
  onDupliquer: () => void
  onSupprimer: () => void
}

/** Le détail d'une rangée : ce qui la déclenche, ce qu'elle règle, dans quelle plage et avec quelle réactivité. */
export function CoucheEditeur({ c, scenes, signal, onChange, onDupliquer, onSupprimer }: Props) {
  const modulation = c.genre === 'modulation' || c.genre === 'couleur'
  const cibles = c.genre === 'couleur' ? CIBLES_COULEUR : CIBLES_MOD
  const [lo, hi] = c.cible ? plageDeSortie(c.cible, c.mode) : [0, 100]
  const sortie = sortieDe(c, signal).sortie
  const unite = c.cible ? (infoCible(c.cible).unite === '%' || c.mode === 'multiplie' ? ' %' : infoCible(c.cible).unite) : ''
  const changerCible = (cible: Cible) => {
    const i = infoCible(cible)
    onChange({ cible, fx: cible === 'effet' ? (c.fx ?? 'onde') : null, palettes: cible === 'palette' ? (c.palettes.length >= 2 ? c.palettes : ['cool', 'sunset']) : [],
      min: i.lo, max: i.hi, mode: 'remplace' })
  }
  const changerMode = (mode: ModeCouche) => {
    if (!c.cible) return
    const [a, b] = plageDeSortie(c.cible, mode)
    onChange({ mode, min: mode === 'ajoute' ? 0 : mode === 'multiplie' ? 50 : a, max: mode === 'ajoute' ? Math.round(b / 4) : mode === 'multiplie' ? 100 : b })
  }
  const basculerPalette = (id: string) => {
    const dedans = c.palettes.includes(id)
    const next = dedans ? c.palettes.filter((p) => p !== id) : [...c.palettes, id].slice(0, 4)
    if (next.length >= 2) onChange({ palettes: next })
  }
  return (
    <div className="dj-editeur">
      <label className="at-champ">nom
        <input className="bp-text" value={c.nom} maxLength={40} aria-label="Nom de la rangée" onChange={(e) => onChange({ nom: e.target.value })} />
      </label>

      {(modulation || c.genre === 'declencheur') && (
        <label className="at-champ">quand
          <select value={c.signal ?? ''} aria-label="Signal musical" onChange={(e) => onChange({ signal: e.target.value as SignalId })}>
            {c.genre !== 'declencheur' && <optgroup label="en continu">{CONTINUS.map((s) => <option key={s} value={s}>{SIGNAUX_INFO[s].label}</option>)}</optgroup>}
            <optgroup label="à chaque coup">{IMPULSIONS.map((s) => <option key={s} value={s}>{SIGNAUX_INFO[s].label}</option>)}</optgroup>
          </select>
        </label>
      )}
      {c.signal && (modulation || c.genre === 'declencheur') && <p className="dj-note">{SIGNAUX_INFO[c.signal].quoi}</p>}

      {c.genre === 'declencheur' && (<>
        <label className="at-champ">la scène qui prend le relais
          <select value={c.scene ?? ''} aria-label="Scène du déclencheur" onChange={(e) => onChange({ scene: e.target.value || null })}>
            <option value="">choisir une scène…</option>
            {scenes.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </label>
        {c.scene && !scenes.some((s) => s.id === c.scene) && <p className="chip warn">cette scène n’existe plus dans le pad</p>}
        <label className="at-champ">pendant
          <NumField value={c.mesures} min={1} max={32} label="Mesures" onCommit={(v) => onChange({ mesures: v })} /><em>mesure{c.mesures > 1 ? 's' : ''}</em>
        </label>
        <label className="dj-curseur">sensibilité du déclenchement <em>{SEUIL(c.seuil)}</em>
          <input type="range" min={0} max={95} value={c.seuil} aria-label="Seuil" onChange={(e) => onChange({ seuil: Number(e.target.value) })} />
        </label>
        <p className="dj-note">La scène prend la place de celle qui joue, avec ses couleurs, tant que la rangée est au-dessus d’elles dans la pile.</p>
      </>)}

      {modulation && (<>
        <label className="at-champ">règle
          <select value={c.cible ?? ''} aria-label="Réglage commandé" onChange={(e) => changerCible(e.target.value as Cible)}>
            {Object.entries(cibles).map(([id, i]) => <option key={id} value={id}>{i.label}</option>)}
          </select>
        </label>
        {c.cible && <p className="dj-note">{infoCible(c.cible).quoi}</p>}
        {c.cible === 'effet' && (
          <label className="at-champ">de l’effet
            <select value={c.fx ?? 'onde'} aria-label="Effet réglé" onChange={(e) => onChange({ fx: e.target.value as FxId })}>
              {EFFETS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
        )}
        {c.cible === 'palette' ? (
          <div>
            <p className="dj-note">Palettes (2 à 4), de la première (signal à 0) à la dernière (signal à 1) :</p>
            <div className="dj-palettes">
              {Object.entries(PALETTES).filter(([id]) => id !== 'arcenciel').map(([id, p]) => {
                const rang = c.palettes.indexOf(id)
                return (
                  <button key={id} type="button" className="dj-palette" aria-pressed={rang >= 0} onClick={() => basculerPalette(id)} title={p.label}>
                    <span style={{ background: `linear-gradient(90deg, ${p.couleurs.join(', ')})` }} /><i>{rang >= 0 ? `${rang + 1}. ` : ''}{p.label}</i>
                  </button>
                )
              })}
            </div>
          </div>
        ) : c.cible && (<>
          <div className="dj-modes" role="radiogroup" aria-label="Façon d’appliquer">
            {MODES.map((m) => <button key={m.id} type="button" role="radio" aria-checked={c.mode === m.id} className={`dj-mode b-${m.id} ${c.mode === m.id ? 'on' : ''}`} title={m.quoi} onClick={() => changerMode(m.id)}>{m.label}</button>)}
          </div>
          <p className="dj-note">{MODES.find((m) => m.id === c.mode)?.quoi}</p>
          <div className="dj-plage">
            <label>signal à 0 <NumField value={Math.round(c.min * 10) / 10} min={lo} max={hi} label="Valeur quand le signal est à 0" onCommit={(v) => onChange({ min: v })} /><em>{unite}</em></label>
            <label>signal à 1 <NumField value={Math.round(c.max * 10) / 10} min={lo} max={hi} label="Valeur quand le signal est à 1" onCommit={(v) => onChange({ max: v })} /><em>{unite}</em></label>
            <label className="dj-inverse"><input type="checkbox" checked={c.inverse} onChange={(e) => onChange({ inverse: e.target.checked })} />inverser</label>
          </div>
          <label className="dj-curseur">seuil du signal <em>{SEUIL(c.seuil)}</em>
            <input type="range" min={0} max={95} value={c.seuil} aria-label="Seuil" onChange={(e) => onChange({ seuil: Number(e.target.value) })} />
          </label>
          <p className="dj-note">En ce moment : signal {Math.round(signal * 100)} % donne {Math.round(sortie * 10) / 10}{unite}.</p>
        </>)}
        <label className="dj-curseur">réactivité <em>{LISSAGE(c.lissage)}</em>
          <input type="range" min={0} max={100} value={c.lissage} aria-label="Lissage" onChange={(e) => onChange({ lissage: Number(e.target.value) })} />
        </label>
      </>)}

      <div className="dj-actions">
        <button type="button" className="btn sm" onClick={onDupliquer}>dupliquer</button>
        <button type="button" className="btn sm danger" onClick={onSupprimer}>supprimer</button>
      </div>
    </div>
  )
}
