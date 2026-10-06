// Plan de la pièce (vue de dessus) : géométrie pure. Le plan vient de HALO via
// GET /plan : centimètres, origine au CENTRE de la pièce (x = gauche/droite,
// y = avant/arrière, z = hauteur centrée sur la mi-hauteur).
// Attention au nommage hérité du schéma : roomDims.h = PROFONDEUR, roomDims.d = HAUTEUR.

export type Pos = { x: number; y: number; z: number }
export type RoomDims = { w: number; h: number; d: number }
// segment du ruban LED : centre (cm, centré sur la pièce), angle en degrés (sens
// horaire vu de dessus, 0 = le long de la largeur), longueur en cm
export type StripSeg = { pos: { x: number; y: number }; angle: number; length: number }
export type LightCfg = { pos: Pos; name: string; haloId?: string }
export type Plan = {
  roomDims: RoomDims
  configs: Record<string, LightCfg>
  strip?: { segments: number; segs?: StripSeg[] }
  tv?: { pos: Pos }
  rev?: string   // empreinte du fichier HALO au moment de la lecture, renvoyée à l'enregistrement
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

/** Les deux extrémités d'un segment du ruban. */
export function segEnds(seg: StripSeg): [{ x: number; y: number }, { x: number; y: number }] {
  const a = (seg.angle * Math.PI) / 180
  const hx = (Math.cos(a) * seg.length) / 2, hy = (Math.sin(a) * seg.length) / 2
  return [{ x: seg.pos.x - hx, y: seg.pos.y - hy }, { x: seg.pos.x + hx, y: seg.pos.y + hy }]
}

function withSegs(plan: Plan, fn: (segs: StripSeg[]) => StripSeg[]): Plan {
  const segs = plan.strip?.segs
  if (!plan.strip || !segs) return plan
  return { ...plan, strip: { ...plan.strip, segs: fn(segs) } }
}

/** Déplace le segment `index` vers `xy`. `whole` : tout le ruban suit du même
 * décalage, limité pour qu'aucun segment ne sorte de la pièce (le ruban garde sa forme). */
export function moveSeg(plan: Plan, index: number, xy: { x: number; y: number }, whole: boolean): Plan {
  return withSegs(plan, (segs) => {
    const seg = segs[index]
    if (!seg) return segs
    if (!whole) return segs.map((s, i) => (i === index ? { ...s, pos: clampXY(xy, plan.roomDims) } : s))
    const mx = Math.max(0, plan.roomDims.w / 2 - EDGE_CM), my = Math.max(0, plan.roomDims.h / 2 - EDGE_CM)
    // on ne freine que le sens qui ferait sortir un segment : un ruban déjà hors
    // bornes, ou plus large que la pièce, peut toujours revenir vers l'intérieur
    const span = (get: (s: StripSeg) => number, max: number, want: number) => {
      const lo = -max - Math.min(...segs.map(get)), hi = max - Math.max(...segs.map(get))
      return want > 0 ? Math.min(want, Math.max(0, hi)) : Math.max(want, Math.min(0, lo))
    }
    const dx = span((s) => s.pos.x, mx, xy.x - seg.pos.x), dy = span((s) => s.pos.y, my, xy.y - seg.pos.y)
    return segs.map((s) => ({ ...s, pos: { x: r1(s.pos.x + dx), y: r1(s.pos.y + dy) } }))
  })
}

// angle ramené dans ]-180, 180]
export function normAngle(deg: number): number {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180
  return a === -180 ? 180 : Math.round(a * 10) / 10
}

export function rotateSeg(plan: Plan, index: number, angle: number): Plan {
  if (!Number.isFinite(angle)) return plan
  return withSegs(plan, (segs) => segs.map((s, i) => (i === index ? { ...s, angle: normAngle(angle) } : s)))
}

/** Change une dimension ; lampes et ruban restent dans la pièce, les lampes à la même hauteur depuis le sol. */
export function resizeRoom(plan: Plan, axis: keyof RoomDims, valueCm: number): Plan {
  if (!Number.isFinite(valueCm)) return plan
  const roomDims = { ...plan.roomDims, [axis]: clamp(Math.round(valueCm), ROOM_MIN_CM, ROOM_MAX_CM) }
  const configs = Object.fromEntries(Object.entries(plan.configs).map(([id, cfg]) => {
    const z = axis === 'd' ? zFromHeight(heightFromFloor(cfg.pos.z, plan.roomDims), roomDims) : cfg.pos.z
    return [id, { ...cfg, pos: { ...clampXY(cfg.pos, roomDims), z } }]
  }))
  return withSegs({ ...plan, roomDims, configs }, (segs) => segs.map((sg) => ({ ...sg, pos: clampXY(sg.pos, roomDims) })))
}

// ce que PUT /plan accepte : dimensions, positions des lampes, position et angle
// des segments du ruban (leur longueur, leur nombre et la TV restent à HALO)
export type PlanPayload = {
  roomDims: RoomDims
  configs: Record<string, { pos: Pos; name: string }>
  strip?: { segs: { pos: { x: number; y: number }; angle: number }[] }
  rev?: string
}
const stripPart = (plan: Plan) => plan.strip?.segs?.map(({ pos, angle }) => ({ pos, angle }))

/** `base` : le plan tel qu'enregistré. Le ruban n'est envoyé que s'il a été
 * modifié ici — déplacer une lampe ne doit jamais réécrire un ruban réglé dans HALO. */
export function toPayload(plan: Plan, base?: Plan): PlanPayload {
  const payload: PlanPayload = {
    roomDims: plan.roomDims,
    configs: Object.fromEntries(Object.entries(plan.configs).map(([id, c]) => [id, { pos: c.pos, name: c.name }])),
  }
  const segs = stripPart(plan)
  const touched = segs && (!base || JSON.stringify(segs) !== JSON.stringify(stripPart(base)))
  return { ...payload, ...(touched ? { strip: { segs } } : {}), ...(plan.rev ? { rev: plan.rev } : {}) }
}

export function isDirty(a: Plan, b: Plan): boolean {
  const content = (p: Plan) => JSON.stringify({ ...toPayload(p), rev: undefined })
  return content(a) !== content(b)
}
