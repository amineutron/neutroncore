import { describe, expect, it } from 'vitest'
import { ageTexte, borner, deplacer, deprojeter, lireUsgs, niveauCyber, plusProche, projeter, rayonSeisme, tonSeisme, VUE_DEPART, zoomerAutour } from './vueMonde'
import { TERRE_DIXIEMES } from './vueMondeTerre'

const W = 720
const H = 360

describe('projection', () => {
  it('projeter puis déprojeter rend le point de départ', () => {
    const v = { cx: 20, cy: 10, zoom: 3 }
    const [x, y] = projeter(2.4, 46.6, v, W, H)
    const [lon, lat] = deprojeter(x, y, v, W, H)
    expect(lon).toBeCloseTo(2.4, 6)
    expect(lat).toBeCloseTo(46.6, 6)
  })
  it('au zoom 1, le monde entier tient dans la toile', () => {
    const v = { cx: 0, cy: 0, zoom: 1 }
    expect(projeter(-180, 90, v, W, H)).toEqual([0, 0])
    expect(projeter(180, -90, v, W, H)).toEqual([W, H])
  })
  it('zoomer autour d\'un point le laisse en place', () => {
    const v = borner({ ...VUE_DEPART, zoom: 2 }, W, H)
    const avant = deprojeter(300, 120, v, W, H)
    const n = zoomerAutour(v, 2, 300, 120, W, H)
    const apres = deprojeter(300, 120, n, W, H)
    expect(apres[0]).toBeCloseTo(avant[0], 4)
    expect(apres[1]).toBeCloseTo(avant[1], 4)
  })
  it('borne le zoom et le centre', () => {
    const v = borner({ cx: 999, cy: -999, zoom: 1e9 }, W, H)
    expect(v.zoom).toBe(40)
    expect(Math.abs(v.cx)).toBeLessThanOrEqual(180)
    expect(borner({ cx: 50, cy: 50, zoom: 1 }, W, H)).toEqual({ cx: 0, cy: 0, zoom: 1 })
    expect(borner({ cx: NaN, cy: NaN, zoom: NaN }, W, H)).toEqual({ cx: 0, cy: 0, zoom: 1 })
  })
  it('déplacer suit le doigt', () => {
    const n = deplacer({ cx: 0, cy: 0, zoom: 4 }, 40, 0, W, H)
    expect(n.cx).toBeLessThan(0)
  })
})

describe('séismes', () => {
  const geo = (id: unknown, c: unknown, mag: unknown, time: unknown) => ({ id, geometry: { coordinates: c }, properties: { mag, time, place: 'ici' } })
  it('lit un flux USGS et trie du plus récent', () => {
    const r = lireUsgs({ features: [geo('a', [10, 20, 5], 3, 1000), geo('b', [11, 21, 8], 4.5, 2000)] })
    expect(r.map((s) => s.id)).toEqual(['b', 'a'])
    expect(r[0]).toMatchObject({ lon: 11, lat: 21, prof: 8, mag: 4.5 })
  })
  it.each([
    [null], [{}], [{ features: 3 }],
    [{ features: [geo(1, [1, 2, 3], 3, 1)] }],
    [{ features: [geo('a', [1, 99, 3], 3, 1)] }],
    [{ features: [geo('a', [1, 2], null, 1)] }],
    [{ features: [geo('a', [NaN, 2, 3], 3, 1)] }],
    [{ features: [null, 'x'] }],
  ])('ignore l\'inattendu %#', (brut) => { expect(lireUsgs(brut)).toEqual([]) })
  it('tons et rayons croissants', () => {
    expect(tonSeisme(4)).toBe('ok'); expect(tonSeisme(5.2)).toBe('warn'); expect(tonSeisme(6.8)).toBe('crit')
    expect(rayonSeisme(7)).toBeGreaterThan(rayonSeisme(4))
    expect(rayonSeisme(-5)).toBe(2.5); expect(rayonSeisme(20)).toBe(22)
  })
  it('âge en clair', () => {
    expect(ageTexte(0, 5 * 60000)).toBe('il y a 5 min')
    expect(ageTexte(0, 3 * 3600000)).toBe('il y a 3 h')
    expect(ageTexte(0, 72 * 3600000)).toBe('il y a 3 j')
  })
  it('trouve le séisme le plus proche du clic', () => {
    const v = { cx: 0, cy: 0, zoom: 1 }
    const a = { id: 'a', mag: 5, lieu: '', lon: 0, lat: 0, prof: 0, t: 0 }
    const b = { id: 'b', mag: 5, lieu: '', lon: 100, lat: 50, prof: 0, t: 0 }
    const [x, y] = projeter(0, 0, v, W, H)
    expect(plusProche([b, a], x + 3, y, v, W, H)?.id).toBe('a')
    expect(plusProche([a, b], x + 200, y + 100, v, W, H)).toBeNull()
  })
})

describe('divers', () => {
  it('niveau cyber inconnu = calme', () => {
    expect(niveauCyber('crit')).toBe('crit'); expect(niveauCyber('x')).toBe('ok'); expect(niveauCyber(undefined)).toBe('ok')
  })
  it('contours des terres : anneaux valides et dans le monde', () => {
    expect(TERRE_DIXIEMES.length).toBeGreaterThan(100)
    for (const r of TERRE_DIXIEMES) {
      expect(r.length % 2).toBe(0)
      for (let i = 0; i < r.length; i += 2) {
        expect(Math.abs(r[i])).toBeLessThanOrEqual(1800)
        expect(Math.abs(r[i + 1])).toBeLessThanOrEqual(900)
      }
    }
  })
})
