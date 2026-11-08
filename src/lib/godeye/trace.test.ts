import { describe, expect, it } from 'vitest'
import { creerOrbites } from './orbites'
import { lireTle } from './sources'
import { tleDemo } from '../../mock/data/godeye'
import { ajouterPoint, assembler, garderIds, morceauxDepuisPoints, traceSelection, traceSuivi, tracesSatellites, type Historique } from './trace'

describe('morceaux', () => {
  it('coupe à l\'antiméridien et écarte les morceaux d\'un seul point', () => {
    const m = morceauxDepuisPoints([{ lon: 170, lat: 0 }, { lon: 179, lat: 1 }, { lon: -179, lat: 2 }, { lon: -170, lat: 3 }, { lon: NaN, lat: 0 }])
    expect(m).toEqual([[[170, 0], [179, 1]], [[-179, 2], [-170, 3]]])
    expect(morceauxDepuisPoints([{ lon: 1, lat: 1 }])).toEqual([])
  })
})

describe('historique', () => {
  it('ajoute sans modifier, ignore trop proche ou identique, borne la taille', () => {
    const h0: Historique = {}
    const h1 = ajouterPoint(h0, 'avi:1', { t: 0, lon: 1, lat: 1 })
    expect(h0).toEqual({})
    expect(ajouterPoint(h1, 'avi:1', { t: 1000, lon: 2, lat: 2 })).toBe(h1)
    expect(ajouterPoint(h1, 'avi:1', { t: 9000, lon: 1, lat: 1 })).toBe(h1)
    const h2 = ajouterPoint(h1, 'avi:1', { t: 9000, lon: 2, lat: 2 })
    expect(h2['avi:1']).toHaveLength(2)
    let h = h0
    for (let i = 0; i < 10; i++) h = ajouterPoint(h, 'x', { t: i * 10_000, lon: i, lat: 0 }, 3)
    expect(h.x.map((p) => p.lon)).toEqual([7, 8, 9])
  })
  it('garde seulement les identifiants listés', () => {
    const h: Historique = { a: [{ t: 0, lon: 0, lat: 0 }], b: [] }
    expect(garderIds(h, ['a'])).toEqual({ a: h.a })
    expect(garderIds(h, ['a', 'b'])).toBe(h)
  })
  it('trace de sélection et de suivi', () => {
    const h: Historique = { 'avi:1': [{ t: 0, lon: 0, lat: 0 }, { t: 9000, lon: 1, lat: 1 }] }
    expect(traceSelection('avi:1', h)?.genre).toBe('selection')
    expect(traceSelection('avi:2', h)).toBeNull()
    expect(traceSuivi('1', [{ lon: 0, lat: 0 }, { lon: 1, lat: 1 }])?.id).toBe('suivi:1')
  })
})

describe('satellites', () => {
  const orbites = creerOrbites(lireTle(tleDemo()), 'stations')
  it('trace le chemin parcouru depuis des éléments orbitaux', () => {
    expect(orbites).toHaveLength(1)
    const t = tracesSatellites(orbites, null, Date.UTC(2008, 8, 20, 12, 0, 0), { minutes: 40, pasMin: 4 })
    expect(t).toHaveLength(1)
    expect(t[0].genre).toBe('age')
    expect(t[0].morceaux.flat().length).toBeGreaterThanOrEqual(10)
  })
  it('respecte la liste de visibles et le plafond', () => {
    expect(tracesSatellites(orbites, new Set(['zzz']), Date.now())).toEqual([])
    expect(tracesSatellites(orbites, null, Date.now(), { max: 0 })).toEqual([])
  })
})

describe('assembler', () => {
  it('dédoublonne et met la sélection au-dessus', () => {
    const a = { id: 'age:1', genre: 'age' as const, couleur: '#fff', morceaux: [] }
    const s = { id: 'sel:1', genre: 'selection' as const, couleur: '#fff', morceaux: [] }
    expect(assembler([s, null], [a, a]).map((p) => p.id)).toEqual(['age:1', 'sel:1'])
  })
})
