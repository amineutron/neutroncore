// God Eye : dessins annexes de la carte à plat (quadrillage réglable, voile de nuit, relief satellite, pastilles de regroupement).
// Aucune décision ici : les calculs sont dans lib/godeye (apparence, nuit, amas).
import { projeter, type Vue } from '../../lib/vueMonde'
import { lignesGrille, pasGrille, type ReglagesCarte } from '../../lib/godeye/apparence'
import { avecAlpha, couleurObjet } from '../../lib/godeye/couleurs'
import { rayonAmas, texteAmas, type Amas } from '../../lib/godeye/amas'
import type { Objet } from '../../lib/godeye/modele'
import { toileRelief } from '../../lib/godeye/relief'
import { polygoneNuit, terminateur, type Soleil } from '../../lib/godeye/nuit'

/** Méridiens, parallèles, équateur et tropiques de la carte à plat. */
export function dessinerQuadrillagePlat(ctx: CanvasRenderingContext2D, vue: Vue, w: number, h: number, r: ReglagesCarte): void {
  const g = lignesGrille(pasGrille(r.grille, vue.zoom), r)
  ctx.strokeStyle = 'rgba(120,180,255,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const lon of g.meridiens) { const [x] = projeter(lon, 0, vue, w, h); ctx.moveTo(x, 0); ctx.lineTo(x, h) }
  for (const lat of g.paralleles) { const [, y] = projeter(0, lat, vue, w, h); ctx.moveTo(0, y); ctx.lineTo(w, y) }
  ctx.stroke()
  if (g.speciales.length === 0) return
  ctx.strokeStyle = 'rgba(246,193,119,0.38)'
  ctx.setLineDash([6, 5])
  ctx.beginPath()
  for (const s of g.speciales) { const [, y] = projeter(0, s.lat, vue, w, h); ctx.moveTo(0, y); ctx.lineTo(w, y) }
  ctx.stroke()
  ctx.setLineDash([])
}

/** Voile de nuit : la moitié de la Terre sans soleil, bord adouci par deux traits larges transparents le long du terminateur. */
export function dessinerNuitPlat(ctx: CanvasRenderingContext2D, vue: Vue, w: number, h: number, s: Soleil): void {
  const proj = (p: [number, number]): [number, number] => projeter(p[0], p[1], vue, w, h)
  ctx.beginPath()
  polygoneNuit(s).forEach((p, i) => { const [x, y] = proj(p); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
  ctx.closePath()
  ctx.fillStyle = 'rgba(2,6,18,0.42)'
  ctx.fill()
  ctx.beginPath()
  terminateur(s).forEach((p, i) => { const [x, y] = proj(p); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
  ctx.lineJoin = 'round'
  for (const [l, a] of [[22, 0.05], [10, 0.06]] as const) { ctx.strokeStyle = `rgba(2,6,18,${a})`; ctx.lineWidth = l; ctx.stroke() }
  ctx.strokeStyle = 'rgba(246,193,119,0.28)'
  ctx.lineWidth = 1
  ctx.stroke()
}

/** Pose le relief sur le monde entier (le chemin des terres doit être le clip courant). */
export function dessinerRelief(ctx: CanvasRenderingContext2D, vue: Vue, w: number, h: number): void {
  const [x0, y0] = projeter(-180, 90, vue, w, h)
  const [x1, y1] = projeter(180, -90, vue, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(toileRelief(), x0, y0, x1 - x0, y1 - y0)
}

/** Pastilles de regroupement : couleur de la couche, compteur au centre, anneau pour se distinguer d'un objet seul. */
export function dessinerAmas<T extends { x: number; y: number; o: Objet }>(ctx: CanvasRenderingContext2D, amas: readonly Amas<T>[]): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const a of amas) {
    const col = couleurObjet(a.membres[0].o)
    const r = rayonAmas(a.n)
    ctx.globalAlpha = 0.28
    ctx.fillStyle = col
    ctx.beginPath(); ctx.arc(a.x, a.y, r + 5, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 0.95
    ctx.fillStyle = '#0b1424'
    ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = col
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = avecAlpha(col, 1)
    ctx.font = `700 ${r > 15 ? 12 : 11}px ui-monospace, monospace`
    ctx.fillText(texteAmas(a.n), a.x, a.y + 0.5)
  }
}
