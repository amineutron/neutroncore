import { describe, expect, it } from 'vitest'
import { bboxDeCercle, changerForme, corpsZone, dansZone, deplacerZone, distanceKm, erreursZone, lireZones, polygoneCercle, polygoneRect, polygoneZone, resumeForme, zoneVide, type ZoneBrouillon } from './zones'

const cercle = (o: Partial<ZoneBrouillon> = {}): ZoneBrouillon => ({ ...zoneVide(48.85, 2.35), nom: 'Paris', ...o })

describe('distanceKm', () => {
  it('Paris - Londres ~ 344 km', () => expect(distanceKm(48.8566, 2.3522, 51.5074, -0.1278)).toBeGreaterThan(340))
  it('traverse l\'antiméridien', () => expect(distanceKm(0, 179.5, 0, -179.5)).toBeCloseTo(111.2, 0))
})

describe('erreursZone', () => {
  it('zone valide', () => expect(erreursZone(cercle())).toEqual([]))
  it.each([
    ['nom vide', { nom: ' ' }], ['lat hors bornes', { centre: { lat: 91, lon: 0 } }], ['lon hors bornes', { centre: { lat: 0, lon: 181 } }],
    ['rayon nul', { rayon_km: 0 }], ['rayon trop grand', { rayon_km: 5001 }], ['rayon NaN', { rayon_km: Number.NaN }], ['aucun objet', { objets: [] }],
    ['nom trop long', { nom: 'x'.repeat(41) }],
  ] as [string, Partial<ZoneBrouillon>][])('refuse : %s', (_n, o) => expect(erreursZone(cercle(o)).length).toBeGreaterThan(0))
  it('rect : sud >= nord refusé, antiméridien accepté', () => {
    const r = (bbox: { s: number; w: number; n: number; e: number }) => erreursZone(cercle({ forme: 'rect', bbox }))
    expect(r({ s: 10, w: 0, n: 10, e: 5 }).length).toBeGreaterThan(0)
    expect(r({ s: 0, w: 170, n: 10, e: -170 })).toEqual([])
    expect(r({ s: 0, w: 5, n: 10, e: 5 }).length).toBeGreaterThan(0)
  })
  it('rect sans bbox refusé', () => expect(erreursZone(cercle({ forme: 'rect' })).length).toBeGreaterThan(0))
})

describe('dansZone', () => {
  it('cercle', () => {
    const z = cercle({ rayon_km: 100 })
    expect(dansZone(z, 48.9, 2.4)).toBe(true)
    expect(dansZone(z, 51.5, -0.1)).toBe(false)
  })
  it('cercle à cheval sur l\'antiméridien', () => {
    expect(dansZone(cercle({ centre: { lat: 0, lon: 179.9 }, rayon_km: 100 }), 0, -179.8)).toBe(true)
  })
  it('rect simple et antiméridien', () => {
    const a = cercle({ forme: 'rect', bbox: { s: 0, w: 10, n: 10, e: 20 } })
    expect(dansZone(a, 5, 15)).toBe(true)
    expect(dansZone(a, 5, 25)).toBe(false)
    const b = cercle({ forme: 'rect', bbox: { s: -10, w: 170, n: 10, e: -170 } })
    expect(dansZone(b, 0, 175)).toBe(true)
    expect(dansZone(b, 0, -175)).toBe(true)
    expect(dansZone(b, 0, 0)).toBe(false)
    expect(dansZone(b, 0, 185)).toBe(true)
  })
})

describe('polygones', () => {
  it('cercle : fermé, points à la bonne distance', () => {
    const p = polygoneCercle(40, 10, 300, 32)
    expect(p).toHaveLength(33)
    expect(p[0]).toEqual(p[32])
    for (const [lo, la] of p) expect(distanceKm(40, 10, la, lo)).toBeCloseTo(300, 0)
  })
  it('cercle franchissant l\'antiméridien : longitudes continues', () => {
    const p = polygoneCercle(0, 179.5, 300, 48)
    for (let i = 1; i < p.length; i++) expect(Math.abs(p[i][0] - p[i - 1][0])).toBeLessThan(20)
    expect(Math.max(...p.map((q) => q[0]))).toBeGreaterThan(180)
  })
  it('rect enjambant l\'antiméridien : continu', () => {
    const p = polygoneRect({ s: 0, w: 170, n: 10, e: -170 })
    expect(Math.max(...p.map((q) => q[0]))).toBe(190)
    expect(p[0]).toEqual(p[p.length - 1])
  })
  it('zone incohérente : aucun polygone', () => expect(polygoneZone(cercle({ rayon_km: -3 }))).toEqual([]))
})

describe('lecture, corps, forme', () => {
  it('lireZones ignore les zones abîmées et borne à 10', () => {
    const ok = { id: 'a', nom: 'A', forme: 'cercle', centre: { lat: 1, lon: 2 }, rayon_km: 5, objets: ['avion', 'x'], actif: true, notifier: false }
    const l = lireZones({ zones: [ok, { id: 3 }, null, ...Array.from({ length: 20 }, (_, i) => ({ ...ok, id: `z${i}` }))] })
    expect(l).toHaveLength(10)
    expect(l[0].objets).toEqual(['avion'])
  })
  it('corpsZone : sans id, seule la forme choisie', () => {
    const c = corpsZone({ ...cercle({ nom: ' Paris ' }), id: 'z1', bbox: { s: 0, w: 0, n: 1, e: 1 } })
    expect(c).not.toHaveProperty('id')
    expect(c).not.toHaveProperty('bbox')
    expect(c.nom).toBe('Paris')
  })
  it('changerForme cercle -> rect -> cercle garde des valeurs valides', () => {
    const r = changerForme(cercle(), 'rect')
    expect(erreursZone(r)).toEqual([])
    expect(erreursZone(changerForme(r, 'cercle'))).toEqual([])
    expect(bboxDeCercle(0, 0, 100).n).toBeGreaterThan(0.8)
  })
  it('deplacerZone : le rectangle garde sa taille', () => {
    const r = changerForme(cercle(), 'rect')
    const d = deplacerZone(r, 10, 20)
    expect(erreursZone(d)).toEqual([])
    expect(d.centre).toEqual({ lat: 10, lon: 20 })
    expect((d.bbox!.n - d.bbox!.s)).toBeCloseTo(r.bbox!.n - r.bbox!.s, 2)
  })
  it('résumé', () => expect(resumeForme(cercle({ rayon_km: 120 }))).toBe('cercle de 120 km'))
})
