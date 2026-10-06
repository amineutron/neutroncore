// Plan de la pièce (vue de dessus) : géométrie pure. Le plan vient de HALO via
// GET /plan : centimètres, origine au CENTRE de la pièce (x = gauche/droite,
// y = avant/arrière, z = hauteur centrée sur la mi-hauteur).
// Attention au nommage hérité du schéma : roomDims.h = PROFONDEUR, roomDims.d = HAUTEUR.

export type Pos = { x: number; y: number; z: number }
export type RoomDims = { w: number; h: number; d: number }
export type LightCfg = { pos: Pos; name: string; haloId?: string }
export type Plan = {
  roomDims: RoomDims
  configs: Record<string, LightCfg>
  strip?: { pos: { x: number; y: number }; stripEnd: { x: number; y: number }; segments: number }
  tv?: { pos: Pos }
}

export const ROOM_MIN_CM = 100
export const ROOM_MAX_CM = 3000
const EDGE_CM = 5   // une lampe ne se pose pas dans l'épaisseur du mur

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r1 = (v: number) => Math.round(v * 10) / 10

/** Position de la pièce (centrée) -> coordonnées du dessin (origine coin haut-gauche). */
export function toSvg(pos: { x: number; y: number }, dims: RoomDims): { x: number; y: number } {
  return { x: pos.x + dims.w / 2, y: pos.y + dims.h / 2 }
}

/** Point du dessin -> position de la pièce, ramenée à l'intérieur des murs. */
export function fromSvg(pt: { x: number; y: number }, dims: RoomDims): { x: number; y: number } {
  return clampXY({ x: pt.x - dims.w / 2, y: pt.y - dims.h / 2 }, dims)
}

export function clampXY(pos: { x: number; y: number }, dims: RoomDims): { x: number; y: number } {
  const mx = Math.max(0, dims.w / 2 - EDGE_CM), my = Math.max(0, dims.h / 2 - EDGE_CM)
  return { x: r1(clamp(pos.x, -mx, mx)), y: r1(clamp(pos.y, -my, my)) }
}

// hauteur lue par l'utilisateur : depuis le sol, pas depuis la mi-hauteur
export function heightFromFloor(z: number, dims: RoomDims): number {
  return Math.round(z + dims.d / 2)
}
export function zFromHeight(heightCm: number, dims: RoomDims): number {
  return r1(clamp(heightCm, 0, dims.d) - dims.d / 2)
}

export function moveLight(plan: Plan, id: string, xy: { x: number; y: number }): Plan {
  const cfg = plan.configs[id]
  if (!cfg) return plan
  return { ...plan, configs: { ...plan.configs, [id]: { ...cfg, pos: { ...cfg.pos, ...clampXY(xy, plan.roomDims) } } } }
}

export function setHeight(plan: Plan, id: string, heightCm: number): Plan {
  const cfg = plan.configs[id]
  if (!cfg) return plan
  return { ...plan, configs: { ...plan.configs, [id]: { ...cfg, pos: { ...cfg.pos, z: zFromHeight(heightCm, plan.roomDims) } } } }
}

/** Change une dimension ; les lampes restent dans la pièce, à la même hauteur depuis le sol. */
export function resizeRoom(plan: Plan, axis: keyof RoomDims, valueCm: number): Plan {
  if (!Number.isFinite(valueCm)) return plan
  const roomDims = { ...plan.roomDims, [axis]: clamp(Math.round(valueCm), ROOM_MIN_CM, ROOM_MAX_CM) }
  const configs = Object.fromEntries(Object.entries(plan.configs).map(([id, cfg]) => {
    const z = axis === 'd' ? zFromHeight(heightFromFloor(cfg.pos.z, plan.roomDims), roomDims) : cfg.pos.z
    return [id, { ...cfg, pos: { ...clampXY(cfg.pos, roomDims), z } }]
  }))
  return { ...plan, roomDims, configs }
}

// ce que PUT /plan accepte : dimensions + positions (le ruban et la TV restent à HALO)
export function toPayload(plan: Plan): { roomDims: RoomDims; configs: Record<string, { pos: Pos; name: string }> } {
  return {
    roomDims: plan.roomDims,
    configs: Object.fromEntries(Object.entries(plan.configs).map(([id, c]) => [id, { pos: c.pos, name: c.name }])),
  }
}

export function isDirty(a: Plan, b: Plan): boolean {
  return JSON.stringify(toPayload(a)) !== JSON.stringify(toPayload(b))
}
