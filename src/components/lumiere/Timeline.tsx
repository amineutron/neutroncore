import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { apiPut } from '../../lib/api'
import type { PasDeSet, Scene, SetDeScenes } from '../../lib/spatialFx'
import {
  ajouter, blocSousTete, deplacer, deplacerAuMesure, dureeTotale, elargir, mesureDepuisPx, positionTete, redimensionner,
  refus, sansScenesInconnues, supprimer, versBlocs,
} from '../../lib/spatialTimeline'
import './timeline.css'

const PX_MESURE = 36

type Geste = { mode: 'bouger' | 'etirer'; index: number; x0: number; dx: number }
type Sauver = (id: string, jeu: { nom: string; pas: PasDeSet[]; boucle: boolean }) => Promise<unknown>
const sauverParApi: Sauver = (id, jeu) => apiPut(`/spatial/sets/${id}`, { jeu })

/** Éditeur de set sur une ligne de temps : une mesure = une colonne, un bloc = une scène.
 * Glisser un bloc le déplace, tirer son bord droit change sa durée ; au clavier, flèches = déplacer,
 * Maj + flèches = durée, Suppr = retirer. `beat` (compteur de temps) fait avancer la tête de lecture ;
 * `onApercu(sceneId)` est appelée au survol, au focus et quand la tête change de bloc. */
export function Timeline({ scenes, set, beat = 0, onApercu, onSauver = sauverParApi, onSauve }: {
  scenes: Scene[]
  set: SetDeScenes | null            // null = nouveau set
  beat?: number
  onApercu?: (sceneId: string | null) => void
  onSauver?: Sauver                  // injectable : les tests et la démo n'écrivent rien
  onSauve?: (id: string) => void
}) {
  const connues = useMemo(() => new Set(scenes.map((s) => s.id)), [scenes])
  const nomDe = (id: string) => scenes.find((s) => s.id === id)?.nom ?? 'scène inconnue'
  const [pas, setPas] = useState<PasDeSet[]>(() => sansScenesInconnues(set?.pas ?? [], connues))
  const [nom, setNom] = useState(set?.nom ?? '')
  const [boucle, setBoucle] = useState(set?.boucle ?? true)
  const [sel, setSel] = useState<number | null>(null)
  const [geste, setGeste] = useState<Geste | null>(null)
  const [msg, setMsg] = useState('')
  const [survol, setSurvol] = useState(false)
  const gesteRef = useRef<Geste | null>(null)
  const dernierApercu = useRef<string | null>(null)

  useEffect(() => { setPas(sansScenesInconnues(set?.pas ?? [], connues)); setNom(set?.nom ?? ''); setBoucle(set?.boucle ?? true); setSel(null) }, [set?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const apercu = (id: string | null) => {
    if (dernierApercu.current === id) return
    dernierApercu.current = id
    onApercu?.(id)
  }
  // la tête de lecture montre la scène en cours, sauf quand on survole ou garde le focus sur un bloc
  const sous = blocSousTete(pas, beat, boucle)
  useEffect(() => { if (!survol && sel === null && beat > 0 && sous) apercu(sous.scene) }, [sous?.index, survol, sel, beat]) // eslint-disable-line react-hooks/exhaustive-deps

  const blocs = versBlocs(pas)
  const total = dureeTotale(pas)
  const tete = positionTete(pas, beat, boucle)

  // pendant un geste, le bloc suit le doigt (aperçu visuel) sans toucher au set avant le relâchement
  const dxMesures = geste ? (geste.mode === 'etirer' ? Math.round(geste.dx / PX_MESURE) : geste.dx / PX_MESURE) : 0
  const debutPointer = (e: PointerEvent, mode: Geste['mode'], index: number) => {
    e.preventDefault(); e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const g = { mode, index, x0: e.clientX, dx: 0 }
    gesteRef.current = g; setGeste(g); setSel(index)
  }
  const bougePointer = (e: PointerEvent) => {
    const g = gesteRef.current
    if (!g) return
    const n = { ...g, dx: e.clientX - g.x0 }
    gesteRef.current = n; setGeste(n)
  }
  const finPointer = () => {
    const g = gesteRef.current
    gesteRef.current = null; setGeste(null)
    if (!g || Math.abs(g.dx) < 3) return
    const b = blocs[g.index]
    if (g.mode === 'etirer') { setPas((p) => redimensionner(p, g.index, b.mesures + mesureDepuisPx(g.dx, PX_MESURE))); return }
    const cible = Math.max(0, b.debut + g.dx / PX_MESURE)
    const apres = deplacerAuMesure(pas, g.index, cible)
    setPas(apres)
    setSel(apres.findIndex((p, k) => p !== pas[k] && p === pas[g.index]))
  }

  const touche = (e: KeyboardEvent, i: number) => {
    const sens = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (sens) {
      e.preventDefault()
      if (e.shiftKey) setPas((p) => elargir(p, i, sens))
      else { setPas((p) => deplacer(p, i, i + sens)); setSel(Math.min(pas.length - 1, Math.max(0, i + sens))) }
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-tl-bloc="${Math.min(pas.length - 1, Math.max(0, e.shiftKey ? i : i + sens))}"]`)?.focus())
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); setPas((p) => supprimer(p, i)); setSel(null)
    }
  }

  const raison = pas.length === 0 ? '' : refus(pas, connues)
  const sauver = async () => {
    const r = refus(pas, connues)
    if (r) { setMsg(r); return }
    try {
      const id = set?.id ?? 'new'
      const res = await onSauver(id, { nom: nom.trim() || 'set sans nom', pas, boucle }) as { id?: string } | undefined
      setMsg('enregistré')
      onSauve?.(res?.id ?? id)
    } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <div className="tl">
      <div className="tl-top">
        <input className="tl-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="nom du set" aria-label="nom du set" maxLength={40} />
        <label className="tl-boucle"><input type="checkbox" checked={boucle} onChange={(e) => setBoucle(e.target.checked)} /> en boucle</label>
        <span className="lite">{total} mesures</span>
      </div>

      <div className="tl-scroll">
        <div className="tl-piste" style={{ width: Math.max(total, 8) * PX_MESURE }} onPointerLeave={() => { setSurvol(false) }}>
          <div className="tl-regle" aria-hidden>
            {Array.from({ length: Math.max(total, 8) }, (_, m) => <span key={m} style={{ left: m * PX_MESURE, width: PX_MESURE }}>{m + 1}</span>)}
          </div>
          {blocs.length === 0 && <div className="tl-vide">ajoute des scènes depuis le pad ci-dessous</div>}
          {blocs.map((b) => {
            const bouge = geste?.index === b.index
            const left = (b.debut + (bouge && geste.mode === 'bouger' ? dxMesures : 0)) * PX_MESURE
            const larg = Math.max(1, b.mesures + (bouge && geste.mode === 'etirer' ? dxMesures : 0)) * PX_MESURE
            return (
              <div key={b.index} data-tl-bloc={b.index} role="button" tabIndex={0}
                className={`tl-bloc ${sel === b.index ? 'sel' : ''} ${bouge ? 'bouge' : ''} ${sous?.index === b.index && beat > 0 ? 'joue' : ''}`}
                style={{ left, width: larg - 2 }}
                aria-label={`${nomDe(b.scene)}, ${b.mesures} mesures. Flèches : déplacer. Maj et flèches : durée. Suppr : retirer.`}
                onPointerDown={(e) => debutPointer(e, 'bouger', b.index)} onPointerMove={bougePointer} onPointerUp={finPointer} onPointerCancel={finPointer}
                onPointerEnter={() => { setSurvol(true); apercu(b.scene) }}
                onFocus={() => { setSel(b.index); apercu(b.scene) }} onBlur={() => setSel((s) => (s === b.index ? null : s))}
                onKeyDown={(e) => touche(e, b.index)}>
                <span className="tl-nom-bloc">{nomDe(b.scene)}</span>
                <span className="tl-dur">{b.mesures}</span>
                <span className="tl-poignee" aria-hidden onPointerDown={(e) => debutPointer(e, 'etirer', b.index)} onPointerMove={bougePointer} onPointerUp={finPointer} onPointerCancel={finPointer} />
                <button type="button" className="tl-x" aria-label={`retirer ${nomDe(b.scene)}`} onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => { setPas((p) => supprimer(p, b.index)); setSel(null) }}>x</button>
              </div>
            )
          })}
          {beat > 0 && total > 0 && <div className="tl-tete" style={{ left: tete * PX_MESURE }} aria-hidden />}
        </div>
      </div>

      <div className="tl-pad" role="group" aria-label="ajouter une scène">
        {scenes.map((s) => (
          <button key={s.id} type="button" className="btn sm" onPointerEnter={() => apercu(s.id)} onFocus={() => apercu(s.id)}
            onClick={() => setPas((p) => ajouter(p, s.id, sel === null ? undefined : sel + 1))}>+ {s.nom}</button>
        ))}
      </div>

      <div className="tl-bas">
        <button type="button" className="btn solid" disabled={pas.length === 0 || Boolean(raison)} onClick={() => void sauver()}>enregistrer le set</button>
        {(raison || msg) && <span className={raison ? 'tl-err' : 'lite'} role="status">{raison || msg}</span>}
      </div>
    </div>
  )
}
