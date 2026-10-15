// Atelier 3D : tournage d'un film. La scène three.js est pilotée image par image, son rendu
// est recopié sur une toile 16:9 avec le décor et les textes, et c'est cette toile qu'on
// enregistre. Aucun three.js ici : la scène n'est vue qu'à travers `FilmScene`.

import type { Etats, Vec3 } from './atelier'
import { camAt, explodeAt, filmDuration, fonduAt, shotAt, type Cam, type Shot } from './atelierFilm'

export type FilmPose = { cam: Cam; explode: number; etats: Etats; offsets?: Record<string, Vec3>; accent?: string[]; cible?: string[] }
export type FilmScene = { canvas: HTMLCanvasElement; beginFilm: (w: number, h: number) => boolean; filmFrame: (pose: FilmPose) => void; endFilm: () => void }
export type FilmStyle = 'notice' | 'pub'
export type FilmResult = { blob: Blob | null; raison: '' | 'annule' | 'incompatible' | 'occupe' | 'erreur' }
export type FilmOptions = {
  style: FilmStyle
  /** ce que la scène montre pendant un plan : pièces visibles, pièces en train d'arriver */
  poseOf: (shot: Shot, u: number) => Omit<FilmPose, 'cam' | 'explode'>
  onCanvas?: (canvas: HTMLCanvasElement | null) => void     // la toile filmée, pour un aperçu en direct
  onProgress?: (part: number) => void
  signal?: AbortSignal
}

const W = 1280, H = 720
const MIMES = ['video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9', 'video/webm']
const MONO = '"JetBrains Mono", ui-monospace, monospace'
const SANS = 'Cantarell, system-ui, sans-serif'

export function filmMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null
}

/** Coupe un texte en lignes qui tiennent dans `largeur` (au plus `max` lignes, la dernière finit par « … »). */
function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number, max: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    const essai = cur ? `${cur} ${mot}` : mot
    if (ctx.measureText(essai).width <= largeur || !cur) cur = essai
    else { out.push(cur); cur = mot }
  }
  if (cur) out.push(cur)
  return out.length > max ? [...out.slice(0, max - 1), `${out[max - 1]}…`] : out
}

function decorNotice(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#f3eee4'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#1c1820'
  ctx.lineWidth = 3
  ctx.strokeRect(22, 22, W - 44, H - 44)
}

function decorPub(ctx: CanvasRenderingContext2D): void {
  const fond = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.5, W * 0.72)
  fond.addColorStop(0, '#3a2a36'); fond.addColorStop(0.55, '#17111a'); fond.addColorStop(1, '#07050a')
  ctx.fillStyle = fond
  ctx.fillRect(0, 0, W, H)
}

function texteNotice(ctx: CanvasRenderingContext2D, shot: Shot, total: number, index: number): void {
  ctx.fillStyle = '#1c1820'
  ctx.textBaseline = 'alphabetic'
  if (shot.numero) {
    // pastille du numéro, façon notice de meuble
    ctx.beginPath(); ctx.arc(92, 96, 44, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#f3eee4'; ctx.textAlign = 'center'; ctx.font = `700 46px ${MONO}`
    ctx.fillText(shot.numero.split(' / ')[0], 92, 113)
    ctx.fillStyle = '#1c1820'; ctx.textAlign = 'left'
  }
  const x = shot.numero ? 158 : 60
  ctx.font = `700 ${shot.numero ? 30 : 46}px ${SANS}`
  const titre = lignes(ctx, shot.titre ?? '', W - x - 70, 2)
  titre.forEach((l, i) => ctx.fillText(l, x, (shot.numero ? 86 : 110) + i * (shot.numero ? 36 : 54)))
  if (shot.sous) {
    ctx.font = `400 21px ${SANS}`; ctx.fillStyle = '#5a5260'
    lignes(ctx, shot.sous, W - x - 70, 2).forEach((l, i) => ctx.fillText(l, x, (shot.numero ? 86 : 118) + titre.length * (shot.numero ? 36 : 54) + i * 27))
  }
  if (shot.liste?.length) {
    // encart des pièces du geste, en bas à gauche
    ctx.font = `500 20px ${MONO}`
    const items = shot.liste.slice(0, 5)
    const large = Math.max(...items.map((t) => ctx.measureText(t).width)) + 36
    const haut = items.length * 30 + 22, y = H - 70 - haut
    ctx.fillStyle = '#f3eee4'; ctx.fillRect(50, y, large, haut)
    ctx.strokeStyle = '#1c1820'; ctx.lineWidth = 2; ctx.strokeRect(50, y, large, haut)
    ctx.fillStyle = '#1c1820'
    items.forEach((t, i) => ctx.fillText(t, 68, y + 34 + i * 30))
  }
  // avancement : un trait par plan
  const pas = (W - 120) / Math.max(1, total)
  for (let i = 0; i < total; i++) { ctx.fillStyle = i <= index ? '#1c1820' : '#cfc7b8'; ctx.fillRect(60 + i * pas, H - 46, Math.max(2, pas - 4), 5) }
}

function textePub(ctx: CanvasRenderingContext2D, shot: Shot, u: number): void {
  // bandes de cinéma
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, 54); ctx.fillRect(0, H - 54, W, 54)
  const alpha = Math.min(1, u / 0.25, (1 - u) / 0.2)
  ctx.globalAlpha = Math.max(0, alpha)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  if (shot.titre) {
    ctx.font = `700 54px ${MONO}`
    const degrade = ctx.createLinearGradient(70, 0, 620, 0)
    degrade.addColorStop(0, '#f6c177'); degrade.addColorStop(1, '#eb6f92')
    ctx.fillStyle = degrade
    ctx.fillText(shot.titre, 70, H - 128)
    ctx.fillRect(72, H - 112, 64, 3)
  }
  if (shot.sous) {
    ctx.font = `400 22px ${MONO}`; ctx.fillStyle = '#e8dfe6'
    ctx.fillText(shot.sous, 70, shot.titre ? H - 80 : H - 96)
  }
  ctx.globalAlpha = 1
}

/** Tourne le film en temps réel et rend la vidéo. La scène est toujours rendue dans son état d'avant. */
export function recordFilm(scene: FilmScene, shots: Shot[], opts: FilmOptions): Promise<FilmResult> {
  const mime = filmMime()
  const toile = document.createElement('canvas')
  toile.width = W; toile.height = H
  const ctx = toile.getContext('2d')
  if (!mime || !ctx || !toile.captureStream || shots.length === 0) return Promise.resolve({ blob: null, raison: 'incompatible' })
  return new Promise((resolve) => {
    const total = filmDuration(shots)
    const chunks: Blob[] = []
    let rec: MediaRecorder
    try { rec = new MediaRecorder(toile.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 }) } catch { resolve({ blob: null, raison: 'incompatible' }); return }
    let raf = 0
    let annule = false
    let raison: FilmResult['raison'] = 'annule'
    const finir = () => { cancelAnimationFrame(raf); scene.endFilm(); opts.onCanvas?.(null) }
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    rec.onstop = () => { finir(); resolve(annule ? { blob: null, raison } : { blob: chunks.length ? new Blob(chunks, { type: mime.split(';')[0] }) : null, raison: chunks.length ? '' : 'incompatible' }) }
    rec.onerror = () => { finir(); resolve({ blob: null, raison: 'incompatible' }) }
    const arreter = () => { if (rec.state !== 'inactive') rec.stop() }
    opts.signal?.addEventListener('abort', () => { annule = true; arreter() }, { once: true })

    const image = (t: number) => {
      const at = shotAt(shots, t) ?? { index: shots.length - 1, u: 1 }
      const shot = shots[at.index]
      scene.filmFrame({ ...opts.poseOf(shot, at.u), cam: camAt(shot, at.u), explode: explodeAt(shot, at.u) })
      if (opts.style === 'notice') decorNotice(ctx); else decorPub(ctx)
      ctx.drawImage(scene.canvas, 0, 0, W, H)
      if (opts.style === 'notice') texteNotice(ctx, shot, shots.length, at.index); else textePub(ctx, shot, at.u)
      const voile = fonduAt(shot, at.u)
      if (voile > 0) { ctx.globalAlpha = voile; ctx.fillStyle = opts.style === 'notice' ? '#f3eee4' : '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
    }
    if (!scene.beginFilm(W, H)) { resolve({ blob: null, raison: 'occupe' }); return }
    opts.onCanvas?.(toile)
    // une image qui échoue (pièces rechargées, contexte 3D perdu) arrête le tournage proprement, la scène est rendue
    const echec = () => { annule = true; raison = 'erreur'; if (rec.state !== 'inactive') rec.stop(); else { finir(); resolve({ blob: null, raison: 'erreur' }) } }
    try { image(0); rec.start(250) } catch { finir(); resolve({ blob: null, raison: 'incompatible' }); return }
    const debut = performance.now()
    const tick = (now: number) => {
      const t = (now - debut) / 1000
      try {
        if (t >= total) { image(total); arreter(); return }
        image(t)
      } catch { echec(); return }
      opts.onProgress?.(t / total)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  })
}
