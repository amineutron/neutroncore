import { describe, expect, it } from 'vitest'
import { amasTouche, centreGeo, rayonAmas, regrouper, regrouperActif, texteAmas } from './amas'

type P = { id: string; x: number; y: number; c: string; fixe?: boolean }
const p = (id: string, x: number, y: number, c = 'avions', fixe = false): P => ({ id, x, y, c, fixe })
const cle = (q: P) => q.c
const fixe = (q: P) => !!q.fixe

describe('regrouper', () => {
  it('fait un amas des objets d\'une même case et de la même couche', () => {
    const r = regrouper([p('a', 10, 10), p('b', 20, 20), p('c', 30, 12)], cle, fixe, 46)
    expect(r.libres).toHaveLength(0)
    expect(r.amas).toHaveLength(1)
    expect(r.amas[0].n).toBe(3)
    expect(r.amas[0].x).toBeCloseTo(20)
    expect(r.amas[0].cle).toBe('avions')
  })
  it('ne mélange pas les couches', () => {
    const r = regrouper([p('a', 10, 10), p('b', 12, 12, 'navires')], cle, fixe)
    expect(r.amas).toHaveLength(0)
    expect(r.libres).toHaveLength(2)
  })
  it('laisse libre un objet seul dans sa case et les objets fixes', () => {
    const r = regrouper([p('a', 10, 10), p('b', 12, 12, 'avions', true), p('c', 200, 200)], cle, fixe)
    expect(r.amas).toHaveLength(0)
    expect(r.libres.map((q) => q.id).sort()).toEqual(['a', 'b', 'c'])
  })
  it('respecte le minimum demandé', () => {
    const pts = [p('a', 1, 1), p('b', 2, 2)]
    expect(regrouper(pts, cle, fixe, 46, 3).amas).toHaveLength(0)
    expect(regrouper(pts, cle, fixe, 46, 2).amas).toHaveLength(1)
  })
  it('conserve tous les objets', () => {
    const pts = Array.from({ length: 200 }, (_, i) => p(`o${i}`, (i * 37) % 500, (i * 53) % 400, i % 2 ? 'avions' : 'navires'))
    const r = regrouper(pts, cle, fixe)
    expect(r.libres.length + r.amas.reduce((s, a) => s + a.n, 0)).toBe(200)
  })
})

describe('regrouperActif', () => {
  it('exige réglage, zoom lointain et assez d\'objets', () => {
    expect(regrouperActif(true, 2, 100)).toBe(true)
    expect(regrouperActif(false, 2, 100)).toBe(false)
    expect(regrouperActif(true, 8, 100)).toBe(false)
    expect(regrouperActif(true, 2, 10)).toBe(false)
  })
})

describe('amasTouche, rayon, texte', () => {
  const a = regrouper([p('a', 100, 100), p('b', 104, 104)], cle, fixe).amas
  it('touche l\'amas proche, pas le lointain', () => {
    expect(amasTouche(a, 105, 100)).toBe(a[0])
    expect(amasTouche(a, 300, 300)).toBeNull()
  })
  it('rayon borné', () => {
    expect(rayonAmas(1)).toBe(11)
    expect(rayonAmas(1e9)).toBe(22)
  })
  it('compteur lisible', () => {
    expect([5, 99, 100, 345, 1000, 2500].map(texteAmas)).toEqual(['5', '99', '100+', '300+', '1k+', '2k+'])
  })
})

describe('centreGeo', () => {
  it('moyenne simple', () => { expect(centreGeo([{ lon: 10, lat: 0 }, { lon: 20, lat: 10 }])).toEqual({ lon: 15, lat: 5 }) })
  it('traverse l\'antiméridien', () => {
    const c = centreGeo([{ lon: 179, lat: 0 }, { lon: -179, lat: 0 }])
    expect(Math.abs(c.lon)).toBeCloseTo(180)
  })
  it('vide', () => { expect(centreGeo([])).toEqual({ lon: 0, lat: 0 }) })
})
