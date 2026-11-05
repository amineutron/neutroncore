// DJ Light : le dessin des analyseurs (spectre, spectrogramme, forme d'onde, oscilloscope, vectoroscope, volume).
// Fonctions de dessin seulement : chacune reçoit un contexte déjà mis à l'échelle (pixels CSS) et une image du moteur audio.
// Les deux analyseurs qui défilent (spectrogramme et forme d'onde) travaillent en pixels de l'écran et reçoivent le canvas.
import type { ImageAudio } from './djSignaux'
import { clamp01 } from './djSignaux'

export const COULEURS = { fond: '#171019', ligne: '#2e2331', texte: '#9c8ea6', or: '#f6c177', rose: '#eb6f92', iris: '#c4a7e7', ecume: '#9cd0d8', clair: '#ece5ee' }
const MONO = '10px JBM, ui-monospace, monospace'
export const NOTES_ANGLAIS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const CHALEUR: [number, [number, number, number]][] = [[0, [10, 6, 20]], [0.25, [62, 20, 92]], [0.5, [170, 44, 122]], [0.75, [246, 193, 119]], [1, [255, 250, 236]]]
/** Couleur de chaleur d'un niveau 0..1 : noir, violet, magenta, or, blanc. */
export function chaleur(v: number): string {
  const x = clamp01(v)
  for (let i = 1; i < CHALEUR.length; i++) {
    if (x <= CHALEUR[i][0]) {
      const [a, ca] = CHALEUR[i - 1], [b, cb] = CHALEUR[i], t = (x - a) / (b - a)
      return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * t)},${Math.round(ca[1] + (cb[1] - ca[1]) * t)},${Math.round(ca[2] + (cb[2] - ca[2]) * t)})`
    }
  }
  return 'rgb(255,250,236)'
}

/** Fréquence (Hz) de la bande `i` sur 96, de 30 Hz à 16 kHz, en échelle logarithmique. */
export const frequenceDeBande = (i: number): number => 30 * Math.pow(16000 / 30, i / 95)

/** Note la plus proche d'une fréquence : nom, octave et écart en centièmes de ton. */
export function noteDe(hz: number): { nom: string; ecart: number } {
  const n = 12 * Math.log2(hz / 440) + 69, r = Math.round(n)
  return { nom: `${NOTES_ANGLAIS[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`, ecart: Math.round((n - r) * 100) }
}

/** La bande la plus forte entre 40 Hz et ~3 kHz et ce qu'elle dit : « -19,8 dB | 111 Hz | A2 +23 cents ». */
export function lecturePic(spec: number[]): string {
  let pic = 3
  for (let i = 3; i < 62; i++) if (spec[i] > spec[pic]) pic = i
  const hz = frequenceDeBande(pic), { nom, ecart } = noteDe(hz)
  const db = (-80 + (80 * (spec[pic] ?? 0)) / 255).toFixed(1)
  return `${db} dB | ${Math.round(hz)} Hz | ${nom} ${ecart >= 0 ? '+' : ''}${ecart} cents`
}

/** Couleur d'une tranche de forme d'onde : graves en rose, médiums en or, aigus en bleu, d'après les niveaux de l'image. */
export function couleurDeTranche(img: ImageAudio): string {
  const grave = img.bandes.sub * 0.6 + img.bandes.basses + (img.kick.on ? 1 : 0), aigu = img.bandes.aigus + (img.hat.on ? 0.6 : 0), moyen = img.bandes.mediums + 0.2 + (img.snare.on ? 0.6 : 0)
  const t = grave + moyen + aigu || 1
  return `rgb(${Math.round((grave * 235 + moyen * 246 + aigu * 156) / t)},${Math.round((grave * 111 + moyen * 193 + aigu * 207) / t)},${Math.round((grave * 146 + moyen * 119 + aigu * 216) / t)})`
}
/** Hauteur d'une tranche de forme d'onde (0..1) d'après le volume et les attaques. */
export function hauteurDeTranche(img: ImageAudio): number {
  const l = clamp01((img.lufs.m + 30) / 24)
  return clamp01(0.06 + 0.36 * l + 0.22 * (img.kick.on ? l : 0) + 0.1 * (img.snare.on ? 1 : 0))
}

export function dessinerSpectre(ctx: CanvasRenderingContext2D, w: number, h: number, img: ImageAudio): void {
  ctx.clearRect(0, 0, w, h)
  const s = img.spec
  if (s.length !== 96) return
  const g = ctx.createLinearGradient(0, h, 0, 0)
  g.addColorStop(0, 'rgba(196,167,231,.15)'); g.addColorStop(0.6, 'rgba(235,111,146,.6)'); g.addColorStop(1, 'rgba(246,193,119,.9)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.moveTo(0, h)
  for (let i = 0; i < 96; i++) ctx.lineTo((i / 95) * w, h - (s[i] / 255) * h * 0.92)
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = COULEURS.clair; ctx.lineWidth = 1.2; ctx.beginPath()
  for (let i = 0; i < 96; i++) { const y = h - (s[i] / 255) * h * 0.92; if (i) ctx.lineTo((i / 95) * w, y); else ctx.moveTo(0, y) }
  ctx.stroke(); ctx.lineWidth = 1
}

export function dessinerOscillo(ctx: CanvasRenderingContext2D, w: number, h: number, img: ImageAudio): void {
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = COULEURS.ligne; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()
  const v = img.wave
  if (v.length < 2) return
  ctx.strokeStyle = COULEURS.ecume; ctx.lineWidth = 1.4; ctx.beginPath()
  for (let i = 0; i < v.length; i++) { const x = (i / (v.length - 1)) * w, y = h / 2 - (v[i] / 127) * h * 0.45; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }
  ctx.stroke(); ctx.lineWidth = 1
}

/** Vectoroscope : un nuage de points qui s'efface doucement. Mono : une ligne droite ; large : un nuage. */
export function dessinerVecto(ctx: CanvasRenderingContext2D, w: number, h: number, img: ImageAudio): void {
  ctx.fillStyle = 'rgba(23,16,25,.3)'; ctx.fillRect(0, 0, w, h)
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.46
  ctx.strokeStyle = 'rgba(156,142,166,.22)'
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke()
  ctx.fillStyle = img.kick.on || img.kick.v > 0.5 ? 'rgba(235,111,146,.9)' : 'rgba(236,229,238,.85)'
  for (const [l, rr] of img.pts) ctx.fillRect(cx + ((l - rr) / 127) * r * 0.7, cy - ((l + rr) / 127) * r * 0.7, 1.6, 1.6)
}

/** Volume perçu : l'historique, le repère de -14 LUFS (niveau des plateformes de streaming) et le chiffre. */
export function dessinerVolume(ctx: CanvasRenderingContext2D, w: number, h: number, historique: number[], m: number): void {
  ctx.clearRect(0, 0, w, h)
  const y = (v: number) => h - clamp01((v + 40) / 40) * (h - 4) - 2
  ctx.strokeStyle = 'rgba(246,193,119,.55)'; ctx.setLineDash([3, 4])
  ctx.beginPath(); ctx.moveTo(0, y(-14)); ctx.lineTo(w, y(-14)); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = COULEURS.texte; ctx.font = MONO; ctx.fillText('-14', 4, y(-14) - 3)
  ctx.strokeStyle = COULEURS.iris; ctx.lineWidth = 1.6; ctx.beginPath()
  historique.forEach((v, i) => { const x = (i / 219) * w; if (i) ctx.lineTo(x, y(v)); else ctx.moveTo(x, y(v)) })
  ctx.stroke(); ctx.lineWidth = 1
  ctx.fillStyle = COULEURS.clair; ctx.font = '600 22px JBM, ui-monospace, monospace'
  ctx.fillText(Number.isFinite(m) && m > -70 ? m.toFixed(1) : '--', w - 76, 26)
}

/** Fait défiler un canvas de `pas` pixels de l'écran vers la gauche et rend le contexte en pixels de l'écran. */
function defiler(c: HTMLCanvasElement, pas: number): CanvasRenderingContext2D {
  const ctx = c.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(c, -pas, 0)
  return ctx
}
export function dessinerSpectro(c: HTMLCanvasElement, img: ImageAudio, dpr: number): void {
  const pas = Math.max(1, Math.round(2 * dpr)), ctx = defiler(c, pas), lignes = 56, hl = c.height / lignes
  if (img.spec.length === 96) {
    for (let r = 0; r < lignes; r++) {
      ctx.fillStyle = chaleur((img.spec[Math.min(95, Math.floor((1 - r / lignes) * 95))] / 255) * 1.25)
      ctx.fillRect(c.width - pas, r * hl, pas, hl + 1)
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
export function dessinerOnde(c: HTMLCanvasElement, img: ImageAudio, dpr: number): void {
  const pas = Math.max(1, Math.round(2 * dpr)), ctx = defiler(c, pas), a = hauteurDeTranche(img)
  ctx.clearRect(c.width - pas, 0, pas, c.height)
  ctx.fillStyle = couleurDeTranche(img)
  ctx.fillRect(c.width - pas, c.height / 2 - (a * c.height) / 2, pas, a * c.height)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
