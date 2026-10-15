// Plan de la pièce (vue de dessus) : géométrie pure. Le plan vient de HALO via
// GET /plan : centimètres, origine au CENTRE de la pièce (x = gauche/droite,
// y = avant/arrière, z = hauteur centrée sur la mi-hauteur).
// Attention au nommage hérité du schéma : roomDims.h = PROFONDEUR, roomDims.d = HAUTEUR.

export type Pos = { x: number; y: number; z: number }
export type RoomDims = { w: number; h: number; d: number }
// segment du ruban LED : centre (cm, centré sur la pièce), angle en degrés (sens
// horaire vu de dessus, 0 = le long de la largeur), longueur en cm
// `z` : hauteur depuis le sol en cm ; null = jamais réglée (dessinée à 1,80 m, ou sous le plafond)
export type StripSeg = { pos: { x: number; y: number }; angle: number; length: number; z?: number | null }
export type LightCfg = { pos: Pos; name: string; haloId?: string }
export type Plan = {
  roomDims: RoomDims
  configs: Record<string, LightCfg>
  strip?: { segments: number; segs?: StripSeg[]; length?: number }
  tv?: { pos: Pos }
  rev?: string   // empreinte du fichier HALO au moment de la lecture, renvoyée à l'enregistrement
}

export const ROOM_MIN_CM = 100
export const ROOM_MAX_CM = 3000
const EDGE_CM = 5   // une lampe ne se pose pas dans l'épaisseur du mur

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r1 = (v: number) => Math.round(v * 10) / 10 || 0      // « || 0 » : jamais de zéro négatif

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
  const next = fn(segs)
  return { ...plan, strip: { ...plan.strip, segs: next, segments: next.length } }
}

export const STRIP_H = 180            // hauteur par défaut du ruban, en cm
export const SEG_MIN_CM = 3
export const SEG_MAX_CM = 1000
export const MAX_SEGS = 40

/** Hauteur d'un segment depuis le sol : celle qu'on lui a donnée, sinon 1,80 m (ou 20 cm sous le plafond). */
export function segHeight(seg: StripSeg, dims: RoomDims): number {
  const defaut = Math.min(STRIP_H, Math.max(0, dims.d - 20))
  return typeof seg.z === 'number' && Number.isFinite(seg.z) ? clamp(seg.z, 0, dims.d) : defaut
}

/** Règle la hauteur du segment `index` ; `whole` : tout le ruban monte ou descend du même écart. */
export function setSegHeight(plan: Plan, index: number, heightCm: number, whole: boolean): Plan {
  if (!Number.isFinite(heightCm)) return plan
  return withSegs(plan, (segs) => {
    const seg = segs[index]
    if (!seg) return segs
    const dims = plan.roomDims
    const ecart = clamp(heightCm, 0, dims.d) - segHeight(seg, dims)
    return segs.map((s, i) => (whole || i === index ? { ...s, z: Math.round(clamp(segHeight(s, dims) + ecart, 0, dims.d)) } : s))
  })
}

export function setSegLength(plan: Plan, index: number, lengthCm: number): Plan {
  if (!Number.isFinite(lengthCm)) return plan
  return withSegs(plan, (segs) => segs.map((s, i) => (i === index ? { ...s, length: r1(clamp(lengthCm, SEG_MIN_CM, SEG_MAX_CM)) } : s)))
}

/** Ajoute un segment au bout du segment `after` (dans son prolongement, même longueur et même hauteur). */
export function addSeg(plan: Plan, after: number): Plan {
  return withSegs(plan, (segs) => {
    const ref = segs[after] ?? segs[segs.length - 1]
    if (!ref || segs.length >= MAX_SEGS) return segs
    const a = (ref.angle * Math.PI) / 180
    const neuf: StripSeg = { ...ref, pos: clampXY({ x: r1(ref.pos.x + Math.cos(a) * ref.length), y: r1(ref.pos.y + Math.sin(a) * ref.length) }, plan.roomDims) }
    const at = segs.indexOf(ref) + 1
    return [...segs.slice(0, at), neuf, ...segs.slice(at)]
  })
}

/** Retire le segment `index` (il en reste toujours au moins un). */
export function removeSeg(plan: Plan, index: number): Plan {
  return withSegs(plan, (segs) => (segs.length > 1 && segs[index] ? segs.filter((_, i) => i !== index) : segs))
}

/** Redécoupe le ruban en gardant son tracé : `parts` = part de la longueur totale de chaque nouveau segment
 * (le vrai découpage du ruban Hue : 7 segments inégaux). Chaque nouveau segment est posé le long de l'ancien
 * tracé, à l'endroit où tombe son milieu, avec l'angle et la hauteur du morceau qui le porte. */
export function resampleStrip(plan: Plan, parts: number[]): Plan {
  const somme = parts.reduce((t, p) => t + p, 0)
  if (parts.length < 1 || parts.length > MAX_SEGS || !(somme > 0) || parts.some((p) => !(p > 0))) return plan
  return withSegs(plan, (segs) => {
    const total = segs.reduce((t, sg) => t + sg.length, 0)
    if (!(total > 0)) return segs
    let debut = 0
    return parts.map((part) => {
      const longueur = (part / somme) * total
      const milieu = debut + longueur / 2
      debut += longueur
      // morceau de l'ancien tracé qui contient ce milieu
      let avant = 0
      let porteur = segs[segs.length - 1], dans = porteur.length
      for (const sg of segs) {
        if (milieu <= avant + sg.length + 1e-9) { porteur = sg; dans = milieu - avant; break }
        avant += sg.length
      }
      const a = (porteur.angle * Math.PI) / 180
      const depuisCentre = dans - porteur.length / 2
      return { ...porteur, length: r1(longueur), pos: { x: r1(porteur.pos.x + Math.cos(a) * depuisCentre), y: r1(porteur.pos.y + Math.sin(a) * depuisCentre) } }
    })
  })
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

// ce que PUT /plan accepte : dimensions, positions des lampes, et les segments du ruban (position,
// angle, longueur, hauteur ; leur nombre peut changer). La TV reste à HALO.
export type PlanPayload = {
  roomDims: RoomDims
  configs: Record<string, { pos: Pos; name: string }>
  strip?: { segs: { pos: { x: number; y: number }; angle: number; length: number; z?: number }[] }
  rev?: string
}
// une hauteur jamais réglée n'est pas envoyée : HALO garde son propre défaut
const stripPart = (plan: Plan) => plan.strip?.segs?.map(({ pos, angle, length, z }) => ({ pos, angle, length, ...(typeof z === 'number' ? { z } : {}) }))

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
