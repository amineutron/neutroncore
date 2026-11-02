// Placement des étiquettes du plan : chaque étiquette essaie plusieurs hauteurs
// (au-dessus du point, dessous, plus loin) et garde la première qui ne chevauche
// aucune étiquette déjà posée. Pur et testé.

export type LabelSpec = { id: string; x: number; y: number; text: string }
export type Box = { x0: number; x1: number; y0: number; y1: number }

const CANDIDATES = [-4.4, 6.8, -8.4, 11, -12.4, 15]   // décalages en unités de la pièce

export function labelBox(x: number, baseline: number, text: string, unit: number): Box {
  const w = Math.max(1, text.length) * unit * 1.9 + unit
  return { x0: x - w / 2, x1: x + w / 2, y0: baseline - unit * 3, y1: baseline + unit * 0.8 }
}

export const overlaps = (a: Box, b: Box): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

/** Ordonnée de la ligne de base de chaque étiquette (par id). `taken` : boîtes déjà occupées (ex. la TV). */
export function placeLabels(labels: LabelSpec[], unit: number, taken: Box[] = []): Record<string, number> {
  const placed: Box[] = [...taken]
  const out: Record<string, number> = {}
  for (const l of labels) {
    let chosen = l.y + CANDIDATES[0] * unit
    let box = labelBox(l.x, chosen, l.text, unit)
    for (const c of CANDIDATES) {
      const y = l.y + c * unit
      const b = labelBox(l.x, y, l.text, unit)
      if (!placed.some((p) => overlaps(p, b))) { chosen = y; box = b; break }
    }
    out[l.id] = chosen
    placed.push(box)
  }
  return out
}
