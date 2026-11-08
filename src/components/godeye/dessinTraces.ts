// God Eye : dessin des polylignes de position (âge des satellites, trace d'un objet sélectionné ou marqué).
import type { GenreTrace, Polyligne } from '../../lib/godeye/trace'

type Pt = { x: number; y: number }
/** Projette un point de la Terre sur l'écran, ou null s'il n'est pas visible (derrière l'horizon). */
export type Projecteur = (lon: number, lat: number) => Pt | null

const STYLE: Record<GenreTrace, { largeur: number; alphaMin: number; alphaMax: number; tirets: number[] }> = {
  age: { largeur: 1.2, alphaMin: 0.05, alphaMax: 0.55, tirets: [] },
  suivi: { largeur: 2, alphaMin: 0.3, alphaMax: 0.95, tirets: [] },
  selection: { largeur: 2, alphaMin: 0.25, alphaMax: 0.95, tirets: [4, 3] },
}

/** Trace chaque ligne en s'estompant vers son début (le plus ancien) : on lit le sens du déplacement. */
export function dessinerPolylignes(ctx: CanvasRenderingContext2D, lignes: readonly Polyligne[], projeter: Projecteur): void {
  if (!lignes.length) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const l of lignes) {
    const s = STYLE[l.genre]
    ctx.strokeStyle = l.couleur
    ctx.lineWidth = s.largeur
    ctx.setLineDash(s.tirets)
    const total = l.morceaux.reduce((n, m) => n + Math.max(0, m.length - 1), 0)
    let k = 0
    for (const m of l.morceaux) {
      let prec: Pt | null = null
      for (const [lon, lat] of m) {
        const p = projeter(lon, lat)
        if (p && prec) {
          k++
          ctx.globalAlpha = s.alphaMin + (s.alphaMax - s.alphaMin) * Math.min(1, k / Math.max(1, total))
          ctx.beginPath()
          ctx.moveTo(prec.x, prec.y)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
        }
        prec = p
      }
    }
  }
  ctx.restore()
}
