// God Eye : scène three.js du globe (terre éclairée par le vrai soleil, atmosphère, étoiles). Chargée à l'ouverture
// du mode 3D seulement. Aucune décision ici : la logique pure est dans lib/godeye/globe.ts.
import {
  AdditiveBlending, AmbientLight, BackSide, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight, Mesh,
  MeshStandardMaterial, PerspectiveCamera, Points, PointsMaterial, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three'
import { pointSphere, positionSoleil, visible } from './godeye/globe'
import { TERRE_DIXIEMES } from './vueMondeTerre'

export const FOV = 35

/** Planisphère équirectangulaire dessiné à partir des contours des terres : océan profond, terres éclairées sur la côte, graticule discret. */
export function fabriquerTexture(largeur = 2048): CanvasTexture {
  const w = largeur, h = largeur / 2
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const mer = ctx.createLinearGradient(0, 0, 0, h)
  mer.addColorStop(0, '#0b1d38'); mer.addColorStop(0.5, '#0a2342'); mer.addColorStop(1, '#0b1d38')
  ctx.fillStyle = mer
  ctx.fillRect(0, 0, w, h)
  const x = (lon: number) => ((lon + 180) / 360) * w
  const y = (lat: number) => ((90 - lat) / 180) * h
  ctx.strokeStyle = 'rgba(120,180,255,0.10)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let lon = -180; lon <= 180; lon += 15) { ctx.moveTo(x(lon), 0); ctx.lineTo(x(lon), h) }
  for (let lat = -75; lat <= 75; lat += 15) { ctx.moveTo(0, y(lat)); ctx.lineTo(w, y(lat)) }
  ctx.stroke()
  const terre = ctx.createLinearGradient(0, 0, 0, h)
  terre.addColorStop(0, '#2d5a52'); terre.addColorStop(0.45, '#3b6a55'); terre.addColorStop(0.7, '#4a6b4d'); terre.addColorStop(1, '#8fa3ad')
  ctx.beginPath()
  for (const r of TERRE_DIXIEMES) {
    for (let i = 0; i < r.length; i += 2) {
      const px = x(r[i] / 10), py = y(r[i + 1] / 10)
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
  }
  ctx.fillStyle = terre
  ctx.fill()
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

export class GlobeScene {
  readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 100)
  private readonly scene = new Scene()
  private readonly renderer: WebGLRenderer
  private readonly soleil = new DirectionalLight(0xffffff, 2.6)
  private readonly ambiante = new AmbientLight(0x6f8fc0, 0.55)
  private readonly texture: CanvasTexture
  private readonly v = new Vector3()
  private jourNuit = true
  camPos: [number, number, number] = [3, 0, 0]
  largeur = 1
  hauteur = 1

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setClearColor(new Color(0x000000), 0)
    this.texture = fabriquerTexture()
    const globe = new Mesh(
      new SphereGeometry(1, 96, 64),
      new MeshStandardMaterial({ map: this.texture, emissiveMap: this.texture, emissive: new Color(0xffffff), emissiveIntensity: 0.16, roughness: 0.92, metalness: 0 }),
    )
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
    this.scene.add(globe, atmosphere, new Points(etoiles, new PointsMaterial({ color: 0xcfe0ff, size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false })))
    this.scene.add(this.ambiante, this.soleil)
    this.majSoleil(new Date())
  }

  /** Éclaire la Terre depuis le soleil réel de `date` ; sans jour et nuit, une lumière fixe côté caméra. */
  majSoleil(date: Date): void {
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
