// God Eye : géométrie du globe (position, visibilité, soleil, zone vue) et placement des étiquettes flottantes.
// Logique pure, testée dans globe.test.ts : aucune dépendance à three ni au DOM.
import type { Boite } from './modele'

export type Vec3 = [number, number, number]
const RAD = Math.PI / 180

/** Point de la sphère unité (y vers le nord) : x vers (0 N, 0 E), z vers 90 O, comme la sphère de three.js avec une texture équirectangulaire. */
export function pointSphere(latDeg: number, lonDeg: number): Vec3 {
  const lat = latDeg * RAD, lon = lonDeg * RAD
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)]
}

export const produit = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Un point de la sphère unité est vu par une caméra à `positionCamera` (hors horizon) quand il est du bon côté du plan tangent. */
export function visible(p: Vec3, positionCamera: Vec3, marge = 0): boolean {
  return produit(p, positionCamera) > 1 + marge
}

/** Point atteint en parcourant `degres` degrés d'arc depuis (lat, lon) selon le cap (degrés, sens horaire depuis le nord). */
export function destination(lat: number, lon: number, capDeg: number, degres: number): [number, number] {
  const d = degres * RAD, cap = capDeg * RAD, p1 = lat * RAD, l1 = lon * RAD
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(cap))
  const l2 = l1 + Math.atan2(Math.sin(cap) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2))
  return [p2 / RAD, ((((l2 / RAD) + 540) % 360) - 180)]
}

/** Position du soleil au zénith (latitude = déclinaison, longitude = heure solaire moyenne) : de quoi éclairer le jour et assombrir la nuit. */
export function positionSoleil(date: Date): { lat: number; lon: number } {
  const debut = Date.UTC(date.getUTCFullYear(), 0, 0)
  const jour = (date.getTime() - debut) / 86_400_000
  const lat = 23.44 * Math.sin(((2 * Math.PI) / 365.25) * (jour - 80))
  const heures = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const lon = ((((12 - heures) * 15) + 540) % 360) - 180
  return { lat, lon }
}

// ----------------------------------------------------------------------------- zoom et zone vue

export const DIST_MIN = 1.55
export const DIST_MAX = 4.2
export const ZOOM_GLOBE_MAX = 40

/** Même échelle de zoom que la carte à plat (1 = toute la Terre, 40 = très proche) : une vue enregistrée vaut pour les deux modes. */
export function distanceDepuisZoom(zoom: number): number {
  const z = Math.min(ZOOM_GLOBE_MAX, Math.max(1, Number.isFinite(zoom) ? zoom : 1))
  const t = Math.log(z) / Math.log(ZOOM_GLOBE_MAX)
  return DIST_MAX - t * (DIST_MAX - DIST_MIN)
}
export function zoomDepuisDistance(dist: number): number {
  const d = Math.min(DIST_MAX, Math.max(DIST_MIN, dist))
  return Math.exp(((DIST_MAX - d) / (DIST_MAX - DIST_MIN)) * Math.log(ZOOM_GLOBE_MAX))
}

/** Rayon angulaire (degrés d'arc) vu de la caméra pour un demi-angle de champ `alphaDeg` : tout le disque visible si le rayon sort de la sphère. */
export function rayonVisible(dist: number, alphaDeg: number): number {
  const s = dist * Math.sin(alphaDeg * RAD)
  const horizon = Math.acos(1 / dist) / RAD
  return s >= 1 ? horizon : Math.min(horizon, (Math.asin(s) - alphaDeg * RAD) / RAD)
}

/** Zone de la Terre vue depuis le centre (lat, lon) à la distance `dist` (champ vertical `fovDeg`, rapport largeur/hauteur `aspect`). */
export function boiteDeGlobe(lat: number, lon: number, dist: number, fovDeg = 35, aspect = 1.6): Boite {
  const av = fovDeg / 2
  const ah = Math.atan(Math.tan(av * RAD) * aspect) / RAD
  const rv = rayonVisible(dist, av), rh = rayonVisible(dist, ah)
  const sud = Math.max(-90, lat - rv), nord = Math.min(90, lat + rv)
  if (nord >= 85 || sud <= -85) return { sud, nord, ouest: -180, est: 180 }
  const pire = Math.max(Math.abs(sud), Math.abs(nord))
  const ecart = Math.min(180, rh / Math.max(0.05, Math.cos(pire * RAD)))
  const ouest = lon - ecart, est = lon + ecart
  if (ouest < -180 || est > 180) return { sud, nord, ouest: -180, est: 180 }
  return { sud, nord, ouest, est }
}

// ----------------------------------------------------------------------------- étiquettes flottantes

export type Candidat = { id: string; x: number; y: number; w: number; h: number; poids: number }
export type Place = { id: string; x: number; y: number; cote: 'd' | 'g' | 'h' | 'b'; ancre: [number, number] }

const recouvre = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, marge: number): boolean =>
  a.x < b.x + b.w + marge && a.x + a.w + marge > b.x && a.y < b.y + b.h + marge && a.y + a.h + marge > b.y

/**
 * Place au plus `max` étiquettes à côté de leur point (x, y), sans qu'elles se recouvrent ni sortent du cadre `w` x `h`.
 * Les plus importantes (poids) sont servies d'abord ; chacune essaie la droite, la gauche, le haut puis le bas du point ;
 * celle qui n'a de place nulle part est simplement omise. `bloques` = zones à éviter (commandes, fiche ouverte).
 */
export function placerEtiquettes(
  candidats: readonly Candidat[], w: number, h: number, max: number, bloques: readonly { x: number; y: number; w: number; h: number }[] = [], ecart = 12,
): Place[] {
  const occupe: { x: number; y: number; w: number; h: number }[] = [...bloques]
  const sortie: Place[] = []
  for (const c of [...candidats].sort((a, b) => b.poids - a.poids || a.id.localeCompare(b.id))) {
    if (sortie.length >= max) break
    const essais: [Place['cote'], number, number][] = [
      ['d', c.x + ecart, c.y - c.h / 2], ['g', c.x - ecart - c.w, c.y - c.h / 2],
      ['h', c.x - c.w / 2, c.y - ecart - c.h], ['b', c.x - c.w / 2, c.y + ecart],
    ]
    for (const [cote, x, y] of essais) {
      const r = { x, y, w: c.w, h: c.h }
      if (x < 4 || y < 4 || x + c.w > w - 4 || y + c.h > h - 4) continue
      if (occupe.some((o) => recouvre(r, o, 4))) continue
      occupe.push(r)
      sortie.push({ id: c.id, x, y, cote, ancre: [c.x, c.y] })
      break
    }
  }
  return sortie
}
