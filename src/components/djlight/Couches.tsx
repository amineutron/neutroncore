import { useEffect, useRef, useState } from 'react'
import { conflits, deplacer, nouvelId, nouvelleCouche, phrase, MAX_COUCHES, type Couche, type Genre } from '../../lib/djCouches'
import type { Scene } from '../../lib/spatialFx'
import { confirmDialog } from '../../lib/dialog'
import { CoucheEditeur } from './CoucheEditeur'

const UP = <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M2 8l4-4 4 4" /></svg>
const DOWN = <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M2 4l4 4 4-4" /></svg>
const ETIQUETTE: Record<Genre, string> = { scene: 'scène', couleurs: 'couleurs', modulation: 'réglage', couleur: 'couleur', declencheur: 'déclencheur' }
const MODE_CLASSE = (c: Couche): string => (c.genre === 'scene' || c.genre === 'couleurs' ? 'base' : c.genre === 'declencheur' ? 'remplace' : c.genre === 'couleur' && c.cible === 'palette' ? 'palette' : c.mode)
const MODE_TEXTE = (c: Couche): string => (c.genre === 'scene' || c.genre === 'couleurs' ? 'base' : c.genre === 'declencheur' ? 'scène' : c.cible === 'palette' ? 'palette' : c.mode)

type Props = {
  couches: Couche[]
  scenes: Scene[]
  acts: () => Record<string, number>               // activité de chaque rangée, lue en direct
  valeurs: () => Record<string, number>            // signal lissé de chaque rangée
  onChange: (couches: Couche[]) => void
}

/** La pile de couches : la plus prioritaire en haut. Chaque rangée s'active, s'isole, se dose, se déplace et se règle. */
export function Couches({ couches, scenes, acts, valeurs, onChange }: Props) {
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [mesures, setMesures] = useState<Record<string, number>>({})
  const [vals, setVals] = useState<Record<string, number>>({})
  // l'activité se relève dix fois par seconde, sans repasser par l'état de l'écran
  useIntervalle(() => { setMesures(acts()); setVals(valeurs()) }, 100)
  const recouvertes = conflits(couches)
  const maj = (id: string, patch: Partial<Couche>) => onChange(couches.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const ajouter = (genre: Genre) => {
    if (couches.length >= MAX_COUCHES) return
    const c = nouvelleCouche(genre, genre === 'declencheur' ? { signal: 'drop', scene: scenes[0]?.id ?? null, seuil: 30, lissage: 0 }
      : genre === 'couleur' ? { signal: 'chaleur', cible: 'chaleur', min: -40, max: 40 }
      : { signal: 'volume', cible: 'general', mode: 'multiplie', min: 50, max: 100 })
    onChange([c, ...couches])
    setOuverte(c.id)
  }
  const dupliquer = (c: Couche) => {
    const i = couches.findIndex((x) => x.id === c.id)
    if (couches.length >= MAX_COUCHES || i < 0) return
    const copie = { ...c, id: nouvelId(), nom: `${c.nom} (copie)`, palettes: [...c.palettes] }
    onChange([...couches.slice(0, i), copie, ...couches.slice(i)])
    setOuverte(copie.id)
  }
  const supprimer = async (c: Couche) => {
    if (!(await confirmDialog({ title: `supprimer « ${c.nom} » ?`, ok: 'supprimer', danger: true }))) return
    onChange(couches.filter((x) => x.id !== c.id))
  }

  return (
    <div>
      <div className="dj-ajout">
        <span className="dj-note">Haut de la pile = plus prioritaire.</span>
        <button type="button" className="btn sm" onClick={() => ajouter('modulation')}>+ réglage</button>
        <button type="button" className="btn sm" onClick={() => ajouter('couleur')}>+ couleur</button>
        <button type="button" className="btn sm" onClick={() => ajouter('declencheur')}>+ déclencheur</button>
      </div>
      <ul className="dj-pile">
        {couches.map((c, i) => {
          const base = c.genre === 'scene' || c.genre === 'couleurs'
          const dessus = recouvertes[c.id] ? couches.find((x) => x.id === recouvertes[c.id])?.nom : undefined
          const ouvert = ouverte === c.id
          return (
            <li key={c.id} className={`dj-couche ${c.actif ? '' : 'off'} ${base ? 'base' : ''}`}>
              <div className="dj-rang">
                <div className="dj-ord">
                  <button type="button" className="dj-ic" disabled={i === 0} aria-label={`Monter ${c.nom} : plus prioritaire`} onClick={() => onChange(deplacer(couches, c.id, -1))}>{UP}</button>
                  <span className="dj-num">{i + 1}</span>
                  <button type="button" className="dj-ic" disabled={i === couches.length - 1} aria-label={`Descendre ${c.nom} : moins prioritaire`} onClick={() => onChange(deplacer(couches, c.id, 1))}>{DOWN}</button>
                </div>
                {base
                  ? <span className="dj-verrou" title="Toujours jouée : place-la plus haut ou plus bas pour décider qui l’emporte">fixe</span>
                  : <button type="button" className="dj-sw" role="switch" aria-checked={c.actif} aria-label={`Activer ${c.nom}`} onClick={() => maj(c.id, { actif: !c.actif })} />}
                <button type="button" className="dj-nom" aria-expanded={ouvert} onClick={() => setOuverte(ouvert ? null : c.id)}>
                  <b>{c.nom}</b>
                  <span>{phrase(c, scenes)}</span>
                  {dessus && <em className="dj-recouvert">recouverte par « {dessus} » sur le même réglage</em>}
                </button>
                <span className="dj-genre">{ETIQUETTE[c.genre]}</span>
                <span className={`dj-mode-pastille b-${MODE_CLASSE(c)}`}>{MODE_TEXTE(c)}</span>
                {!base && (
                  <label className="dj-force" title="À quel point la rangée agit">
                    <input type="range" min={0} max={100} value={c.force} aria-label={`Force de ${c.nom}`} onChange={(e) => maj(c.id, { force: Number(e.target.value) })} />
                    <output>{c.force}</output>
                  </label>
                )}
                <div className="dj-meter" aria-hidden><i style={{ width: `${Math.round(Math.min(1, Math.max(0, mesures[c.id] ?? 0)) * 100)}%` }} /></div>
                {!base && <button type="button" className="dj-solo" aria-pressed={c.solo} title="Joue cette rangée seule, avec la scène" onClick={() => maj(c.id, { solo: !c.solo })}>solo</button>}
              </div>
              {ouvert && !base && <CoucheEditeur c={c} scenes={scenes} signal={vals[c.id] ?? 0} onChange={(p) => maj(c.id, p)} onDupliquer={() => dupliquer(c)} onSupprimer={() => void supprimer(c)} />}
              {ouvert && base && <p className="dj-note dj-base-note">{c.genre === 'scene'
                ? 'La scène fixe l’intensité et le point source. Toute rangée placée au-dessous qui règle ces valeurs est recouverte ; au-dessus, elle les module.'
                : 'La palette de la scène fixe les couleurs. Les rangées de couleur placées au-dessous (teinte, chaleur, choix de palette) sont recouvertes ; au-dessus, elles les transforment.'}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function useIntervalle(f: () => void, ms: number): void {
  const ref = useRef(f)
  ref.current = f
  useEffect(() => { const id = window.setInterval(() => ref.current(), ms); return () => window.clearInterval(id) }, [ms])
}
