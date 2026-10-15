// Scène three.js de l'atelier 3D. Tout ce qui touche à WebGL est ici ; les décisions
// (quel état, quel éclaté, quelle sélection) viennent de lib/atelier.ts, testé à part.
// Ce module n'est chargé qu'à l'ouverture de l'écran (import dynamique).

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { centroid, explodeOffsets, type Etat, type Etats, type Groupe, type Vec3 } from './atelier'
import { slideAt, type Cam } from './atelierFilm'
import type { Boites } from './atelierMontage'

export type SceneCallbacks = {
  /** pièce touchée (null = le vide) ; `multi` si Ctrl, Maj ou Cmd était tenu */
  onPick: (nom: string | null, multi: boolean, at: { x: number; y: number }) => void
  /** points de mesure posés (0, 1 ou 2) */
  onMeasure: (points: Vec3[]) => void
}
export type Axe = 'x' | 'y' | 'z'
export type Coupe = { axe: Axe; position: number; inverse: boolean } | null
export const VUES: Record<string, Vec3> = {
  iso: [1, 0.7, 1.4], face: [0, 0, 1], dos: [0, 0, -1], gauche: [-1, 0, 0], droite: [1, 0, 0], dessus: [0, 1, 0.001], dessous: [0, -1, 0.001],
}

const PALETTES: Record<Groupe, number[]> = {
  pieces: [0xf6c177, 0xeb6f92, 0x9ccfd8, 0xc4a7e7],
  composants: [0x31748f, 0xe5484d, 0x8e4ec6, 0xf76b15, 0x12a594, 0x3e63dd, 0xd6409f, 0x46a758],
  gabarits: [0x9aa0a6],
}
const GHOST_OPACITY = 0.1
const SELECT_COLOR = 0xffffff
const TAP_MOVE = 6      // px : au-delà, c'est une rotation, pas un clic
const CYCLE = 2.8       // s : une boucle de l'animation d'un geste de montage, à vitesse 1
const ACCENT = 0x3a2a08 // lueur des pièces qu'un geste de montage pose

/** Ce que la scène montre à une image d'un film : tout est dicté, rien n'est gardé de l'image d'avant. */
export type Pose = { cam: Cam; explode: number; etats: Etats; offsets?: Record<string, Vec3>; accent?: string[]; cible?: string[] }

type Part = { nom: string; groupe: Groupe; mesh: THREE.Mesh; edges: THREE.LineSegments; material: THREE.MeshStandardMaterial; center: THREE.Vector3; color: number }

export class AtelierScene {
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(30, 1, 0.5, 8000)
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private root = new THREE.Group()
  private overlay = new THREE.Group()       // mesures, itération comparée
  private parts = new Map<string, Part>()
  private plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)
  private box = new THREE.Box3()
  private etats: Etats = {}
  private selection: string[] = []
  private coupe: Coupe = null
  private edgesOn = true
  private measuring = false
  private points: THREE.Vector3[] = []
  private down: { x: number; y: number } | null = null
  private raf = 0
  private dirty = true
  private observer: ResizeObserver
  private loadToken = 0
  private loader = new STLLoader()
  private explode: { facteur: number; autour: string[] } = { facteur: 0, autour: [] }
  private applied = new Map<string, string>()      // dernier réglage de matériau posé par pièce : on ne recompile que s'il change
  private offsets: Record<string, Vec3> = {}       // décalage d'éclaté de chaque pièce
  // geste de montage en boucle : les pièces partent de `depart` et glissent jusqu'à leur place
  private anim: { depart: Record<string, Vec3>; t: number; speed: number; paused: boolean } | null = null
  private accent = new Set<string>()
  private filming = false
  private loading = false
  private disposed = false

  constructor(private host: HTMLElement, private cb: SceneCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.localClippingEnabled = true
    host.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.touchAction = 'none'
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.screenSpacePanning = true
    this.controls.addEventListener('change', () => { this.dirty = true })
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3340, 1.5))
    const key = new THREE.DirectionalLight(0xffffff, 1.9)
    this.camera.add(key)
    this.scene.add(this.camera, this.root, this.overlay)
    const el = this.renderer.domElement
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointercancel', this.onCancel)
    // contexte perdu (app passée en arrière-plan sur téléphone) : three le restaure, il faut le laisser faire puis redessiner
    el.addEventListener('webglcontextlost', this.onLost)
    el.addEventListener('webglcontextrestored', this.onRestored)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    this.resize()
    this.loop(performance.now())
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.loadToken++
    this.observer.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointerup', this.onUp)
    el.removeEventListener('pointercancel', this.onCancel)
    el.removeEventListener('webglcontextlost', this.onLost)
    el.removeEventListener('webglcontextrestored', this.onRestored)
    this.clear()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()       // dispose() seul garde le contexte : les navigateurs en plafonnent le nombre
    el.remove()
  }

  get canvas(): HTMLCanvasElement { return this.renderer.domElement }

  private resize(): void {
    if (this.filming || this.disposed) return      // un film garde sa taille 16:9 ; endFilm rappelle resize
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  private last = 0
  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    if (this.filming) return        // un film dicte chaque image lui-même
    if (this.anim) {
      if (!this.anim.paused) this.anim.t += dt * this.anim.speed
      this.place(slideAt((this.anim.t % CYCLE) / CYCLE))
    }
    if (this.controls.update() || this.dirty) {
      this.dirty = false
      this.renderer.render(this.scene, this.camera)
    }
  }

  private clear(): void {
    for (const p of this.parts.values()) {
      p.mesh.geometry.dispose()
      p.edges.geometry.dispose()
      p.material.dispose();
      (p.edges.material as THREE.Material).dispose()
    }
    this.parts.clear()
    this.applied.clear()
    this.root.clear()
    this.clearOverlay()
  }

  private clearOverlay(): void {
    this.overlay.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.()
    })
    this.overlay.clear()
  }

  /** Charge un jeu de pièces. `fetchStl` rend le contenu binaire (authentifié par l'appelant).
   * Rend le centre de chaque pièce, ou null si un autre chargement a pris la place. */
  async load(pieces: { nom: string; groupe: Groupe; chemin: string }[], fetchStl: (chemin: string) => Promise<ArrayBuffer>,
    onProgress: (done: number, total: number) => void, haut: 'y' | 'z' = 'y'): Promise<Record<string, Vec3> | null> {
    const token = ++this.loadToken
    this.loading = true
    this.clear()
    this.points = []
    this.cb.onMeasure([])
    // couleur selon le rang de la pièce dans son groupe, pas selon l'ordre d'arrivée du réseau :
    // une pièce garde sa couleur d'un rechargement à l'autre
    const counters: Record<string, number> = {}
    const rank = new Map(pieces.map((p) => [p.nom, (counters[p.groupe] = (counters[p.groupe] ?? -1) + 1)]))
    let done = 0
    const failed: string[] = []
    await Promise.all(pieces.map(async (p) => {
      try {
        const geometry = this.loader.parse(await fetchStl(p.chemin))
        if (token !== this.loadToken) { geometry.dispose(); return }
        // modèle dessiné avec Z vers le haut (posé comme sur le plateau d'impression) : on le redresse une fois
        // pour toutes, dans la géométrie, pour que centres, boîtes, coupe et caméra parlent le même repère
        if (haut === 'z') geometry.rotateX(-Math.PI / 2)
        geometry.computeVertexNormals()
        geometry.computeBoundingBox()
        const palette = PALETTES[p.groupe]
        const color = palette[(rank.get(p.nom) ?? 0) % palette.length]
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: p.groupe === 'composants' ? 0.25 : 0.05, side: THREE.DoubleSide })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.name = p.nom
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), new THREE.LineBasicMaterial({ color: 0x0e0a10, transparent: true, opacity: 0.45 }))
        mesh.add(edges)
        this.root.add(mesh)
        this.parts.set(p.nom, { nom: p.nom, groupe: p.groupe, mesh, edges, material, center: geometry.boundingBox!.getCenter(new THREE.Vector3()), color })
      } catch {
        failed.push(p.nom)       // une pièce illisible n'empêche pas de voir les autres
      } finally {
        if (token === this.loadToken) onProgress(++done, pieces.length)
      }
    }))
    if (token !== this.loadToken) return null
    this.loading = false
    this.box = new THREE.Box3()
    for (const p of this.parts.values()) if (p.groupe !== 'gabarits') this.box.expandByObject(p.mesh)
    if (this.box.isEmpty()) for (const p of this.parts.values()) this.box.expandByObject(p.mesh)
    this.apply()
    this.setExplode(this.explode.facteur, this.explode.autour)      // les pièces neuves reprennent l'éclaté en place
    return Object.fromEntries([...this.parts.values()].map((p) => [p.nom, p.center.toArray() as Vec3]))
  }

  has(nom: string): boolean { return this.parts.has(nom) }

  // pendant un film, la scène est dictée image par image : un réglage qui arrive est gardé pour la fin du film
  setEtats(etats: Etats): void { if (this.avant) { this.avant.etats = etats; return } this.etats = etats; this.apply() }
  setSelection(selection: string[]): void { if (this.avant) { this.avant.selection = selection; return } this.selection = selection; this.apply() }
  setEdges(on: boolean): void { if (this.avant) { this.avant.edges = on; return } this.edgesOn = on; this.apply() }
  setCoupe(coupe: Coupe): void { this.coupe = coupe; this.apply() }

  setMeasuring(on: boolean): void {
    this.measuring = on
    if (!on) { this.points = []; this.clearOverlay(); this.cb.onMeasure([]) }
    this.dirty = true
  }

  /** Éclaté : `facteur` 0..2, autour du centre des pièces de `autour` (ou de l'ensemble). */
  setExplode(facteur: number, autour: string[]): void {
    this.explode = { facteur, autour }
    const centers = Object.fromEntries([...this.parts.values()].map((p) => [p.nom, p.center.toArray() as Vec3]))
    const origine = centroid(centers, autour) ?? (this.box.isEmpty() ? [0, 0, 0] as Vec3 : this.box.getCenter(new THREE.Vector3()).toArray() as Vec3)
    const offsets = explodeOffsets(centers, origine, facteur, autour, this.ecart())
    this.offsets = offsets
    if (!this.filming) this.place(this.anim ? slideAt((this.anim.t % CYCLE) / CYCLE) : 1)
  }

  /** Écart commun de l'éclaté : un cinquième de la plus grande dimension de l'objet. */
  private ecart(): number {
    if (this.box.isEmpty()) return 0
    const t = this.box.getSize(new THREE.Vector3())
    return Math.max(t.x, t.y, t.z) * 0.2
  }

  /** Pose chaque pièce : son décalage d'éclaté, plus ce qu'il lui reste à parcourir (`arrivee` 0 = au départ, 1 = en place). */
  private place(arrivee: number, depart: Record<string, Vec3> = this.anim?.depart ?? {}, eclate: Record<string, Vec3> = this.offsets): void {
    for (const p of this.parts.values()) {
      const e = eclate[p.nom] ?? [0, 0, 0], d = depart[p.nom]
      p.mesh.position.set(e[0] + (d ? d[0] * (1 - arrivee) : 0), e[1] + (d ? d[1] * (1 - arrivee) : 0), e[2] + (d ? d[2] * (1 - arrivee) : 0))
    }
    this.dirty = true
  }

  /** Geste de montage en boucle (null = arrêt, les pièces reviennent à leur place). */
  setAnim(depart: Record<string, Vec3> | null): void {
    this.anim = depart && Object.keys(depart).length > 0 ? { depart, t: 0, speed: this.anim?.speed ?? 1, paused: this.anim?.paused ?? false } : null
    if (this.filming) return        // endFilm reprend l'animation et son accent
    this.accent = new Set(depart ? Object.keys(depart) : [])
    this.place(this.anim ? 0 : 1)
    this.apply()
  }

  setAnimPlayback(speed: number, paused: boolean): void {
    if (this.anim) this.anim = { ...this.anim, speed, paused }
  }

  /** Boîte englobante de chaque pièce, à sa place (sans éclaté). */
  bounds(): Boites {
    return Object.fromEntries([...this.parts.values()].map((p) => {
      const b = p.mesh.geometry.boundingBox!
      return [p.nom, { min: b.min.toArray() as Vec3, max: b.max.toArray() as Vec3 }]
    }))
  }

  private apply(): void {
    const sel = new Set(this.selection)
    const planes = this.coupe ? [this.plane] : []
    if (this.coupe && !this.box.isEmpty()) {
      const i = { x: 0, y: 1, z: 2 }[this.coupe.axe]
      const min = this.box.min.getComponent(i), max = this.box.max.getComponent(i)
      const at = min + (max - min) * this.coupe.position
      const sign = this.coupe.inverse ? 1 : -1
      this.plane.normal.set(0, 0, 0).setComponent(i, sign)
      this.plane.constant = -sign * at
    }
    for (const p of this.parts.values()) {
      const etat: Etat = this.etats[p.nom] ?? 'shown'
      p.mesh.visible = etat !== 'hidden'
      const ghost = etat === 'ghost'
      p.material.transparent = ghost
      p.material.opacity = ghost ? GHOST_OPACITY : 1
      p.material.depthWrite = !ghost
      p.material.clippingPlanes = planes
      p.material.emissive.setHex(sel.has(p.nom) ? 0x553311 : this.accent.has(p.nom) ? ACCENT : 0x000000)
      // recompiler un matériau coûte : seulement quand la transparence ou le nombre de plans change (pas à chaque cran du curseur de coupe)
      const signature = `${ghost}|${planes.length}`
      const changed = this.applied.get(p.nom) !== signature
      if (changed) { this.applied.set(p.nom, signature); p.material.needsUpdate = true }
      p.mesh.renderOrder = ghost ? 2 : 1
      const line = p.edges.material as THREE.LineBasicMaterial
      p.edges.visible = this.edgesOn || ghost || sel.has(p.nom)
      // fantôme : arêtes à la couleur de la pièce, pour deviner sa silhouette sans la voir pleine
      line.color.setHex(sel.has(p.nom) ? SELECT_COLOR : ghost ? p.color : 0x0e0a10)
      line.opacity = sel.has(p.nom) ? 0.95 : ghost ? 0.5 : 0.45
      line.clippingPlanes = planes
      if (changed) line.needsUpdate = true
    }
    this.dirty = true
  }

  /** Cadre la caméra sur des pièces (ou sur tout) et fait tourner autour. `vue` : direction prédéfinie, sinon on garde l'angle actuel. */
  frame(noms: string[] = [], vue?: string): void {
    const target = new THREE.Box3()
    for (const n of noms) { const p = this.parts.get(n); if (p) target.expandByObject(p.mesh) }
    // sans cible : ce qui est visible, là où il est maintenant (un éclaté écarte les pièces)
    if (target.isEmpty()) for (const p of this.parts.values()) if (p.mesh.visible && p.groupe !== 'gabarits') target.expandByObject(p.mesh)
    const box = target.isEmpty() ? this.box : target
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const { radius, fit } = this.fitOf(box)
    const dir = vue && VUES[vue] ? new THREE.Vector3(...VUES[vue]) : this.camera.position.clone().sub(this.controls.target)
    if (dir.lengthSq() < 1e-6) dir.set(...VUES.iso)
    this.camera.position.copy(center).add(dir.normalize().multiplyScalar(fit * 1.15))
    this.camera.near = Math.max(0.1, fit / 200)
    this.camera.far = fit * 40
    this.camera.updateProjectionMatrix()
    this.controls.target.copy(center)
    this.controls.minDistance = radius * 0.15
    this.controls.maxDistance = fit * 12
    this.controls.update()
    this.dirty = true
  }

  private fitOf(box: THREE.Box3): { radius: number; fit: number } {
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 2)
    const fov = THREE.MathUtils.degToRad(this.camera.fov)
    return { radius, fit: radius / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect)) / 2) }
  }

  /** Caméra en orbite autour de l'objet entier : azimut, élévation, recul. Sans effet pendant un film. */
  /** Place la caméra en orbite ; `cible` : les pièces à cadrer (par défaut l'objet entier). */
  orbit(cam: Cam, cible: string[] = []): void { if (!this.filming) this.orbitNow(cam, cible) }

  private orbitNow(cam: Cam, cible: string[] = []): void {
    // `cible` : les pièces à cadrer, à leur place d'origine (sans éclaté) ; par défaut, l'objet entier
    const viser = new THREE.Box3()
    for (const n of cible) { const p = this.parts.get(n); if (p) viser.union(p.mesh.geometry.boundingBox!) }
    const box = viser.isEmpty() ? this.box : viser
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const { radius, fit } = this.fitOf(box)
    const az = THREE.MathUtils.degToRad(cam.az), el = THREE.MathUtils.degToRad(Math.max(-85, Math.min(85, cam.el)))
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
    const d = fit * 1.15 * cam.k
    this.camera.position.copy(center).add(dir.multiplyScalar(d))
    this.camera.near = Math.max(0.1, d / 200)
    this.camera.far = d * 40
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(center)
    this.controls.target.copy(center)
    this.controls.minDistance = radius * 0.15
    this.controls.maxDistance = fit * 12
    if (!this.filming) this.controls.update()
    this.dirty = true
  }

  // ---- films : la scène est pilotée image par image, puis rendue comme elle était ----

  private avant: { position: THREE.Vector3; target: THREE.Vector3; etats: Etats; selection: string[]; edges: boolean; near: number; far: number; min: number; max: number } | null = null

  /** Faux si un film tourne déjà ou si la scène n'est pas prête (chargement, scène détruite). */
  beginFilm(width: number, height: number): boolean {
    if (this.filming || this.loading || this.disposed || this.box.isEmpty()) return false
    this.avant = { position: this.camera.position.clone(), target: this.controls.target.clone(), etats: this.etats, selection: this.selection, edges: this.edgesOn,
      near: this.camera.near, far: this.camera.far, min: this.controls.minDistance, max: this.controls.maxDistance }
    this.overlay.visible = false       // les points de mesure ne sont pas dans le film
    this.filming = true
    this.controls.enabled = false
    this.selection = []
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    return true
  }

  filmFrame(pose: Pose): void {
    if (!this.filming || this.disposed) return
    this.etats = pose.etats
    this.accent = new Set(pose.accent ?? [])
    this.apply()
    const centers = Object.fromEntries([...this.parts.values()].map((p) => [p.nom, p.center.toArray() as Vec3]))
    const origine = centroid(centers, pose.cible ?? []) ?? (this.box.isEmpty() ? [0, 0, 0] as Vec3 : this.box.getCenter(new THREE.Vector3()).toArray() as Vec3)
    this.place(0, pose.offsets ?? {}, explodeOffsets(centers, origine, pose.explode, [], this.ecart()))
    this.orbitNow(pose.cam, pose.cible)
    this.renderer.render(this.scene, this.camera)
  }

  endFilm(): void {
    const a = this.avant
    this.avant = null
    this.filming = false
    if (this.disposed) return
    this.overlay.visible = true
    this.controls.enabled = true
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.resize()
    if (!a) return
    this.etats = a.etats; this.selection = a.selection; this.edgesOn = a.edges
    this.accent = new Set(this.anim ? Object.keys(this.anim.depart) : [])
    this.apply()
    this.place(this.anim ? slideAt((this.anim.t % CYCLE) / CYCLE) : 1)
    this.camera.position.copy(a.position)
    this.camera.near = a.near; this.camera.far = a.far
    this.camera.updateProjectionMatrix()
    this.controls.minDistance = a.min; this.controls.maxDistance = a.max
    this.controls.target.copy(a.target)
    this.controls.update()
    this.dirty = true
  }

  /** Une vignette par pose (les gestes du montage) : la vue en cours est rendue telle qu'elle était. */
  thumbnails(poses: { etats: Etats; cam: Cam; cible?: string[]; accent?: string[] }[], width: number, height: number, fond: string): string[] {
    const small = document.createElement('canvas')
    small.width = width; small.height = height
    const ctx = small.getContext('2d')
    if (!ctx) return []
    if (!this.beginFilm(width * 2, height * 2)) return []
    try {
      return poses.map((pose) => {
      this.filmFrame({ ...pose, explode: 0 })
      ctx.fillStyle = fond
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(this.renderer.domElement, 0, 0, width, height)
      return small.toDataURL('image/jpeg', 0.82)
      })
    } catch {
      return []
    } finally {
      this.endFilm()
    }
  }

  /** Image PNG de la vue (jointe à une demande, ou téléchargée). */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  // bouton principal et premier doigt seulement : un clic droit (déplacement) ou un pincement ne sélectionnent rien
  private onDown = (e: PointerEvent): void => { this.down = e.button === 0 && e.isPrimary ? { x: e.clientX, y: e.clientY } : null }
  private onCancel = (): void => { this.down = null }
  private onLost = (e: Event): void => { e.preventDefault() }
  private onRestored = (): void => { this.applied.clear(); this.apply() }

  private onUp = (e: PointerEvent): void => {
    const d = this.down
    this.down = null
    if (!d || e.button !== 0 || !e.isPrimary || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_MOVE) return
    const hit = this.pick(e.clientX, e.clientY)
    if (this.measuring) {
      if (!hit) return
      this.points = this.points.length >= 2 ? [hit.point] : [...this.points, hit.point]
      this.drawMeasure()
      this.cb.onMeasure(this.points.map((p) => p.toArray() as Vec3))
      return
    }
    this.cb.onPick(hit?.nom ?? null, e.ctrlKey || e.shiftKey || e.metaKey, { x: e.clientX, y: e.clientY })
  }

  /** Première pièce affichée sous le pointeur ; à défaut, une pièce fantôme. Une pièce cachée ou coupée ne se touche pas. */
  private pick(x: number, y: number): { nom: string; point: THREE.Vector3 } | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, this.camera)
    const meshes = [...this.parts.values()].filter((p) => p.mesh.visible).map((p) => p.mesh)
    const hits = ray.intersectObjects(meshes, false).filter((h) => !this.coupe || this.plane.distanceToPoint(h.point) >= 0)
    const solid = hits.find((h) => (this.etats[h.object.name] ?? 'shown') === 'shown') ?? hits[0]
    return solid ? { nom: solid.object.name, point: solid.point.clone() } : null
  }

  private drawMeasure(): void {
    this.clearOverlay()
    const size = Math.max(this.box.getSize(new THREE.Vector3()).length() / 220, 0.25)
    for (const p of this.points) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 12), new THREE.MeshBasicMaterial({ color: 0xeb6f92, depthTest: false }))
      dot.position.copy(p)
      dot.renderOrder = 10
      this.overlay.add(dot)
    }
    if (this.points.length === 2) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.points), new THREE.LineBasicMaterial({ color: 0xeb6f92, depthTest: false }))
      line.renderOrder = 10
      this.overlay.add(line)
    }
    this.dirty = true
  }
}
