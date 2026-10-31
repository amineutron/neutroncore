import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { apiGet, apiPost } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { couleursDe, type Scene } from '../../lib/spatialFx'
import { navigue, texteTempo } from '../../lib/spatialTele'
import './vuetele.css'

type Huebeat = { actif: boolean; silence?: boolean; bpm?: number }
type Etat = { scenes: Scene[]; huebeat: Huebeat; reel: { nom: string; pause?: boolean } | null }
type Jouer = (scene: Scene) => Promise<unknown>
const jouerParApi: Jouer = (scene) => apiPost('/spatial/direct', { scene })

const colonnes = () => (typeof window !== 'undefined' && window.innerWidth <= 700 ? 2 : 4)

/** Lumière 3d lisible à 3 m : scène en cours en très grand, ses couleurs, le tempo, et de gros boutons de scènes
 * qu'on parcourt à la télécommande (flèches, Entrée). Les données viennent de GET /spatial ; `onJouer` est
 * injectable (par défaut POST /spatial/direct, qui allume les vraies lampes). */
export function VueTele({ etat, onJouer = jouerParApi, pleinEcran = false }: { etat?: Etat; onJouer?: Jouer; pleinEcran?: boolean }) {
  const poll = usePoll<Etat>(() => apiGet('/spatial'), 2000, !etat)
  const e = etat ?? poll.data
  const [max, setMax] = useState(pleinEcran)
  const [foc, setFoc] = useState(0)
  const [msg, setMsg] = useState('')
  const grille = useRef<HTMLDivElement>(null)
  const scenes = e?.scenes ?? []
  const courante = scenes.find((s) => s.nom === e?.reel?.nom) ?? null
  const couleurs = courante ? couleursDe(courante) : []

  useEffect(() => {
    if (!max) return
    const f = (ev: globalThis.KeyboardEvent) => { if (ev.key === 'Escape') setMax(false) }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [max])

  const aller = (i: number) => {
    setFoc(i)
    grille.current?.querySelector<HTMLElement>(`[data-vt="${i}"]`)?.focus()
  }
  const touche = (ev: KeyboardEvent, i: number) => {
    if (!ev.key.startsWith('Arrow')) return
    ev.preventDefault()
    aller(navigue(i, ev.key, colonnes(), scenes.length))
  }
  const jouer = async (s: Scene) => {
    setMsg('')
    try {
      const r = await onJouer(s) as { success?: boolean; error?: string } | undefined
      if (r && r.success === false) setMsg(r.error ?? 'les lampes n’ont pas répondu')
    } catch (er) { setMsg((er as Error).message) }
  }

  if (!e) return <div className="card vt"><div className="vt-etat">chargement de la lumière…</div></div>
  const joue = Boolean(courante) && e.huebeat.actif
  return (
    <div className={`card vt ${max ? 'max' : ''}`}>
      <div className="vt-tete">
        <span className="vt-eyebrow">lumière 3d</span>
        <button type="button" className="btn sm vt-max" onClick={() => setMax((m) => !m)}>{max ? 'réduire' : 'plein écran'}</button>
      </div>
      <div className="vt-scene" aria-live="polite">
        <div className="vt-nom">{courante ? courante.nom : e.reel ? e.reel.nom : 'rien ne joue'}</div>
        <div className="vt-sous">{e.reel?.pause ? 'en pause' : texteTempo(e.huebeat.bpm, joue, e.huebeat.silence)}</div>
        {couleurs.length > 0 && (
          <div className="vt-couleurs" aria-hidden>
            {couleurs.map((c, i) => <span key={`${c}${i}`} style={{ background: c }} />)}
          </div>
        )}
      </div>
      <div className="vt-grille" ref={grille} role="group" aria-label="scènes">
        {scenes.map((s, i) => (
          <button key={s.id} type="button" data-vt={i} tabIndex={i === foc ? 0 : -1}
            className={`vt-btn ${s.nom === e.reel?.nom ? 'on' : ''}`}
            onFocus={() => setFoc(i)} onKeyDown={(ev) => touche(ev, i)} onClick={() => void jouer(s)}>
            <span className="vt-pastilles" aria-hidden>{couleursDe(s).slice(0, 4).map((c, k) => <i key={k} style={{ background: c }} />)}</span>
            {s.nom}
          </button>
        ))}
      </div>
      {msg && <div className="vt-err" role="status">{msg}</div>}
    </div>
  )
}
