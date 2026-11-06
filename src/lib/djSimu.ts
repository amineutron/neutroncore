// DJ Light : un morceau simulé qui joue en boucle (intro, montée, drop, break ; 124 pulsations par minute ; la mineur puis
// do majeur). Même forme d'image que le moteur audio de l'API : sert au mode démo, à l'essai de l'écran sans musique, et
// aux tests des détecteurs. Logique pure : le temps est celui qu'on lui donne.
import type { ImageAudio } from './djSignaux'

export const BPM_SIMU = 124
const BOUCLE = 64                                   // pulsations
const PROG_LA = [[9, 0, 4], [5, 9, 0], [0, 4, 7], [7, 11, 2]]
const PROG_DO = [[0, 4, 7], [7, 11, 2], [9, 0, 4], [5, 9, 0]]

export const sectionDe = (b: number): 0 | 1 | 2 | 3 => (b < 16 ? 0 : b < 32 ? 1 : b < 48 ? 2 : 3)

/** Petit générateur pseudo-aléatoire reproductible (mulberry32). */
function hasard(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const cloche = (x: number, mu: number, sg: number): number => Math.exp(-(((x - mu) / sg) ** 2))

const kickJoue = (b: number): boolean => { const s = sectionDe(b); return s === 1 || s === 2 || (s === 0 && b >= 8) }
/** Une caisse claire tombe-t-elle sur cette double-croche (g = quart de temps entier) ? */
function caisseSur(g: number): boolean {
  const b = g / 4, s = sectionDe(b)
  if (s === 2) return g % 8 === 4
  if (s !== 1) return false
  if (b >= 28) return true
  if (b >= 24) return g % 2 === 0
  if (b >= 20) return g % 4 === 0
  return g % 8 === 4
}
const charlestonSur = (g: number): boolean => { const b = g / 4, s = sectionDe(b); return g % 2 === 0 && (s === 1 || s === 2 || (s === 0 && b >= 8)) }

export class Simulateur {
  private t = 0
  private beatAvant = -1
  private env = { kick: 0, snare: 0, hat: 0 }
  private lufsCourt = -22
  private spec = new Array<number>(96).fill(0)
  private readonly alea: () => number
  constructor(graine = 1, depart = 0) { this.alea = hasard(graine); this.t = depart }

  /** Le morceau avance de `dt` secondes : l'image correspondante. */
  suivant(dt: number): ImageAudio {
    this.t += dt
    const b = ((this.t * BPM_SIMU) / 60) % BOUCLE
    const s = sectionDe(b)
    // les attaques qui sont tombées depuis la dernière image
    const retour = this.beatAvant > b
    const g0 = this.beatAvant < 0 ? Math.floor(b * 4) : retour ? -1 : Math.floor(this.beatAvant * 4)
    const g1 = Math.floor(b * 4)
    let kick = false, snare = false, hat = false
    for (let g = g0 + 1; g <= g1; g++) {
      const gg = ((g % (BOUCLE * 4)) + BOUCLE * 4) % (BOUCLE * 4)
      if (gg % 4 === 0 && kickJoue(gg / 4)) kick = true
      if (caisseSur(gg)) snare = true
      if (charlestonSur(gg)) hat = true
    }
    this.beatAvant = b
    const f = { kick: kick ? (s === 2 ? 1 : 0.85) : 0, snare: snare ? 0.8 : 0, hat: hat ? 0.6 : 0 }
    this.env = {
      kick: Math.max(this.env.kick * Math.exp(-dt / 0.2), f.kick),
      snare: Math.max(this.env.snare * Math.exp(-dt / 0.14), f.snare),
      hat: Math.max(this.env.hat * Math.exp(-dt / 0.06), f.hat),
    }
    const lufsT = [-23 + (b / 16) * 2, -21 + ((b - 16) / 16) * 9, -8.5, -20][s]
    const lufs = lufsT + this.env.kick * 1.2
    this.lufsCourt += (lufsT - this.lufsCourt) * Math.min(1, dt / 1.5)
    const l01 = Math.min(1, Math.max(0, (lufs + 30) / 24))
    const warm = [0.72, 0.72 + (0.3 - 0.72) * ((b - 16) / 16), 0.5, 0.82][s]
    const bass = [0.3, 0.5, 0.95, 0.15][s] * (0.5 + 0.5 * this.env.kick)
    const accords = (s === 3 ? PROG_DO : PROG_LA)[Math.floor(b / 4) % 4]
    // spectre : chute en 1/f, bosses de grosse caisse, de caisse claire, de charleston, et les notes de l'accord
    const cible = Array.from({ length: 96 }, (_, i) => {
      const x = i / 95
      let v = (0.42 * (1 - x) ** 1.8 + 0.05) * (0.35 + 0.65 * l01)
      v += this.env.kick * 0.8 * cloche(x, 0.13, 0.07) + bass * 0.4 * cloche(x, 0.16, 0.09)
      v += this.env.snare * 0.7 * cloche(x, 0.5, 0.15) + this.env.hat * 0.65 * cloche(x, 0.88, 0.12)
      for (const pc of accords) for (const o of [0, 1]) {
        const hz = 440 * Math.pow(2, (48 + pc + o * 12 - 69) / 12)
        v += (o ? 0.24 : 0.36) * cloche(x, Math.log(hz / 30) / Math.log(16000 / 30), 0.018) * (0.5 + 0.5 * l01)
      }
      return Math.min(1, Math.max(0, v + (this.alea() - 0.5) * 0.05))
    })
    this.spec = cible.map((v, i) => (v > this.spec[i] ? v : this.spec[i] * 0.86 + v * 0.14))
    const pan = s === 3 ? 0 : Math.sin(b * 0.35) * 0.8
    const large = s === 2 ? 0.55 : s === 3 ? 0.35 : 0.22
    const amp = 0.25 + 0.7 * l01 * (0.55 + 0.45 * this.env.kick)
    const pts: [number, number][] = Array.from({ length: 48 }, () => {
      const g1 = (this.alea() + this.alea() + this.alea() - 1.5) * 0.9, g2 = (this.alea() + this.alea() + this.alea() - 1.5) * 0.9
      const gl = 1 - Math.max(0, pan) * 0.7, gr = 1 + Math.min(0, pan) * 0.7
      return [Math.round(127 * Math.max(-1, Math.min(1, (g1 + g2 * large) * amp * gl))), Math.round(127 * Math.max(-1, Math.min(1, (g1 - g2 * large) * amp * gr)))]
    })
    const wave = Array.from({ length: 128 }, (_, i) => Math.round(127 * Math.max(-1, Math.min(1, (this.env.kick * 0.7 * Math.sin(i * 0.09 + this.t * 9) + 0.35 * l01 * Math.sin(i * 0.27 + this.t * 4) + this.env.hat * 0.35 * (this.alea() - 0.5) * 2) * 0.45))))
    // la basse tient la tonique sous les accords (la en mineur, do pendant le break) : sans elle, la mineur et do majeur se confondent
    const tonique = s === 3 ? 0 : 9
    const chroma = Array.from({ length: 12 }, (_, i) => (i === tonique ? 1 : accords.includes(i) ? 0.55 + 0.35 * (1 - (b % 1) * 0.5) : 0.04 + this.alea() * 0.05))
    const montee = s === 1 ? (b - 16) / 16 : 0
    // niveaux relatifs des bandes : 0 = habituel, 1 = trois fois plus fort
    return {
      t: this.t,
      spec: this.spec.map((v) => Math.round(v * 255)),
      wave, pts,
      lufs: { m: lufs, s: this.lufsCourt },
      bandes: { sub: Math.min(1, bass * 0.9), basses: Math.min(1, bass * (0.8 + 0.4 * this.env.kick)), mediums: Math.min(1, 0.2 + this.env.snare * 0.6 + l01 * 0.2), aigus: Math.min(1, this.env.hat * 0.6 + montee * 0.4 + 0.05) },
      kick: { on: kick, v: f.kick }, snare: { on: snare, v: f.snare }, hat: { on: hat, v: f.hat },
      chroma,
      centroide: 250 * Math.pow(2, 4 * (1 - warm)),
      corr: 1 - large * 0.8,
      pan,
      silence: false,
    }
  }
}
