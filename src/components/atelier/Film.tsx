import { useEffect, useRef, useState } from 'react'
import { toast } from '../../lib/dialog'
import type { FilmOptions, FilmResult } from '../../lib/atelierDirector'
import type { Shot } from '../../lib/atelierFilm'
import type { ViewerHandle } from './Viewer'

type Tournage = { titre: string; canvas: HTMLCanvasElement | null; part: number }

const download = (href: string, name: string) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }

// Tournage d'une vidéo : la scène est pilotée plan par plan, et ce qui est filmé s'affiche en direct.
export function useFilm(viewer: React.RefObject<ViewerHandle | null>) {
  const [tournage, setTournage] = useState<Tournage | null>(null)
  const stop = useRef<AbortController | null>(null)
  // on quitte l'écran pendant un tournage : il s'arrête, rien n'est téléchargé
  useEffect(() => () => stop.current?.abort(), [])

  const start = async (titre: string, fichier: string, shots: Shot[], opts: Pick<FilmOptions, 'style' | 'poseOf'>) => {
    if (tournage || !viewer.current) return
    stop.current = new AbortController()
    setTournage({ titre, canvas: null, part: 0 })
    let r: FilmResult
    try {
      r = await viewer.current.film(shots, {
        ...opts, signal: stop.current.signal,
        onCanvas: (canvas) => { if (canvas) setTournage((t) => (t ? { ...t, canvas } : t)) },
        onProgress: (part) => setTournage((t) => (t && part - t.part > 0.01 ? { ...t, part } : t)),
      })
    } catch {
      r = { blob: null, raison: 'erreur' }
    } finally {
      setTournage(null)
    }
    if (r.raison === 'annule') return
    if (r.raison === 'occupe') { toast('la vue 3D charge encore : réessaie dans un instant', 'warn'); return }
    if (r.raison === 'erreur') { toast('le tournage s’est interrompu (les pièces ont changé en cours de route) : relance-le', 'crit'); return }
    if (!r.blob) { toast('ce navigateur ne sait pas enregistrer de vidéo', 'crit'); return }
    const url = URL.createObjectURL(r.blob)
    download(url, `${fichier}.${r.blob.type.includes('mp4') ? 'mp4' : 'webm'}`)
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
    toast('vidéo enregistrée dans les téléchargements')
  }
  return { tournage, start, cancel: () => stop.current?.abort() }
}

export function FilmOverlay({ tournage, onCancel }: { tournage: Tournage | null; onCancel: () => void }) {
  const actif = Boolean(tournage)
  // Échap annule ; le focus va sur « annuler » pour qu'on n'agisse pas derrière le voile au clavier
  useEffect(() => {
    if (!actif) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actif]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!tournage) return null
  return (
    <div className="at-film" role="dialog" aria-modal="true" aria-label={`Tournage : ${tournage.titre}`}>
      <div className="at-film-card">
        <b>tournage — {tournage.titre}</b>
        {/* la toile filmée elle-même : on voit exactement ce qui est enregistré */}
        <div className="at-film-vue" ref={(el) => { if (el && tournage.canvas && tournage.canvas.parentElement !== el) el.replaceChildren(tournage.canvas) }} />
        <div className="at-jauge" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(tournage.part * 100)}><i style={{ width: `${Math.round(tournage.part * 100)}%` }} /></div>
        <div className="at-row">
          <span className="au-note">Garde cet onglet au premier plan : la vidéo se tourne en temps réel.</span>
          <button type="button" className="btn sm" autoFocus onClick={onCancel}>annuler</button>
        </div>
      </div>
    </div>
  )
}
