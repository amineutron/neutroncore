// Zoom et déplacement d'une image agrandie (logique pure). `k` = grossissement (1 = image entière),
// `x`, `y` = décalage du centre de l'image, en pixels d'écran.

export type VueImage = { k: number; x: number; y: number }
export const VUE_ENTIERE: VueImage = { k: 1, x: 0, y: 0 }
export const ZOOM_MAX = 8

/** Le décalage ne sort pas l'image du cadre : à k = 1 elle est centrée, au-delà on peut aller jusqu'à ses bords. */
export function borner(v: VueImage, cadre: { w: number; h: number }): VueImage {
  const k = Math.max(1, Math.min(ZOOM_MAX, v.k))
  const mx = (cadre.w * (k - 1)) / 2, my = (cadre.h * (k - 1)) / 2
  return { k, x: Math.max(-mx, Math.min(mx, v.x)) || 0, y: Math.max(-my, Math.min(my, v.y)) || 0 }
}

/** Zoom d'un facteur autour d'un point du cadre (`px`, `py` mesurés depuis son centre) : ce point reste sous le doigt. */
export function zoomer(v: VueImage, facteur: number, px: number, py: number, cadre: { w: number; h: number }): VueImage {
  const k = Math.max(1, Math.min(ZOOM_MAX, v.k * facteur))
  const r = k / v.k
  return borner({ k, x: px - (px - v.x) * r, y: py - (py - v.y) * r }, cadre)
}

export function deplacer(v: VueImage, dx: number, dy: number, cadre: { w: number; h: number }): VueImage {
  return borner({ ...v, x: v.x + dx, y: v.y + dy }, cadre)
}
