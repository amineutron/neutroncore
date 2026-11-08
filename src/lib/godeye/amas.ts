// God Eye : regroupement des pictogrammes denses (logique pure, testée dans amas.test.ts).
// À faible zoom, des dizaines d'avions ou de navires se recouvrent : on les remplace par une pastille avec un compteur.

export type Positionne = { x: number; y: number }
export type Amas<T extends Positionne> = { x: number; y: number; n: number; cle: string; membres: T[] }
export type Regroupement<T extends Positionne> = { amas: Amas<T>[]; libres: T[] }

/** Zoom au-delà duquel on ne regroupe plus (les objets sont assez écartés pour se lire un par un). */
export const ZOOM_SANS_AMAS = 6
/** Nombre d'objets visibles en dessous duquel regrouper n'apporte rien. */
export const MIN_OBJETS_AMAS = 40
/** Côté d'une case de regroupement, en pixels. */
export const CELLULE_AMAS = 46

/** Faut-il regrouper : réglage actif, zoom lointain et assez d'objets à l'écran. */
export const regrouperActif = (actif: boolean, zoom: number, visibles: number): boolean =>
  actif && zoom < ZOOM_SANS_AMAS && visibles >= MIN_OBJETS_AMAS

/**
 * Regroupe par cases de `cellule` pixels, séparément pour chaque `cle` (la couche : on ne mélange pas avions et navires).
 * Un objet `fixe` (choisi, urgent) n'est jamais absorbé. Une case n'ayant qu'un objet le laisse libre ; à partir de `minimum`
 * (2 par défaut) elle devient un amas placé au barycentre.
 */
export function regrouper<T extends Positionne>(
  points: readonly T[], cle: (p: T) => string, fixe: (p: T) => boolean, cellule = CELLULE_AMAS, minimum = 2,
): Regroupement<T> {
  const libres: T[] = []
  const cases = new Map<string, { cle: string; l: T[] }>()
  const pas = Math.max(1, cellule)
  for (const p of points) {
    if (fixe(p)) { libres.push(p); continue }
    const c = cle(p)
    const k = `${c}|${Math.floor(p.x / pas)}|${Math.floor(p.y / pas)}`
    const e = cases.get(k)
    if (e) e.l.push(p); else cases.set(k, { cle: c, l: [p] })
  }
  const amas: Amas<T>[] = []
  for (const { cle: c, l } of cases.values()) {
    if (l.length < Math.max(2, minimum)) { libres.push(...l); continue }
    const x = l.reduce((s, p) => s + p.x, 0) / l.length
    const y = l.reduce((s, p) => s + p.y, 0) / l.length
    amas.push({ x, y, n: l.length, cle: c, membres: l })
  }
  return { amas, libres }
}

/** Rayon de la pastille : grandit doucement avec le nombre (jamais moins de 11 px). */
export const rayonAmas = (n: number): number => Math.min(22, 11 + Math.log2(Math.max(1, n)) * 2)

/** Amas touché en (x, y), dans la tolérance en pixels (rayon de la pastille compris), ou null. */
export function amasTouche<T extends Positionne>(amas: readonly Amas<T>[], x: number, y: number, tolerance = 6): Amas<T> | null {
  let meilleur: Amas<T> | null = null
  let dmin = Infinity
  for (const a of amas) {
    const d = Math.hypot(a.x - x, a.y - y)
    if (d <= rayonAmas(a.n) + tolerance && d < dmin) { dmin = d; meilleur = a }
  }
  return meilleur
}

/** Texte du compteur : 1 à 99 tel quel, ensuite « 100+ » arrondi à la centaine, « 1k+ » au-delà de 1000. */
export function texteAmas(n: number): string {
  if (n < 100) return String(n)
  if (n < 1000) return `${Math.floor(n / 100) * 100}+`
  return `${Math.floor(n / 1000)}k+`
}

/** Centre géographique moyen d'un amas (les membres sont proches : une case de quelques dizaines de pixels). */
export function centreGeo(membres: readonly { lon: number; lat: number }[]): { lon: number; lat: number } {
  if (membres.length === 0) return { lon: 0, lat: 0 }
  const ref = membres[0].lon
  let sx = 0, sy = 0
  for (const m of membres) {
    let d = m.lon - ref
    if (d > 180) d -= 360; else if (d < -180) d += 360   // franchit l'antiméridien : on moyenne autour du premier membre
    sx += d; sy += m.lat
  }
  const lon = ref + sx / membres.length
  return { lon: ((((lon + 180) % 360) + 360) % 360) - 180, lat: sy / membres.length }
}
