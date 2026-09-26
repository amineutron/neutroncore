// Conversions de couleur pour le canevas du nuancier (logique pure, testée).
// HSV : h en degrés 0-360, s et v entre 0 et 1.

export type Hsv = { h: number; s: number; v: number }

const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i

/** "#ABC" / "abc" / "#aabbcc" -> "#aabbcc" ; null si ce n'est pas un code hexa. */
export function normalizeHex(v: string): string | null {
  const m = HEX_RE.exec(v.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return `#${h.toLowerCase()}`
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function hsvToHex({ h, s, v }: Hsv): string {
  const hh = (((h % 360) + 360) % 360) / 60
  const c = clamp01(v) * clamp01(s)
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const m = clamp01(v) - c
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x]
    : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x]
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

/** Code hexa -> HSV ; null si le code est invalide. Teinte 0 pour les gris. */
export function hexToHsv(hex: string): Hsv | null {
  const n = normalizeHex(hex)
  if (!n) return null
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  return { h: (h + 360) % 360, s: max ? d / max : 0, v: max }
}
