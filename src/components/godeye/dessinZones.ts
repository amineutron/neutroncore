// God Eye : dessin des zones surveillées sur la carte à plat et sur le globe (trait fin, remplissage très léger).
// Les polygones sont calculés une fois par zone (WeakMap) : aucun recalcul à chaque image.
import { ID_BROUILLON, polygoneZone, type ZoneBrouillon } from '../../lib/godeye/zones'

const memo = new WeakMap<object, [number, number][]>()
const polygone = (z: ZoneBrouillon): [number, number][] => {
  let p = memo.get(z)
  if (!p) { p = polygoneZone(z); memo.set(z, p) }
  return p
}

const TRAIT = 'rgba(95,208,255,0.85)'
const REMPLI = 'rgba(95,208,255,0.07)'
const TRAIT_BROUILLON = 'rgba(246,193,119,0.95)'
const REMPLI_BROUILLON = 'rgba(246,193,119,0.1)'

const style = (ctx: CanvasRenderingContext2D, z: ZoneBrouillon): void => {
  const brouillon = z.id === ID_BROUILLON
  ctx.strokeStyle = brouillon ? TRAIT_BROUILLON : TRAIT
  ctx.fillStyle = brouillon ? REMPLI_BROUILLON : REMPLI
  ctx.lineWidth = brouillon ? 1.6 : 1.1
  ctx.setLineDash(brouillon ? [6, 4] : [])
}

/** Carte à plat : le polygone est tracé aussi décalé de +-360 degrés (monde répété), sans rien dessiner hors de la toile. */
export function dessinerZonesPlat(
  ctx: CanvasRenderingContext2D, zones: readonly ZoneBrouillon[], projeter: (lon: number, lat: number) => [number, number], w: number, h: number,
): void {
  if (!zones.length) return
  ctx.save()
  ctx.lineJoin = 'round'
  for (const z of zones) {
    const poly = polygone(z)
    if (poly.length < 3) continue
    style(ctx, z)
    for (const dec of [-360, 0, 360]) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      const pts = poly.map(([lo, la]) => {
        const [x, y] = projeter(lo + dec, la)
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
        return [x, y] as const
      })
      if (x1 < 0 || x0 > w || y1 < 0 || y0 > h) continue
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** Globe : un trait est interrompu derrière l'horizon (`projeter` rend null) ; on ne remplit que si la zone est entièrement visible. */
export function dessinerZonesGlobe(
  ctx: CanvasRenderingContext2D, zones: readonly ZoneBrouillon[], projeter: (lon: number, lat: number) => { x: number; y: number } | null,
): void {
  if (!zones.length) return
  ctx.save()
  ctx.lineJoin = 'round'
  for (const z of zones) {
    const poly = polygone(z)
    if (poly.length < 3) continue
    style(ctx, z)
    const pts = poly.map(([lo, la]) => projeter(lo, la))
    const tout = pts.every((q) => q !== null)
    if (!tout && pts.every((q) => q === null)) continue
    ctx.beginPath()
    let ouvert = false
    for (const q of pts) {
      if (!q) { ouvert = false; continue }
      if (ouvert) ctx.lineTo(q.x, q.y)
      else { ctx.moveTo(q.x, q.y); ouvert = true }
    }
    if (tout) { ctx.closePath(); ctx.fill() }
    ctx.stroke()
  }
  ctx.restore()
}
