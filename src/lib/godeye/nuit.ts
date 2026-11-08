// God Eye : jour et nuit (logique pure, testée dans nuit.test.ts). Le soleil vient de `positionSoleil` (globe.ts).
export type Soleil = { lat: number; lon: number }
const RAD = Math.PI / 180

/** Altitude du soleil (degrés) en un point : positive le jour, négative la nuit, 0 sur le terminateur. */
export function altitudeSoleil(lat: number, lon: number, s: Soleil): number {
  const sinAlt = Math.sin(lat * RAD) * Math.sin(s.lat * RAD) + Math.cos(lat * RAD) * Math.cos(s.lat * RAD) * Math.cos((lon - s.lon) * RAD)
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / RAD
}

export const estDeNuit = (lat: number, lon: number, s: Soleil): boolean => altitudeSoleil(lat, lon, s) < 0

/**
 * Terminateur : la ligne [lon, lat] qui sépare jour et nuit, de -180 à 180 (n + 1 points). La latitude de chaque longitude
 * vaut atan(-cos(H) / tan(déclinaison)), H étant l'écart de longitude au soleil.
 */
export function terminateur(s: Soleil, n = 144): [number, number][] {
  const dec = Math.abs(s.lat) < 0.05 ? (s.lat < 0 ? -0.05 : 0.05) : s.lat   // équinoxe : évite la division par zéro
  const t = Math.tan(dec * RAD)
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const lon = -180 + (360 * i) / n
    pts.push([lon, Math.atan(-Math.cos((lon - s.lon) * RAD) / t) / RAD])
  }
  return pts
}

/** Le pôle plongé dans la nuit : le sud quand le soleil est au nord de l'équateur, et inversement. */
export const poleDeNuit = (s: Soleil): 90 | -90 => (s.lat >= 0 ? -90 : 90)

/** Polygone de la nuit en [lon, lat], prêt à être projeté : le terminateur refermé par le pôle de nuit. */
export function polygoneNuit(s: Soleil, n = 144): [number, number][] {
  const pole = poleDeNuit(s)
  return [...terminateur(s, n), [180, pole], [-180, pole]]
}
