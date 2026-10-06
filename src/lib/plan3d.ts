// Vue 3D du plan de pièce : projection orthographique simple (comme le Plan3D
// de HALO) — rotation autour de l'axe vertical (yaw) puis inclinaison (tilt).
// Logique pure : le dessin est dans components/RoomPlan3D.tsx.
//
// Repère « monde », en cm : x = gauche/droite et y = avant/arrière centrés sur
// la pièce, z = hauteur depuis le SOL (0 = sol).

import type { RoomDims } from './plan'

export type View = { yaw: number; tilt: number }          // degrés
export type P3 = { x: number; y: number; z: number }
export type P2 = { x: number; y: number; depth: number }   // depth : plus grand = plus près de l'œil
export type Wall = 'top' | 'bottom' | 'left' | 'right'

export const DEFAULT_VIEW: View = { yaw: -32, tilt: 32 }
export const TILT_MIN = 12
export const TILT_MAX = 80

const rad = (d: number) => (d * Math.PI) / 180

/** Projette un point de la pièce sur un écran carré de côté `size`, pièce centrée. */
export function project(p: P3, view: View, dims: RoomDims, size: number): P2 {
  const cy = Math.cos(rad(view.yaw)), sy = Math.sin(rad(view.yaw))
  const ct = Math.cos(rad(view.tilt)), st = Math.sin(rad(view.tilt))
  const xr = p.x * cy - p.y * sy
  const yr = p.x * sy + p.y * cy
  const zc = p.z - dims.d / 2
  // la pièce entière tient dans l'écran quel que soit l'angle : on cadre sur sa diagonale
  const radius = Math.sqrt(dims.w ** 2 + dims.h ** 2 + dims.d ** 2) / 2
  const k = radius > 0 ? (size * 0.46) / radius : 0
  return { x: size / 2 + xr * k, y: size / 2 + (yr * st - zc * ct) * k, depth: yr * ct + zc * st }
}

/** Murs situés derrière la pièce vus de l'œil : les seuls qu'on dessine pleins. */
export function backWalls(view: View): Wall[] {
  const cy = Math.cos(rad(view.yaw)), sy = Math.sin(rad(view.yaw))
  // normale sortante de chaque mur, puis sa composante vers l'œil après rotation
  const normals: [Wall, number, number][] = [['top', 0, -1], ['bottom', 0, 1], ['left', -1, 0], ['right', 1, 0]]
  return normals.filter(([, nx, ny]) => nx * sy + ny * cy < -1e-9).map(([w]) => w)
}

/** Les quatre coins d'un mur, du sol au plafond. */
export function wallCorners(wall: Wall, dims: RoomDims): P3[] {
  const hw = dims.w / 2, hh = dims.h / 2
  const [a, b]: [[number, number], [number, number]] =
    wall === 'top' ? [[-hw, -hh], [hw, -hh]] : wall === 'bottom' ? [[-hw, hh], [hw, hh]]
      : wall === 'left' ? [[-hw, -hh], [-hw, hh]] : [[hw, -hh], [hw, hh]]
  return [{ x: a[0], y: a[1], z: 0 }, { x: b[0], y: b[1], z: 0 }, { x: b[0], y: b[1], z: dims.d }, { x: a[0], y: a[1], z: dims.d }]
}

/** Orbite : glisser horizontalement tourne, verticalement incline (bornée pour ne jamais passer sous le sol). */
export function orbit(view: View, dxPx: number, dyPx: number): View {
  const yaw = (((view.yaw + dxPx * 0.4 + 180) % 360) + 360) % 360 - 180
  return { yaw, tilt: Math.min(TILT_MAX, Math.max(TILT_MIN, view.tilt + dyPx * 0.3)) }
}
