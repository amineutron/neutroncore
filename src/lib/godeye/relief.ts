// God Eye : toile de relief procédural (vue satellite), partagée par la carte à plat et la texture du globe. Aucune image externe.
import { bruitRelief } from './apparence'

let reliefToile: HTMLCanvasElement | null = null

/** Relief clair/sombre en transparence, fabriqué une fois (256 x 256) : donne du volume aux terres. */
export function toileRelief(): HTMLCanvasElement {
  if (reliefToile) return reliefToile
  const n = 256
  const c = document.createElement('canvas')
  c.width = n; c.height = n
  const ctx = c.getContext('2d')
  if (ctx) {
    const img = ctx.createImageData(n, n)
    const b = bruitRelief(n, 5)
    for (let i = 0; i < b.length; i++) {
      const v = (b[i] - 0.5) * 2.4   // le bruit se concentre autour de 0,5 : on l'étire
      const clair = v > 0
      img.data.set([clair ? 255 : 0, clair ? 245 : 8, clair ? 215 : 16, Math.min(150, Math.abs(v) * 170)], i * 4)
    }
    ctx.putImageData(img, 0, 0)
  }
  reliefToile = c
  return c
}
