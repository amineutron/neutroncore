import { composerPlanisphere } from '../components/godeye/dessinTuiles'
// God Eye : scène three.js du globe (terre éclairée par le vrai soleil, atmosphère, étoiles). Chargée à l'ouverture
// du mode 3D seulement. Aucune décision ici : la logique pure est dans lib/godeye/globe.ts.
import {
  AdditiveBlending, AmbientLight, BackSide, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight, Mesh,
  MeshStandardMaterial, PerspectiveCamera, Points, PointsMaterial, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three'
import { pointSphere, positionSoleil, visible } from './godeye/globe'
import { terresLegeres, type FondDetaille } from './godeye/fond'
import { lignesGrille, palette } from './godeye/apparence'
import { toileRelief } from './godeye/relief'

export const FOV = 35

export type ApparenceTexture = { quadrillage: boolean; pas: number; equateur: boolean; tropiques: boolean; texture: boolean; satellite: boolean }
export const APPARENCE_DEFAUT: ApparenceTexture = { quadrillage: true, pas: 15, equateur: false, tropiques: false, texture: true, satellite: false }

/** Planisphère équirectangulaire dessiné à partir des contours des terres : océan, terres, graticule discret ; fond uni sans texture, relief teinté en vue satellite. */
export function fabriquerTexture(largeur = 2048, fond: FondDetaille | null = null, o: ApparenceTexture = APPARENCE_DEFAUT): CanvasTexture {
  const w = largeur, h = largeur / 2
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const pal = palette(o.texture, o.satellite)
  const mer = ctx.createLinearGradient(0, 0, 0, h)
  mer.addColorStop(0, pal.mer[0]); mer.addColorStop(0.5, pal.mer[1]); mer.addColorStop(1, pal.mer[2])
  ctx.fillStyle = mer
  ctx.fillRect(0, 0, w, h)
  const x = (lon: number) => ((lon + 180) / 360) * w
  const y = (lat: number) => ((90 - lat) / 180) * h
  if (o.quadrillage) {
    const g = lignesGrille(o.pas, o)
    ctx.strokeStyle = 'rgba(120,180,255,0.10)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const lon of g.meridiens) { ctx.moveTo(x(lon), 0); ctx.lineTo(x(lon), h) }
    for (const lat of g.paralleles) { ctx.moveTo(0, y(lat)); ctx.lineTo(w, y(lat)) }
    ctx.stroke()
    if (g.speciales.length) {
      ctx.strokeStyle = 'rgba(246,193,119,0.4)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([14, 10])
      ctx.beginPath()
      for (const sp of g.speciales) { ctx.moveTo(0, y(sp.lat)); ctx.lineTo(w, y(sp.lat)) }
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
  ctx.beginPath()
  for (const l of fond ? fond.terres : terresLegeres()) {
    for (let i = 0; i < l.pts.length; i += 2) {
      const px = x(l.pts[i]), py = y(l.pts[i + 1])
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
  }
  if (pal.remplir) {
    const terre = ctx.createLinearGradient(0, 0, 0, h)
    terre.addColorStop(0, pal.terre[0]); terre.addColorStop(0.45, pal.terre[1]); terre.addColorStop(0.7, pal.terre[2]); terre.addColorStop(1, pal.terre[3])
    ctx.fillStyle = terre
    ctx.fill()
    if (pal.relief) { ctx.save(); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(toileRelief(), 0, 0, w, h); ctx.restore() }
  }
  ctx.shadowColor = 'rgba(111,231,255,0.55)'
  ctx.shadowBlur = 5
  ctx.strokeStyle = 'rgba(150,215,235,0.75)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

const VERT_ATMOSPHERE = 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
const FRAG_ATMOSPHERE = 'varying vec3 vN; void main(){ float i = pow(max(0.0, 0.74 - dot(vN, vec3(0.0, 0.0, 1.0))), 3.2); gl_FragColor = vec4(0.30, 0.62, 1.0, 1.0) * i * 0.7; }'

const VERT_NUIT = 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
const FRAG_NUIT = 'varying vec3 vP; uniform vec3 uSoleil; void main(){ float d = dot(normalize(vP), normalize(uSoleil)); float a = smoothstep(0.08, -0.2, d) * 0.5; gl_FragColor = vec4(0.01, 0.03, 0.09, a); }'

export class GlobeScene {
  readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 100)
  private readonly scene = new Scene()
  private readonly renderer: WebGLRenderer
  private readonly soleil = new DirectionalLight(0xffffff, 2.6)
  private readonly ambiante = new AmbientLight(0x6f8fc0, 0.55)
  private texture: CanvasTexture
  private readonly matiereTerre: MeshStandardMaterial
  private readonly largeurTexture: number
  private fondCourant: FondDetaille | null = null
  private apparence: ApparenceTexture = APPARENCE_DEFAUT
  private readonly voileNuit: Mesh
  private readonly matNuit: ShaderMaterial
  private readonly v = new Vector3()
  private jourNuit = true
  camPos: [number, number, number] = [3, 0, 0]
  largeur = 1
  hauteur = 1

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setClearColor(new Color(0x000000), 0)
    // 4096 px de large (11 px par degré) quand la carte graphique le permet : 2048 se voyait en gros pixels dès qu'on zoomait
    this.largeurTexture = this.renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048
    this.texture = fabriquerTexture(this.largeurTexture, null, this.apparence)
    this.matiereTerre = new MeshStandardMaterial({ map: this.texture, emissiveMap: this.texture, emissive: new Color(0xffffff), emissiveIntensity: 0.16, roughness: 0.92, metalness: 0 })
    this.texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    const globe = new Mesh(new SphereGeometry(1, 96, 64), this.matiereTerre)
    const atmosphere = new Mesh(
      new SphereGeometry(1.12, 64, 48),
      new ShaderMaterial({ vertexShader: VERT_ATMOSPHERE, fragmentShader: FRAG_ATMOSPHERE, side: BackSide, blending: AdditiveBlending, transparent: true, depthWrite: false }),
    )
    const etoiles = new BufferGeometry()
    const n = 1100
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u)
      pos.set([r * Math.cos(a) * 40, u * 40, r * Math.sin(a) * 40], i * 3)
    }
    etoiles.setAttribute('position', new BufferAttribute(pos, 3))
    this.matNuit = new ShaderMaterial({
      vertexShader: VERT_NUIT, fragmentShader: FRAG_NUIT, transparent: true, depthWrite: false, uniforms: { uSoleil: { value: new Vector3(1, 0, 0) } },
    })
    this.voileNuit = new Mesh(new SphereGeometry(1.004, 96, 64), this.matNuit)
    this.scene.add(globe, this.voileNuit, atmosphere, new Points(etoiles, new PointsMaterial({ color: 0xcfe0ff, size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false })))
    this.scene.add(this.ambiante, this.soleil)
    this.majSoleil(new Date())
  }

  /** Remplace la texture par une refaite avec les contours détaillés (côtes à 50 m), une fois ceux-ci chargés. */
  majFond(fond: FondDetaille): void {
    this.fondCourant = fond
    this.refaireTexture()
  }
  /** Quadrillage, texture et vue satellite : tout est dans la texture, refaite seulement si un réglage change. */
  reglerApparence(o: ApparenceTexture): void {
    const a = this.apparence
    if (a.quadrillage === o.quadrillage && a.pas === o.pas && a.equateur === o.equateur && a.tropiques === o.tropiques && a.texture === o.texture && a.satellite === o.satellite) return
    this.apparence = o
    this.refaireTexture()
  }
  /** Voile sombre sur la face nuit de la Terre (soleil réel, indépendant de l'éclairage). */
  reglerNuit(actif: boolean): void { this.voileNuit.visible = actif }
  private refaireTexture(): void {
    const ancienne = this.texture
    this.texture = fabriquerTexture(this.largeurTexture, this.fondCourant, this.apparence)
    this.texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    this.matiereTerre.map = this.texture
    this.matiereTerre.emissiveMap = this.texture
    this.matiereTerre.needsUpdate = true
    ancienne.dispose()
    this.poserImagerie()
  }

  /** Vue satellite : les tuiles du niveau 3 sont posées sur la texture au fil de leur arrivée ; le fond fabriqué reste dessous. */
  private poserImagerie(): void {
    const a = this.apparence
    if (!a.satellite || !a.texture) return
    const t = this.texture
    const c = t.image as HTMLCanvasElement
    const ctx = c.getContext('2d')
    if (!ctx) return
    composerPlanisphere(ctx, c.width, c.height, 3, () => { if (this.texture === t) t.needsUpdate = true }).catch(() => { /* fond fabriqué conservé */ })
  }

  /** Éclaire la Terre depuis le soleil réel de `date` ; sans jour et nuit, une lumière fixe côté caméra. */
  majSoleil(date: Date): void {
    const sr = positionSoleil(date)
    const pr = pointSphere(sr.lat, sr.lon)
    this.matNuit.uniforms.uSoleil.value.set(pr[0], pr[1], pr[2])
    if (this.jourNuit) {
      const s = positionSoleil(date)
      const p = pointSphere(s.lat, s.lon)
      this.soleil.position.set(p[0] * 10, p[1] * 10, p[2] * 10)
    }
  }
  reglerJourNuit(actif: boolean): void {
    this.jourNuit = actif
    this.soleil.intensity = actif ? 2.6 : 1.7
    this.ambiante.intensity = actif ? 0.55 : 1.15
    if (!actif) this.soleil.position.set(this.camPos[0] * 3, this.camPos[1] * 3 + 4, this.camPos[2] * 3)
    else this.majSoleil(new Date())
  }

  redimensionner(w: number, h: number): void {
    this.largeur = Math.max(1, w); this.hauteur = Math.max(1, h)
    this.renderer.setSize(this.largeur, this.hauteur, false)
    this.camera.aspect = this.largeur / this.hauteur
    this.camera.updateProjectionMatrix()
  }

  /** Cadre la Terre : centre (lat, lon) en degrés, distance de la caméra au centre de la sphère. */
  cadrer(lat: number, lon: number, dist: number): void {
    const p = pointSphere(Math.max(-85, Math.min(85, lat)), lon)
    this.camPos = [p[0] * dist, p[1] * dist, p[2] * dist]
    this.camera.position.set(...this.camPos)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()
    if (!this.jourNuit) this.soleil.position.set(this.camPos[0] * 3, this.camPos[1] * 3 + 4, this.camPos[2] * 3)
  }

  /** Position écran (pixels) d'un point de la surface, ou null s'il est derrière l'horizon. */
  projeter(lat: number, lon: number, hauteurRelative = 0): { x: number; y: number } | null {
    const p = pointSphere(lat, lon)
    const k = 1 + hauteurRelative
    if (!visible(p, this.camPos)) return null
    this.v.set(p[0] * k, p[1] * k, p[2] * k).project(this.camera)
    return { x: (this.v.x * 0.5 + 0.5) * this.largeur, y: (-this.v.y * 0.5 + 0.5) * this.hauteur }
  }

  rendre(): void { this.renderer.render(this.scene, this.camera) }

  liberer(): void {
    this.texture.dispose()
    this.scene.traverse((o) => {
      const m = o as Mesh
      m.geometry?.dispose?.()
      const mat = m.material as { dispose?: () => void } | undefined
      mat?.dispose?.()
    })
    this.renderer.dispose()
  }
}
