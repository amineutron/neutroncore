import { useEffect, useRef, useState } from 'react'
import { apiBinary } from '../../lib/api'
import { mesureLabel, type Etats, type Piece, type Vec3 } from '../../lib/atelier'
import type { AtelierScene, Coupe } from '../../lib/atelierScene'
import { ViewerTools } from './ViewerTools'
import type { Cam, Shot } from '../../lib/atelierFilm'
import type { Boites } from '../../lib/atelierMontage'
import { recordFilm, type FilmOptions, type FilmResult } from '../../lib/atelierDirector'

export type ViewerHandle = {
  snapshot: () => string; describeView: () => string; frame: () => void
  orbit: (cam: Cam) => void
  thumbnails: (poses: { etats: Etats; cam: Cam; cible?: string[]; accent?: string[] }[], largeur?: number, hauteur?: number) => string[]
  film: (shots: Shot[], opts: FilmOptions) => Promise<FilmResult>
}

// Vue 3D : rotation (glisser), zoom (molette ou pincer), déplacement (clic droit ou deux doigts).
// Le composant ne décide rien : états, sélection et éclaté viennent de l'écran.
export function Viewer({ modele, iteration, pieces, maj, haut, onHaut, etats, selection, multi, explode, explodeAround, anim, speed, paused, onPick, onMulti, onExplode, onGeometry, onShowAll, exports, handle }: {
  modele: string; iteration: string; pieces: Piece[]; maj: number; haut: 'y' | 'z'; onHaut: (h: 'y' | 'z') => void; etats: Etats; selection: string[]; multi: boolean
  explode: number; explodeAround: boolean
  anim: Record<string, Vec3> | null; speed: number; paused: boolean       // geste de montage rejoué en boucle
  onGeometry: (boites: Boites) => void
  onPick: (nom: string | null, multi: boolean, at: { x: number; y: number }) => void
  onMulti: (on: boolean) => void; onExplode: (facteur: number, around: boolean) => void
  onShowAll: () => void; exports?: React.ReactNode      // boutons d'export, rangés avec les outils de la vue
  handle: React.RefObject<ViewerHandle | null>
}) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<AtelierScene | null>(null)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState<[number, number]>([0, 0])
  const [error, setError] = useState('')
  const [perime, setPerime] = useState(false)       // le code de la vue 3D est introuvable : la page date d'avant une mise à jour
  const [vue, setVue] = useState('iso')
  const [edges, setEdges] = useState(true)
  const [coupe, setCoupe] = useState<Coupe>(null)
  const [measuring, setMeasuring] = useState(false)
  const [points, setPoints] = useState<Vec3[]>([])
  const pick = useRef(onPick)
  pick.current = onPick
  const multiRef = useRef(multi)
  multiRef.current = multi
  const geometry = useRef(onGeometry)
  geometry.current = onGeometry

  // la scène three.js n'est chargée (et son code téléchargé) qu'ici
  useEffect(() => {
    let dead = false
    let created: AtelierScene | null = null
    void import('../../lib/atelierScene').then(({ AtelierScene: Scene }) => {
      if (dead || !host.current) return
      try {
        created = new Scene(host.current, { onPick: (n, m, at) => pick.current(n, m || multiRef.current, at), onMeasure: setPoints })
        scene.current = created
        setReady(true)
      } catch {
        setError('WebGL indisponible sur cet appareil : la vue 3D ne peut pas s’afficher.')
      }
    // le plus souvent : l'app a été reconstruite depuis l'ouverture de la page, et le fichier de la vue 3D
    // qu'elle connaît n'existe plus. Recharger prend la nouvelle version.
    }).catch(() => { if (!dead) { setError('La vue 3D n’a pas pu être chargée : l’app a sans doute été mise à jour depuis l’ouverture de cette page.'); setPerime(true) } })
    return () => { dead = true; created?.dispose(); scene.current = null }
  }, [])

  // chargement des pièces : à l'ouverture, au changement d'itération, ou quand le pipeline a réécrit les fichiers
  const key = `${modele}|${iteration}|${maj}|${haut}|${pieces.map((p) => p.chemin).join(',')}`
  const framed = useRef('')        // modèle|itération déjà cadré : une réécriture des fichiers ne touche pas au zoom
  useEffect(() => {
    const s = scene.current
    if (!ready || !s) return
    setError('')
    setProgress([0, pieces.length])
    const q = iteration === 'courant' ? '' : `&iteration=${encodeURIComponent(iteration)}`
    void s.load(pieces, (chemin) => apiBinary(`/modelisation/${modele}/fichier?chemin=${encodeURIComponent(chemin)}${q}`), (d, t) => setProgress([d, t]), haut)
      .then((centers) => {
        if (!centers) return
        geometry.current(s.bounds())
        if (Object.keys(centers).length === 0 && pieces.length > 0) setError('Aucune pièce n’a pu être lue.')
        const what = `${modele}|${iteration}|${haut}`
        if (framed.current !== what) s.frame([], framed.current === '' ? 'iso' : undefined)
        framed.current = what
      })
  }, [ready, key]) // eslint-disable-line react-hooks/exhaustive-deps

  // la scène garde états, sélection et éclaté : un chargement les réapplique lui-même, inutile de dépendre de sa progression
  useEffect(() => { scene.current?.setEtats(etats) }, [ready, etats])
  useEffect(() => { scene.current?.setSelection(selection) }, [ready, selection])
  useEffect(() => { scene.current?.setEdges(edges) }, [ready, edges])
  useEffect(() => { scene.current?.setCoupe(coupe) }, [ready, coupe])
  useEffect(() => { scene.current?.setMeasuring(measuring) }, [ready, measuring])
  useEffect(() => { scene.current?.setExplode(explode, explodeAround ? selection : []) }, [ready, explode, explodeAround, selection])
  useEffect(() => { scene.current?.setAnim(anim) }, [ready, anim])
  useEffect(() => { scene.current?.setAnimPlayback(speed, paused) }, [ready, anim, speed, paused])

  useEffect(() => {
    handle.current = {
      snapshot: () => scene.current?.snapshot() ?? '',
      describeView: () => [vue, coupe ? `coupe ${coupe.axe} ${Math.round(coupe.position * 100)} %` : '', explode > 0 ? `éclaté ${Math.round(explode * 100)} %` : ''].filter(Boolean).join(', '),
      frame: () => scene.current?.frame([]),
      orbit: (cam) => scene.current?.orbit(cam),
      thumbnails: (poses, largeur = 132, hauteur = 96) => scene.current?.thumbnails(poses, largeur, hauteur, '#1b141d') ?? [],
      film: (shots, opts) => (scene.current ? recordFilm(scene.current, shots, opts) : Promise.resolve({ blob: null, raison: 'incompatible' })),
    }
    return () => { handle.current = null }
  }, [handle, vue, coupe, explode])

  const loading = progress[1] > 0 && progress[0] < progress[1]
  const m = points.length === 2 ? mesureLabel(points[0], points[1]) : null

  return (
    <div className="at-viewer">
      <div className="at-canvas" ref={host} role="img" aria-label={`Vue 3D de ${modele}, ${pieces.length} pièces`} />
      {loading && <div className="at-loading">chargement des pièces… {progress[0]} / {progress[1]}</div>}
      {error && <div className="at-loading err">{error}{perime && <> <button type="button" className="btn sm solid" onClick={() => window.location.reload()}>recharger</button></>}</div>}
      {measuring && <div className="at-measure" role="status">{m ? <><b>{m.total}</b><span>{m.axes}</span></> : <span>touche {points.length === 0 ? 'un premier' : 'un second'} point sur une pièce</span>}</div>}

      <ViewerTools vue={vue} onVue={(v) => { setVue(v); scene.current?.frame(selection, v) }} onCadrer={() => scene.current?.frame(selection)}
        haut={haut} onHaut={onHaut} edges={edges} onEdges={setEdges} explode={explode} explodeAround={explodeAround} onExplode={onExplode}
        coupe={coupe} onCoupe={setCoupe} selection={selection} multi={multi} onMulti={onMulti} measuring={measuring} onMeasuring={setMeasuring}
        onShowAll={onShowAll} exports={exports} />
    </div>
  )
}
