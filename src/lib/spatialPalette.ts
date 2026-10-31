// Palette tirée d'une image (pochette, photo) ou des couleurs mesurées de l'Ambilight : logique pure, testée.
// Une même fonction sert aux trois sources ; la palette obtenue est une palette « libre » de la scène.

/** Miroir de MAX_COULEURS dans lib/spatial.py (côté API). */
export const MAX_COULEURS = 6
export const MIN_COULEURS = 3

export type Rgb = [number, number, number]

export type Reglages = {
  /** Saturation minimale (0-1) : en dessous, c'est un gris, ignoré. */
  satMin: number
  /** Luminosité minimale (0-1) : en dessous, c'est un noir terne, ignoré. */
  valMin: number
  /** Écart minimal (distance RVB) entre deux couleurs gardées : évite trois variantes du même bleu. */
  ecartMin: number
  /** Poids minimal (part des pixels) pour qu'une teinte compte : écarte le bruit. */
  poidsMin: number
}
export const REGLAGES: Reglages = { satMin: 0.25, valMin: 0.22, ecartMin: 64, poidsMin: 0.002 }

const HEX = /^#[0-9a-f]{6}$/i

export function hexVersRgb(hex: string): Rgb | null {
  if (!HEX.test(hex)) return null
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb
}

export function rgbVersHex([r, g, b]: Rgb): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Saturation et valeur (0-1) d'une couleur. */
export function satVal([r, g, b]: Rgb): { s: number; v: number } {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return { s: max === 0 ? 0 : (max - min) / max, v: max / 255 }
}

const ecart = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Des couleurs `#rrggbb` -> pixels RGBA opaques (pour réutiliser l'extraction sur les mesures de l'Ambilight). */
export function pixelsDeCouleurs(hexes: readonly string[]): Uint8ClampedArray {
  const valides = hexes.map(hexVersRgb).filter((c): c is Rgb => c !== null)
  const px = new Uint8ClampedArray(valides.length * 4)
  valides.forEach((c, i) => { px.set([c[0], c[1], c[2], 255], i * 4) })
  return px
}

/** Les couleurs mesurées par la télé (par côté) mises bout à bout. */
export function couleursMesurees(cotes: { left?: string[]; top?: string[]; right?: string[]; bottom?: string[] }): string[] {
  return [...(cotes.left ?? []), ...(cotes.top ?? []), ...(cotes.right ?? []), ...(cotes.bottom ?? [])].filter((c) => HEX.test(c))
}

type Case = { n: number; r: number; g: number; b: number }

/**
 * 3 à 6 couleurs dominantes d'une image (pixels RGBA à la suite, comme `ImageData.data`).
 * Les pixels sont regroupés par teinte proche (16 niveaux par canal). Les gris et les noirs ternes sont ignorés ;
 * le reste est classé par poids pondéré par la saturation (une grande tache vive passe avant un petit détail,
 * une tache terne passe après une tache éclatante de même taille). Deux couleurs trop proches ne sont pas gardées toutes les deux.
 * Peut rendre moins de couleurs que demandé (image presque grise : la liste est même vide) : l'appelant le dit.
 */
export function extraireCouleurs(pixels: ArrayLike<number>, voulues = 5, reglages: Partial<Reglages> = {}): string[] {
  const { satMin, valMin, ecartMin, poidsMin } = { ...REGLAGES, ...reglages }
  const n = Math.max(1, Math.min(MAX_COULEURS, Math.round(voulues)))
  const cases = new Map<number, Case>()
  let total = 0
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
    total++
    const cle = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const c = cases.get(cle)
    if (c) { c.n++; c.r += r; c.g += g; c.b += b } else cases.set(cle, { n: 1, r, g, b })
  }
  if (total === 0) return []
  const candidats: { rgb: Rgb; score: number }[] = []
  for (const c of cases.values()) {
    const rgb: Rgb = [c.r / c.n, c.g / c.n, c.b / c.n]
    const { s, v } = satVal(rgb)
    const poids = c.n / total
    if (s < satMin || v < valMin || poids < poidsMin) continue
    candidats.push({ rgb, score: Math.sqrt(poids) * (0.3 + s) })
  }
  candidats.sort((a, b) => b.score - a.score || a.rgb[0] - b.rgb[0] || a.rgb[1] - b.rgb[1] || a.rgb[2] - b.rgb[2])
  const gardees: Rgb[] = []
  for (const c of candidats) {
    if (gardees.length >= n) break
    if (gardees.every((g) => ecart(g, c.rgb) >= ecartMin)) gardees.push(c.rgb)
  }
  return gardees.map(rgbVersHex)
}

/** Phrase honnête pour l'écran selon ce que l'extraction a rendu. */
export function bilanPalette(couleurs: readonly string[]): string {
  if (couleurs.length === 0) return 'aucune couleur vive trouvée : l’image est trop grise ou trop sombre'
  if (couleurs.length < MIN_COULEURS) return `${couleurs.length === 1 ? 'une seule couleur vive' : 'deux couleurs vives'} dans cette image`
  return `${couleurs.length} couleurs dominantes`
}
