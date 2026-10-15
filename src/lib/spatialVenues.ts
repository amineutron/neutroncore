// Lieux du banc d'essai (logique pure) : ta pièce, telle que le plan la décrit, et des scènes
// simulées plus grandes, avec d'autres types d'appareils, pour voir ce que donnerait un effet
// quand on a bien plus de points lumineux.

import { segEnds, segHeight, type Plan } from './plan'
import type { Dims, Fixture, Vec3 } from './spatialFx'

export type Venue = { id: string; label: string; desc: string; dims: Dims; fixtures: Fixture[] }
const PIXELS_PAR_SEGMENT = 2      // un segment du ruban est rendu par quelques points le long de sa longueur

/** Ta pièce : les lampes du plan à leur vraie place, le ruban point par point, la télé comme repère. */
export function pieceReelle(plan: Plan): Venue {
  const dims = { w: plan.roomDims.w, h: plan.roomDims.h, d: plan.roomDims.d }
  const lampes: Fixture[] = Object.entries(plan.configs).map(([id, c]) => ({
    id: `lampe:${id}`, kind: 'lampe', label: c.name, pos: [c.pos.x, c.pos.y, c.pos.z + dims.d / 2],     // z des lampes : centré sur la mi-hauteur
  }))
  const ruban: Fixture[] = (plan.strip?.segs ?? []).flatMap((sg, i) => {
    const [a, b] = segEnds(sg)
    const z = segHeight(sg, plan.roomDims)
    return Array.from({ length: PIXELS_PAR_SEGMENT }, (_, k) => {
      const t = (k + 0.5) / PIXELS_PAR_SEGMENT
      return { id: `ruban:${i}:${k}`, kind: 'barre' as const, label: `ruban, segment ${i + 1}`, pos: [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, z] as Vec3 }
    })
  })
  return { id: 'piece', label: 'ma pièce', desc: `${lampes.length} lampes et le ruban, aux positions du plan`, dims, fixtures: [...lampes, ...ruban] }
}

const ligne = (n: number, de: number, a: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (de + a) / 2 : de + ((a - de) * i) / (n - 1)))

/** Un club : pont de lyres au plafond, projecteurs fixes sur les murs, barres à LED, sol éclairé, stroboscopes. */
export function club(): Venue {
  const dims: Dims = { w: 1200, h: 1000, d: 450 }
  const f: Fixture[] = []
  // deux ponts de lyres au plafond, devant et au milieu
  for (const [rang, y] of ([[0, -300], [1, 150]] as const)) {
    ligne(6, -450, 450).forEach((x, i) => f.push({ id: `projo:${rang}:${i}`, kind: 'projo', label: 'lyre', pos: [x, y, 430] }))
  }
  // projecteurs fixes sur les quatre murs, à mi-hauteur, tournés vers la piste
  ligne(5, -480, 480).forEach((x, i) => {
    f.push({ id: `par:avant:${i}`, kind: 'par', label: 'projecteur fixe', pos: [x, -490, 300], aim: [x * 0.5, -150, 0] })
    f.push({ id: `par:fond:${i}`, kind: 'par', label: 'projecteur fixe', pos: [x, 490, 300], aim: [x * 0.5, 150, 0] })
  })
  ligne(4, -360, 360).forEach((y, i) => {
    f.push({ id: `par:gauche:${i}`, kind: 'par', label: 'projecteur fixe', pos: [-590, y, 300], aim: [-200, y * 0.6, 0] })
    f.push({ id: `par:droite:${i}`, kind: 'par', label: 'projecteur fixe', pos: [590, y, 300], aim: [200, y * 0.6, 0] })
  })
  // quatre barres à LED verticales derrière les platines, huit points chacune
  ligne(4, -300, 300).forEach((x, b) => ligne(8, 40, 400).forEach((z, k) => f.push({ id: `barre:${b}:${k}`, kind: 'barre', label: 'barre à led', pos: [x, -480, z] })))
  // une ligne de LED au sol autour de la piste
  ligne(10, -500, 500).forEach((x, i) => {
    f.push({ id: `sol:g:${i}`, kind: 'barre', label: 'led au sol', pos: [x, 420, 10] })
  })
  ligne(8, -400, 400).forEach((y, i) => {
    f.push({ id: `sol:l:${i}`, kind: 'barre', label: 'led au sol', pos: [-560, y, 10] })
    f.push({ id: `sol:r:${i}`, kind: 'barre', label: 'led au sol', pos: [560, y, 10] })
  })
  // deux stroboscopes en hauteur, au-dessus des platines
  f.push({ id: 'strobe:0', kind: 'strobe', label: 'stroboscope', pos: [-200, -470, 420] }, { id: 'strobe:1', kind: 'strobe', label: 'stroboscope', pos: [200, -470, 420] })
  return { id: 'club', label: 'club', desc: `${f.length} appareils : 12 lyres, 18 projecteurs fixes, barres à led, sol éclairé, 2 stroboscopes`, dims, fixtures: f }
}

/** Un salon agrandi : ce que donnerait ta pièce avec une vingtaine de lampes et un ruban tout autour. */
export function salonEquipe(plan: Plan): Venue {
  const base = pieceReelle(plan)
  const { w, h, d } = base.dims
  const f: Fixture[] = base.fixtures.filter((x) => x.kind === 'lampe')
  // un ruban au plafond sur tout le tour
  const tour: [number, number][] = [
    ...ligne(10, -w / 2 + 15, w / 2 - 15).map((x): [number, number] => [x, -h / 2 + 10]),
    ...ligne(12, -h / 2 + 15, h / 2 - 15).map((y): [number, number] => [w / 2 - 10, y]),
    ...ligne(10, w / 2 - 15, -w / 2 + 15).map((x): [number, number] => [x, h / 2 - 10]),
    ...ligne(12, h / 2 - 15, -h / 2 + 15).map((y): [number, number] => [-w / 2 + 10, y]),
  ]
  tour.forEach(([x, y], i) => f.push({ id: `tour:${i}`, kind: 'barre', label: 'ruban de plafond', pos: [x, y, d - 8] }))
  // des spots encastrés en grille, tournés vers le sol
  ligne(4, -w * 0.33, w * 0.33).forEach((x, i) => ligne(4, -h * 0.33, h * 0.33).forEach((y, j) =>
    f.push({ id: `spot:${i}:${j}`, kind: 'par', label: 'spot de plafond', pos: [x, y, d - 5], aim: [x, y, 0] })))
  // quatre lampes d'appoint au sol, dans les angles
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) f.push({ id: `angle:${sx}:${sy}`, kind: 'lampe', label: 'lampe d’angle', pos: [sx * (w / 2 - 30), sy * (h / 2 - 30), 40] })
  return { id: 'salon', label: 'ma pièce, mieux équipée', desc: `${f.length} points : tes lampes, un ruban de plafond sur tout le tour, 16 spots, 4 lampes d'angle`, dims: base.dims, fixtures: f }
}

export function lieux(plan: Plan): Venue[] {
  return [pieceReelle(plan), salonEquipe(plan), club()]
}
