// God Eye : dessin des couches sur une toile 2D, pour la carte à plat comme pour le globe (superposition).
// Aucune décision ici : tout vient des Objet déjà filtrés et déjà projetés en pixels.
import { projeter, type Vue } from '../../lib/vueMonde'
import { TERRE_DIXIEMES } from '../../lib/vueMondeTerre'
import { avecAlpha, couleurObjet } from '../../lib/godeye/couleurs'
import { THEMES, type CoucheId, type Objet } from '../../lib/godeye/modele'

/** Ordre de dessin : le fond d'abord, ce qui bouge et se lit au premier plan en dernier. */
export const ORDRE_COUCHES: CoucheId[] = ['seismes', 'evenements', 'cyber', 'infos', 'navires', 'satellites', 'avions']

export type Pt = { o: Objet; x: number; y: number; cap?: number }

/** Carte à plat : espace profond, océan, terres éclairées à la côte, graticule discret. */
export function dessinerFond(ctx: CanvasRenderingContext2D, vue: Vue, w: number, h: number): void {
  const mer = ctx.createLinearGradient(0, 0, 0, h)
  mer.addColorStop(0, '#0a1a33'); mer.addColorStop(0.55, '#09223f'); mer.addColorStop(1, '#0a1a33')
  ctx.fillStyle = mer
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(120,180,255,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let lon = -180; lon <= 180; lon += 30) { const [x] = projeter(lon, 0, vue, w, h); ctx.moveTo(x, 0); ctx.lineTo(x, h) }
  for (let lat = -60; lat <= 60; lat += 30) { const [, y] = projeter(0, lat, vue, w, h); ctx.moveTo(0, y); ctx.lineTo(w, y) }
  ctx.stroke()
  const terre = ctx.createLinearGradient(0, 0, 0, h)
  terre.addColorStop(0, '#2d5a52'); terre.addColorStop(0.5, '#3b6a55'); terre.addColorStop(1, '#6d8794')
  ctx.beginPath()
  for (const r of TERRE_DIXIEMES) {
    for (let i = 0; i < r.length; i += 2) {
      const [x, y] = projeter(r[i] / 10, r[i + 1] / 10, vue, w, h)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }
  ctx.fillStyle = terre
  ctx.fill()
  ctx.strokeStyle = 'rgba(150,215,235,0.7)'
  ctx.lineWidth = 1
  ctx.stroke()
}

function fleche(ctx: CanvasRenderingContext2D, x: number, y: number, capDeg: number, r: number, etroit: number, queue: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((capDeg * Math.PI) / 180)
  if (queue > 0) {   // sillage : on voit tout de suite dans quel sens ça bouge
    const g = ctx.createLinearGradient(0, r, 0, r + queue)
    g.addColorStop(0, ctx.fillStyle as string); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha *= 0.55
    ctx.fillStyle = g
    ctx.fillRect(-0.9, r * 0.6, 1.8, queue)
    ctx.globalAlpha /= 0.55
  }
  ctx.beginPath()
  ctx.moveTo(0, -r * 1.5); ctx.lineTo(r * etroit, r); ctx.lineTo(0, r * 0.45); ctx.lineTo(-r * etroit, r)
  ctx.closePath()
  ctx.fillStyle = ctx.strokeStyle as string
  ctx.fill()
  ctx.restore()
}

const pastille = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2) }

/** Dessine un objet à (x, y) en pixels. `phase` (0..1) anime les repères qui respirent ; `capEcran` = cap déjà corrigé pour le globe. */
export function dessinerObjet(ctx: CanvasRenderingContext2D, o: Objet, x: number, y: number, choisi: boolean, phase: number, capEcran?: number): void {
  const col = couleurObjet(o)
  ctx.fillStyle = col
  ctx.strokeStyle = col
  ctx.lineWidth = 1.5
  ctx.shadowColor = avecAlpha(col, 0.9)
  ctx.shadowBlur = 0
  switch (o.couche) {
    case 'seismes': {
      for (const k of [0, 0.5]) {   // deux ondes qui s'élargissent : un séisme, ça se propage
        const p = (phase + k) % 1
        ctx.globalAlpha = (1 - p) * 0.55
        ctx.lineWidth = 1.5
        pastille(ctx, x, y, o.rayon * (0.5 + p * 1.3)); ctx.stroke()
      }
      ctx.globalAlpha = 0.5
      pastille(ctx, x, y, o.rayon * 0.55); ctx.fill()
      ctx.globalAlpha = 1
      ctx.lineWidth = 2
      pastille(ctx, x, y, o.rayon * 0.55); ctx.stroke()
      break
    }
    case 'evenements': {
      ctx.shadowBlur = 10
      ctx.globalAlpha = 0.95
      ctx.save()
      ctx.translate(x, y); ctx.rotate(Math.PI / 4)
      ctx.fillRect(-o.rayon * 0.62, -o.rayon * 0.62, o.rayon * 1.24, o.rayon * 1.24)
      ctx.restore()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#0b1424'
      pastille(ctx, x, y, o.rayon * 0.28); ctx.fill()
      break
    }
    case 'infos': {
      const crit = o.ton === 'crit', warn = o.ton === 'warn'
      if (crit || warn) {   // halo qui respire : plus c'est grave, plus ça se voit
        ctx.globalAlpha = (1 - phase) * (crit ? 0.75 : 0.45)
        ctx.lineWidth = crit ? 2 : 1.5
        pastille(ctx, x, y, o.rayon + 2 + phase * (crit ? 16 : 10)); ctx.stroke()
      }
      ctx.shadowBlur = crit ? 14 : 8
      ctx.globalAlpha = 1
      pastille(ctx, x, y, o.rayon); ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#0b1424'
      ctx.font = `700 ${Math.round(o.rayon * 1.2)}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(THEMES.find((t) => t.id === o.sorte)?.lettre ?? '.', x, y + 0.5)
      break
    }
    case 'cyber':
      ctx.lineWidth = 2
      ctx.globalAlpha = 1 - phase
      pastille(ctx, x, y, 6 + phase * 18); ctx.stroke()
      ctx.globalAlpha = 1
      pastille(ctx, x, y, 4); ctx.fill()
      break
    case 'avions':
      if (o.ton === 'crit') { ctx.globalAlpha = 1 - phase; ctx.lineWidth = 2; pastille(ctx, x, y, 8 + phase * 16); ctx.stroke() }
      ctx.globalAlpha = o.sorte === 'militaire' || o.ton === 'crit' ? 1 : 0.85
      ctx.shadowBlur = o.sorte === 'militaire' ? 8 : 0
      fleche(ctx, x, y, capEcran ?? o.cap ?? 0, o.rayon, 0.8, 11)
      break
    case 'navires':
      ctx.globalAlpha = 0.95
      fleche(ctx, x, y, capEcran ?? o.cap ?? 0, o.rayon, 0.55, 8)
      break
    case 'satellites': {
      ctx.globalAlpha = 0.95
      ctx.shadowBlur = o.sorte === 'stations' ? 12 : 4
      ctx.beginPath(); ctx.moveTo(x, y - o.rayon); ctx.lineTo(x + o.rayon, y); ctx.lineTo(x, y + o.rayon); ctx.lineTo(x - o.rayon, y); ctx.closePath(); ctx.fill()
      if (o.sorte === 'stations') { ctx.shadowBlur = 0; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; pastille(ctx, x, y, o.rayon + 5); ctx.stroke() }
      break
    }
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  if (choisi) {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    pastille(ctx, x, y, Math.max(o.rayon, 5) + 7); ctx.stroke()
  }
}

/** Trace au sol d'un satellite, déjà projetée en pixels : pointillés, un tronçon par morceau. */
export function dessinerTrace(ctx: CanvasRenderingContext2D, morceaux: readonly (readonly [number, number])[][]): void {
  ctx.strokeStyle = '#6fe7ff'
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.85
  ctx.setLineDash([5, 4])
  for (const m of morceaux) {
    if (m.length < 2) continue
    ctx.beginPath()
    m.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}

/** Objet projeté le plus proche du point (x, y), dans une tolérance en pixels ; les plus petits l'emportent à distance égale. */
export function plusProcheObjet(pts: readonly Pt[], x: number, y: number, tolerance = 14): Objet | null {
  let meilleur: Objet | null = null
  let dmin = Infinity
  for (const p of pts) {
    const d = Math.hypot(p.x - x, p.y - y)
    const portee = Math.max(tolerance, p.o.rayon * 0.8)
    if (d <= portee && d - p.o.rayon * 0.2 < dmin) { dmin = d - p.o.rayon * 0.2; meilleur = p.o }
  }
  return meilleur
}
