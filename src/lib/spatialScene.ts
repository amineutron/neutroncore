// Rendu three.js du banc d'essai lumière : une pièce, ses appareils, leurs halos, leurs faisceaux et
// les taches qu'ils font au sol. Aucune décision ici : les couleurs et les niveaux viennent de
// lib/spatialFx.ts. Chargé seulement à l'ouverture du banc d'essai (import dynamique).
//
// Repère du calcul (cm, z = hauteur) -> repère de three (m, y = hauteur) : (x, y, z) -> (x, z, y).

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Fixture, Sortie, Vec3 } from './spatialFx'
import type { Venue } from './spatialVenues'

const M = 0.01
const v3 = (p: Vec3) => new THREE.Vector3(p[0] * M, p[2] * M, p[1] * M)
const HAUT = new THREE.Vector3(0, 1, 0)

type Appareil = {
  f: Fixture
  halo: THREE.Sprite
  tache: THREE.Mesh | null
  faisceau: THREE.Mesh | null
}

function textureHalo(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const d = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.25, 'rgba(255,255,255,0.55)'); d.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = d
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export class SpatialScene {
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400)
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private observer: ResizeObserver
  private lieu = new THREE.Group()
  private appareils: Appareil[] = []
  private halo = textureHalo()
  private source = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf6c177 }))
  private mobile = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: 0xeb6f92 }))
  private disposed = false
  private dims = { w: 1, h: 1, d: 1 }
  /** Le point source a été déplacé à la main : nouvelle place en pourcentage de la pièce (`zPct` null = hauteur inchangée). */
  onPlace: ((xPct: number | null, yPct: number | null, zPct: number | null) => void) | null = null
  // repères du point source : une tige jusqu'au sol, un anneau au sol, et une poignée au-dessus pour régler sa hauteur
  private tige = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), new THREE.LineBasicMaterial({ color: 0xf6c177, transparent: true, opacity: 0.55 }))
  private anneau = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), new THREE.MeshBasicMaterial({ color: 0xf6c177, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }))
  private poignee = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 14), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }))
  private taille = 0.1
  private prise: 'plan' | 'hauteur' | null = null

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.touchAction = 'none'
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.maxPolarAngle = Math.PI * 0.495        // on ne passe pas sous le sol
    this.anneau.rotation.x = -Math.PI / 2
    this.scene.add(this.lieu, this.source, this.mobile, this.tige, this.anneau, this.poignee)
    const el = this.renderer.domElement
    const rayonDe = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const rayon = new THREE.Raycaster()
      rayon.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera)
      return rayon
    }
    // three : x = largeur, z = profondeur, y = hauteur, en mètres -> pourcentage de la pièce, borné
    const pct = (v: number, taille: number, centre = true) => Math.round(Math.min(100, Math.max(0, (v / M / taille + (centre ? 0.5 : 0)) * 100)) * 10) / 10
    const surPlan = (rayon: THREE.Raycaster, hauteur: number) => rayon.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -hauteur), new THREE.Vector3())
    el.addEventListener('dblclick', (e) => {
      const sol = surPlan(rayonDe(e), 0)
      if (sol) this.onPlace?.(pct(sol.x, this.dims.w), pct(sol.z, this.dims.h), null)
    })
    // glisser la boule : elle suit le doigt à sa hauteur ; glisser la poignée au-dessus : elle monte ou descend
    el.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || e.button !== 0) return
      const rayon = rayonDe(e)
      const touche = (objet: THREE.Object3D, marge: number) => rayon.ray.distanceToPoint(objet.position) < this.taille * marge
      this.prise = touche(this.poignee, 1.6) ? 'hauteur' : touche(this.source, 2.2) ? 'plan' : null
      if (!this.prise) return
      this.controls.enabled = false
      try { el.setPointerCapture(e.pointerId) } catch { /* pointeur déjà relâché */ }
      e.stopPropagation()
    }, true)
    el.addEventListener('pointermove', (e) => {
      if (!this.prise) return
      const rayon = rayonDe(e)
      if (this.prise === 'plan') {
        const ici = surPlan(rayon, this.source.position.y)
        if (ici) this.onPlace?.(pct(ici.x, this.dims.w), pct(ici.z, this.dims.h), null)
      } else {
        // plan vertical face à la caméra, passant par la boule : la hauteur du doigt donne celle du point
        const face = new THREE.Vector3().subVectors(this.camera.position, this.source.position).setY(0).normalize()
        const ici = rayon.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(face, this.source.position), new THREE.Vector3())
        if (ici) this.onPlace?.(null, null, pct(ici.y - this.taille * 2.4, this.dims.d, false))
      }
    })
    const lacher = () => { if (this.prise) { this.prise = null; this.controls.enabled = true } }
    el.addEventListener('pointerup', lacher)
    el.addEventListener('pointercancel', lacher)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    this.resize()
  }

  private resize(): void {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** Construit la pièce et ses appareils, et cadre la vue dessus. */
  setVenue(venue: Venue): void {
    for (const o of [...this.lieu.children]) {
      this.lieu.remove(o)
      o.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((y) => y.dispose()) })
    }
    this.appareils = []
    const { w, h, d } = venue.dims
    this.dims = { w, h, d }
    // la boule se voit de loin : sa taille suit celle de la pièce
    this.taille = Math.max(0.09, Math.hypot(w, h, d) * M * 0.014)
    this.source.scale.setScalar(this.taille / 0.07)
    this.mobile.scale.setScalar((this.taille * 0.8) / 0.06)
    this.anneau.scale.setScalar(this.taille * 2.6)
    this.poignee.scale.setScalar(this.taille * 0.9)
    const W = w * M, H = h * M, D = d * M
    // sol sombre et quadrillé au mètre, arêtes de la pièce
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x0d090f }))
    sol.rotation.x = -Math.PI / 2
    const grille = new THREE.GridHelper(Math.max(W, H), Math.round(Math.max(W, H)), 0x2a2030, 0x1a141f)
    grille.position.y = 0.002
    const boite = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, D, H)), new THREE.LineBasicMaterial({ color: 0x3a2f42 }))
    boite.position.y = D / 2
    this.lieu.add(sol, grille, boite)

    const corps = new THREE.MeshBasicMaterial({ color: 0x2c2533 })
    for (const f of venue.fixtures) {
      const p = v3(f.pos)
      const taille = f.kind === 'barre' ? 0.05 : f.kind === 'lampe' ? 0.09 : 0.13
      const forme = f.kind === 'lampe' ? new THREE.SphereGeometry(taille, 12, 8) : new THREE.BoxGeometry(taille, taille, taille)
      const boitier = new THREE.Mesh(forme, corps)
      boitier.position.copy(p)
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.halo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))
      halo.position.copy(p)
      let tache: THREE.Mesh | null = null
      let faisceau: THREE.Mesh | null = null
      if (f.kind === 'lampe' || f.kind === 'par' || f.kind === 'projo') {
        tache = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))
        tache.rotation.x = -Math.PI / 2
        tache.position.set(p.x, 0.004, p.z)
      }
      if (f.kind === 'par' || f.kind === 'projo') {
        // cône ouvert, pointe à l'appareil : hauteur 1 le long de +Y, orienté et étiré à chaque image
        const cone = new THREE.CylinderGeometry(1, 0.04, 1, 20, 1, true)
        cone.translate(0, 0.5, 0)
        faisceau = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, side: THREE.DoubleSide }))
        faisceau.position.copy(p)
      }
      this.lieu.add(boitier, halo, ...(tache ? [tache] : []), ...(faisceau ? [faisceau] : []))
      this.appareils.push({ f, halo, tache, faisceau })
    }
    // vue de trois quarts, toute la pièce dans le cadre
    const portee = Math.hypot(W, H, D)
    this.controls.target.set(0, D * 0.35, 0)
    this.camera.position.set(W * 0.75, D * 0.9 + portee * 0.18, H * 0.95)
    this.controls.minDistance = portee * 0.15
    this.controls.maxDistance = portee * 3
    this.controls.update()
  }

  /** Une image : `sorties` dans l'ordre des appareils du lieu. `mobile` : la source qui tourne, si un effet en a une. */
  frame(sorties: Sortie[], source: Vec3, mobile: Vec3 | null): void {
    if (this.disposed) return
    this.source.position.copy(v3(source))
    const s = this.source.position
    this.tige.position.set(s.x, 0, s.z)
    this.tige.scale.set(1, Math.max(0.001, s.y), 1)
    this.anneau.position.set(s.x, 0.006, s.z)
    this.poignee.position.set(s.x, s.y + this.taille * 2.4, s.z)
    this.mobile.visible = mobile !== null
    if (mobile) this.mobile.position.copy(v3(mobile))
    const dir = new THREE.Vector3()
    this.appareils.forEach((a, i) => {
      const s = sorties[i]
      if (!s) return
      const n = s.niveau
      const haloMat = a.halo.material
      haloMat.color.setRGB(s.rgb[0], s.rgb[1], s.rgb[2])
      haloMat.opacity = Math.min(1, n * 1.15)
      const base = a.f.kind === 'barre' ? 0.42 : a.f.kind === 'strobe' ? 1.6 : 0.8
      a.halo.scale.setScalar(base * (0.35 + n * 0.9))
      const depuis = a.halo.position
      // où tombe la lumière : le faisceau part vers le point visé et continue jusqu'au sol ; sans visée, à l'aplomb
      const cible = s.vise ? v3(s.vise) : new THREE.Vector3(depuis.x, 0, depuis.z)
      cible.y = Math.max(0, Math.min(cible.y, depuis.y - 0.05))
      dir.subVectors(cible, depuis)
      const impact = cible.clone()
      if (dir.y < -1e-3) impact.copy(depuis).addScaledVector(dir, Math.min(depuis.y / -dir.y, 40))
      impact.y = 0
      const longueur = impact.distanceTo(depuis)
      if (a.tache) {
        const mat = a.tache.material as THREE.MeshBasicMaterial
        mat.color.setRGB(s.rgb[0], s.rgb[1], s.rgb[2])
        mat.opacity = n * (a.f.kind === 'lampe' ? 0.22 : 0.34)
        a.tache.scale.setScalar(a.f.kind === 'lampe' ? 0.5 + depuis.y * 0.35 : 0.35 + longueur * 0.16)
        a.tache.position.set(a.faisceau ? impact.x : depuis.x, 0.004, a.faisceau ? impact.z : depuis.z)
      }
      if (a.faisceau && longueur > 1e-3) {
        const mat = a.faisceau.material as THREE.MeshBasicMaterial
        mat.color.setRGB(s.rgb[0], s.rgb[1], s.rgb[2])
        mat.opacity = n * 0.2
        a.faisceau.quaternion.setFromUnitVectors(HAUT, dir.subVectors(impact, depuis).normalize())
        const rayon = 0.35 + longueur * 0.16
        a.faisceau.scale.set(rayon, longueur, rayon)
      }
    })
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.disposed = true
    this.observer.disconnect()
    this.controls.dispose()
    this.halo.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
