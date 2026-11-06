// Rampes de lumière : courbes dans le temps, par lampe. Logique pure (testée dans rampes.test.ts).
// MÊME calcul que lib/rampes.py côté API (mêmes cas de test) : changer l'un = changer l'autre.
// Une courbe est une liste de points {t (s), v, forme} ; `forme` décrit le trajet jusqu'au point SUIVANT.

export type Forme = 'lineaire' | 'doux' | 'palier'
export type Point = { t: number; v: number; forme: Forme }
export type Piste = { lampes: string[]; bri: Point[]; kelvin: Point[] }
export type Rampe = { id: string; nom: string; duree_s: number; pas_s: number; boucle: boolean; pistes: Piste[] }
export type EtatLampe = { on: boolean; bri: number | null; kelvin: number | null }

export const BRI_MAX = 254
export const K_MIN = 2000
export const K_MAX = 6500
export const FORMES: Forme[] = ['lineaire', 'doux', 'palier']
export const ECART_MIN_S = 1          // deux points d'une même courbe restent à au moins une seconde l'un de l'autre

/** Arrondi à l'entier le plus proche, moitiés vers le pair (comme `round` de Python : mêmes résultats que l'API). */
export function arrondi(x: number): number {
  const f = Math.floor(x)
  const d = x - f
  if (d < 0.5) return f
  if (d > 0.5) return f + 1
  return f % 2 === 0 ? f : f + 1
}

function facteur(forme: Forme, x: number): number {
  if (forme === 'doux') return x * x * (3 - 2 * x)
  if (forme === 'palier') return 0
  return x
}

/** Valeur d'une courbe à l'instant t ; null si elle est vide. Points triés par t. */
export function valeur(points: Point[], t: number): number | null {
  if (!points.length) return null
  if (t <= points[0].t) return points[0].v
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    if (t < b.t) return a.v + (b.v - a.v) * facteur(a.forme, (t - a.t) / (b.t - a.t))
  }
  return points[points.length - 1].v
}

/** État de chaque lampe à l'instant t. En boucle le temps se replie ; sinon il est borné. */
export function evaluer(rampe: Rampe, t: number): Record<string, EtatLampe> {
  const d = rampe.duree_s
  const tt = !Number.isFinite(t) ? 0 : rampe.boucle ? ((t % d) + d) % d : Math.min(Math.max(t, 0), d)
  const sortie: Record<string, EtatLampe> = {}
  for (const p of rampe.pistes) {
    const b = valeur(p.bri, tt), k = valeur(p.kelvin, tt)
    let bri: number | null = b === null ? null : arrondi(Math.min(Math.max(b, 0), BRI_MAX))
    if (b !== null && b > 0 && bri === 0) bri = 1          // allumée mais infime : jamais « éteinte » par arrondi
    const kelvin = k === null ? null : arrondi(Math.min(Math.max(k, K_MIN), K_MAX))
    for (const l of p.lampes) sortie[l] = { on: bri === null || bri > 0, bri, kelvin }
  }
  return sortie
}

// --- couleurs d'affichage (approximation : sert à voir l'effet, pas à calibrer) ---

/** Température de couleur (K) -> [r, g, b] 0..255 (approximation de Tanner Helland). */
export function kelvinVersRgb(kelvin: number): [number, number, number] {
  const t = Math.min(Math.max(kelvin, 1000), 40000) / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  const c = (x: number) => Math.round(Math.min(Math.max(x, 0), 255))
  return [c(r), c(g), c(b)]
}

/** Couleur CSS d'une lampe : sa teinte (blanc si inconnue) à sa luminosité ; éteinte = gris très sombre. */
export function couleurLampe(e: EtatLampe | undefined): string {
  if (!e || !e.on) return 'rgb(26 20 30)'
  const [r, g, b] = kelvinVersRgb(e.kelvin ?? 3000)
  const niveau = e.bri === null ? 1 : Math.pow(e.bri / BRI_MAX, 0.6)          // l'oeil juge la lumière en racine
  const f = 0.12 + 0.88 * niveau
  return `rgb(${Math.round(r * f)} ${Math.round(g * f)} ${Math.round(b * f)})`
}

// --- édition d'une courbe (jamais de mutation : chaque fonction rend une nouvelle liste) ---

export function trier(points: Point[]): Point[] {
  return [...points].sort((a, b) => a.t - b.t)
}

/** Ajoute un point en (t, v) ; refusé (liste inchangée) s'il tombe à moins d'une seconde d'un autre ou si la courbe est pleine. */
export function ajouterPoint(points: Point[], t: number, v: number, duree: number, max: number): Point[] {
  if (points.length >= max || t < 0 || t > duree) return points
  if (points.some((p) => Math.abs(p.t - t) < ECART_MIN_S)) return points
  return trier([...points, { t: Math.round(t * 100) / 100, v: Math.round(v * 100) / 100, forme: 'lineaire' }])
}

/** Déplace le point i ; son instant reste entre ses voisins (à une seconde au moins) et dans la durée. */
export function deplacerPoint(points: Point[], i: number, t: number, v: number, duree: number, lo: number, hi: number): Point[] {
  if (i < 0 || i >= points.length) return points
  const min = i > 0 ? points[i - 1].t + ECART_MIN_S : 0
  const max = i < points.length - 1 ? points[i + 1].t - ECART_MIN_S : duree
  const tt = Math.min(Math.max(t, min), Math.max(min, max))
  const vv = Math.min(Math.max(v, lo), hi)
  return points.map((p, k) => (k === i ? { ...p, t: Math.round(tt * 100) / 100, v: Math.round(vv * 100) / 100 } : p))
}

export function supprimerPoint(points: Point[], i: number): Point[] {
  return points.filter((_, k) => k !== i)
}

export function changerForme(points: Point[], i: number, forme: Forme): Point[] {
  return points.map((p, k) => (k === i ? { ...p, forme } : p))
}

/** Même forme sur une autre durée : les instants suivent. */
export function mettreALechelle(points: Point[], ancienne: number, nouvelle: number): Point[] {
  if (ancienne <= 0) return points
  return points.map((p) => ({ ...p, t: Math.round(((p.t * nouvelle) / ancienne) * 100) / 100 }))
}

/** Montée percue comme régulière : v = debut + (fin - debut) * x ** gamma (même courbe que `courbe_gamma` de l'API). */
export function courbeGamma(duree: number, debut: number, fin: number, gamma = 2.2, n = 9): Point[] {
  return Array.from({ length: n }, (_, i) => ({
    t: Math.round(((duree * i) / (n - 1)) * 100) / 100,
    v: Math.round((debut + (fin - debut) * Math.pow(i / (n - 1), gamma)) * 100) / 100,
    forme: 'lineaire' as Forme,
  }))
}

/** Deux points : un départ, une arrivée (même courbe que `courbe_lineaire` de l'API). */
export function courbeLineaire(duree: number, debut: number, fin: number, forme: Forme = 'lineaire'): Point[] {
  return [{ t: 0, v: debut, forme }, { t: Math.round(duree * 100) / 100, v: fin, forme: 'lineaire' }]
}

// --- affichage ---

/** Durée en mots : 45 s, 30 min, 1 h 05. */
export function dureeLisible(s: number): string {
  if (s < 90) return `${Math.round(s)} s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h${String(m % 60).padStart(2, '0')}`
}

/** Chemin SVG d'une courbe (échelle libre) : les segments suivent la forme du point de départ. */
export function cheminCourbe(points: Point[], duree: number, lo: number, hi: number, w: number, h: number): string {
  if (!points.length) return ''
  const X = (t: number) => (t / duree) * w
  const Y = (v: number) => h - ((v - lo) / (hi - lo)) * h
  let d = `M0 ${Y(points[0].v).toFixed(1)} L${X(points[0].t).toFixed(1)} ${Y(points[0].v).toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    const N = a.forme === 'lineaire' ? 1 : a.forme === 'doux' ? 12 : 1
    for (let s = 1; s <= N; s++) {
      const x = a.t + ((b.t - a.t) * s) / N
      const y = a.forme === 'palier' ? (s === N ? b.v : a.v) : valeur([a, b], x)!
      d += ` L${X(x).toFixed(1)} ${Y(y).toFixed(1)}`
    }
  }
  const dernier = points[points.length - 1]
  return `${d} L${w} ${Y(dernier.v).toFixed(1)}`
}
