// God Eye : tuiles satellite (logique pure, testée). Les tuiles sont en projection Mercator ; la carte est équirectangulaire,
// donc chaque tuile est redessinée en bandes horizontales (voir dessinTuiles.ts). Ici : quelles tuiles, à quel niveau, quelle URL.
import { deprojeter, type Vue } from '../vueMonde'

/** Imagerie satellite mondiale (Esri World Imagery), accessible sans clé. La source est citée à l'écran. */
export const URL_TUILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
export const ATTRIBUTION_TUILES = 'imagerie : Esri, Maxar, Earthstar Geographics'
export const NIVEAU_MAX = 13
/** Au-delà, on charge moins de tuiles plutôt que d'en demander des centaines (téléphone, forfait). */
export const TUILES_MAX = 80
export const LAT_MERCATOR = 85.0511287798

export type Tuile = { z: number; x: number; y: number }

export function urlTuile(t: Tuile, modele = URL_TUILES): string {
  return modele.replace('{z}', String(t.z)).replace('{y}', String(t.y)).replace('{x}', String(t.x))
}

/** Latitude (degrés) du bord haut de la rangée `y` au niveau `z` ; y peut être fractionnaire. */
export function latDeRangee(y: number, z: number): number {
  const n = Math.PI * (1 - (2 * y) / 2 ** z)
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI
}

/** Rangée (fractionnaire) d'une latitude au niveau `z`, bornée à la zone couverte. */
export function rangeeDeLat(lat: number, z: number): number {
  const l = Math.max(-LAT_MERCATOR, Math.min(LAT_MERCATOR, lat))
  const r = (l * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}

export const lonDeColonne = (x: number, z: number): number => (x / 2 ** z) * 360 - 180
export const colonneDeLon = (lon: number, z: number): number => ((lon + 180) / 360) * 2 ** z

/**
 * Niveau de tuile qui donne à peu près un pixel de tuile par pixel d'écran (physique) : `pxParDegre` en pixels CSS.
 * Le -0.4 accepte une image un peu agrandie plutôt que quatre fois plus de tuiles.
 */
export function niveauPourEchelle(pxParDegre: number, dpr: number): number {
  const px = Math.max(1e-6, pxParDegre * dpr)
  const z = Math.ceil(Math.log2((px * 360) / 256) - 0.4)
  return Math.max(0, Math.min(NIVEAU_MAX, z))
}

/** Tuiles qui couvrent la toile pour une vue donnée, du centre vers les bords (les plus utiles d'abord), plafonnées. */
export function tuilesVisibles(vue: Vue, w: number, h: number, dpr: number): { z: number; tuiles: Tuile[] } {
  const s = Math.min(w / 360, h / 180) * vue.zoom
  let z = niveauPourEchelle(s, dpr)
  const [lonO, latN] = deprojeter(0, 0, vue, w, h)
  const [lonE, latS] = deprojeter(w, h, vue, w, h)
  const enum_ = (zz: number): Tuile[] => {
    const n = 2 ** zz
    const x0 = Math.max(0, Math.floor(colonneDeLon(Math.max(-180, lonO), zz)))
    const x1 = Math.min(n - 1, Math.floor(colonneDeLon(Math.min(180, lonE), zz) - 1e-9))
    const y0 = Math.max(0, Math.floor(rangeeDeLat(Math.min(LAT_MERCATOR, latN), zz)))
    const y1 = Math.min(n - 1, Math.floor(rangeeDeLat(Math.max(-LAT_MERCATOR, latS), zz) - 1e-9))
    const sortie: Tuile[] = []
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) sortie.push({ z: zz, x, y })
    return sortie
  }
  let liste = enum_(z)
  while (liste.length > TUILES_MAX && z > 0) liste = enum_(--z)
  const cx = (lonO + lonE) / 2, cy = (latN + latS) / 2
  const centre = { x: colonneDeLon(cx, z), y: rangeeDeLat(cy, z) }
  liste.sort((a, b) => Math.hypot(a.x + 0.5 - centre.x, a.y + 0.5 - centre.y) - Math.hypot(b.x + 0.5 - centre.x, b.y + 0.5 - centre.y))
  return { z, tuiles: liste }
}

/** Tuile parente `n` niveaux plus haut, et la part de celle-ci (en fraction 0..1) que couvre la tuile d'origine. */
export function ancetre(t: Tuile, n: number): { tuile: Tuile; sx: number; sy: number; sl: number } | null {
  if (n < 1 || n > t.z) return null
  const f = 2 ** n
  const tuile = { z: t.z - n, x: Math.floor(t.x / f), y: Math.floor(t.y / f) }
  return { tuile, sx: (t.x - tuile.x * f) / f, sy: (t.y - tuile.y * f) / f, sl: 1 / f }
}

/** Nombre de bandes pour redessiner une tuile Mercator sur une carte équirectangulaire (plus la tuile est haute à l'écran, plus il en faut). */
export function nombreBandes(hauteurPx: number): number {
  return Math.max(2, Math.min(24, Math.ceil(hauteurPx / 10)))
}
