import { describe, expect, it } from 'vitest'
import { TILT_MAX, TILT_MIN, backWalls, heightDelta, orbit, project, wallCorners } from './plan3d'

const dims = { w: 500, h: 600, d: 270 }
const SIZE = 400
const front = { yaw: 0, tilt: 30 }

describe('project', () => {
  it('le centre du volume tombe au centre de l’écran', () => {
    const p = project({ x: 0, y: 0, z: 135 }, front, dims, SIZE)
    expect(p.x).toBeCloseTo(200); expect(p.y).toBeCloseTo(200)
  })
  it('de face : la droite reste à droite, monter fait monter à l’écran, le fond est plus loin', () => {
    const base = project({ x: 0, y: 0, z: 0 }, front, dims, SIZE)
    expect(project({ x: 100, y: 0, z: 0 }, front, dims, SIZE).x).toBeGreaterThan(base.x)
    expect(project({ x: 0, y: 0, z: 100 }, front, dims, SIZE).y).toBeLessThan(base.y)
    expect(project({ x: 0, y: -100, z: 0 }, front, dims, SIZE).depth).toBeLessThan(base.depth)
  })
  it('un quart de tour amène la largeur dans la profondeur', () => {
    const a = project({ x: 100, y: 0, z: 0 }, { yaw: 90, tilt: 30 }, dims, SIZE)
    const b = project({ x: 0, y: 0, z: 0 }, { yaw: 90, tilt: 30 }, dims, SIZE)
    expect(a.x).toBeCloseTo(b.x); expect(a.depth).toBeGreaterThan(b.depth)
  })
  it('toute la pièce tient dans l’écran, quel que soit l’angle', () => {
    for (const yaw of [-170, -90, -32, 0, 45, 133]) for (const tilt of [TILT_MIN, 32, TILT_MAX]) {
      for (const x of [-250, 250]) for (const y of [-300, 300]) for (const z of [0, 270]) {
        const p = project({ x, y, z }, { yaw, tilt }, dims, SIZE)
        expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(SIZE)
        expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(SIZE)
      }
    }
  })
  it('dimensions nulles : pas de NaN', () => {
    const p = project({ x: 0, y: 0, z: 0 }, front, { w: 0, h: 0, d: 0 }, SIZE)
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
  })
})

describe('backWalls', () => {
  it('de face : seul le mur du fond (celui de la tv)', () => expect(backWalls(front)).toEqual(['top']))
  it('de trois quarts : deux murs', () => {
    expect(backWalls({ yaw: -32, tilt: 32 }).sort()).toEqual(['right', 'top'])
    expect(backWalls({ yaw: 32, tilt: 32 }).sort()).toEqual(['left', 'top'])
  })
  it('de dos : le mur opposé', () => expect(backWalls({ yaw: 180, tilt: 30 })).toEqual(['bottom']))
})

describe('wallCorners', () => {
  it('mur du fond, du sol au plafond', () => {
    expect(wallCorners('top', dims)).toEqual([
      { x: -250, y: -300, z: 0 }, { x: 250, y: -300, z: 0 }, { x: 250, y: -300, z: 270 }, { x: -250, y: -300, z: 270 },
    ])
  })
})

describe('orbit', () => {
  it('glisser tourne et incline', () => {
    expect(orbit({ yaw: 0, tilt: 30 }, 100, 10)).toEqual({ yaw: 40, tilt: 33 })
  })
  it('l’inclinaison est bornée, le tour est sans fin', () => {
    expect(orbit({ yaw: 0, tilt: 30 }, 0, 9999).tilt).toBe(TILT_MAX)
    expect(orbit({ yaw: 0, tilt: 30 }, 0, -9999).tilt).toBe(TILT_MIN)
    expect(orbit({ yaw: 170, tilt: 30 }, 50, 0).yaw).toBeCloseTo(-170)
  })
})

describe('heightDelta', () => {
  it('glisser vers le haut monte, vers le bas descend', () => {
    expect(heightDelta(-40, front, dims, SIZE)).toBeGreaterThan(0)
    expect(heightDelta(40, front, dims, SIZE)).toBeLessThan(0)
    expect(heightDelta(0, front, dims, SIZE)).toBeCloseTo(0)
  })
  it('la lampe suit le doigt : monter de h cm déplace sa tête du même nombre d’unités', () => {
    const a = project({ x: 0, y: 0, z: 50 }, front, dims, SIZE), b = project({ x: 0, y: 0, z: 150 }, front, dims, SIZE)
    expect(heightDelta(b.y - a.y, front, dims, SIZE)).toBeCloseTo(100)
  })
  it('vue très plongeante : le gain est plafonné', () => {
    const steep = heightDelta(-10, { yaw: 0, tilt: 89 }, dims, SIZE), capped = heightDelta(-10, { yaw: 0, tilt: TILT_MAX }, dims, SIZE)
    expect(steep).toBeCloseTo(capped)
  })
  it('pièce sans dimensions : zéro, pas de NaN', () => expect(heightDelta(-10, front, { w: 0, h: 0, d: 0 }, SIZE)).toBe(0))
})
