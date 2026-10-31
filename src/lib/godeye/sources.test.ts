import { describe, expect, it } from 'vitest'
import { creerOrbites, positionA, positions, trace } from './orbites'
import { lireAvionsApi, lireEonet, lireFaillesApi, lireInfosApi, lireMarchesApi, lireNaviresApi, lireTle, URL_EONET } from './sources'

const TLE_ISS = `ISS (ZARYA)
1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537
`
const EPOQUE = new Date('2008-09-20T12:25:40Z')

describe('lireEonet', () => {
  const evt = (o: Record<string, unknown> = {}) => ({
    id: 'EONET_1', title: 'Incendie X', link: 'https://eonet.gsfc.nasa.gov/x', categories: [{ id: 'wildfires' }],
    geometry: [{ date: '2026-10-01T00:00:00Z', type: 'Point', coordinates: [-120.5, 38.2] }, { date: '2026-10-05T00:00:00Z', type: 'Point', coordinates: [-120.4, 38.3] }], ...o,
  })
  it('prend la position la plus récente', () => {
    const [e] = lireEonet({ events: [evt()] })
    expect(e).toMatchObject({ id: 'EONET_1', categorie: 'wildfires', lon: -120.4, lat: 38.3 })
    expect(e.t).toBe(Date.parse('2026-10-05T00:00:00Z'))
  })
  it('lit un polygone par son premier sommet', () => {
    const [e] = lireEonet({ events: [evt({ geometry: [{ date: '2026-10-05T00:00:00Z', type: 'Polygon', coordinates: [[[10, 20], [11, 21]]] }] })] })
    expect([e.lon, e.lat]).toEqual([10, 20])
  })
  it('écarte lien non https, positions fausses et réponses illisibles', () => {
    expect(lireEonet({ events: [evt({ link: 'javascript:alert(1)' })] })[0].lien).toBe('')
    expect(lireEonet({ events: [evt({ geometry: [{ date: '2026-10-05T00:00:00Z', type: 'Point', coordinates: [500, 0] }] })] })).toEqual([])
    for (const brut of [null, {}, { events: 3 }, { events: [null, 4, {}] }]) expect(lireEonet(brut)).toEqual([])
  })
  it('borne la durée demandée', () => {
    expect(URL_EONET(9999)).toContain('days=90')
    expect(URL_EONET(0)).toContain('days=1')
  })
})

describe('lectures de l\'API', () => {
  it('avions : refuse les lignes incomplètes', () => {
    const bon = { id: 'a', lat: 1, lon: 2, alt: 3, vitesse: 4, cap: 5, militaire: true }
    expect(lireAvionsApi({ avions: [bon, { id: 'b' }, null] })).toHaveLength(1)
    expect(lireAvionsApi({ avions: [bon] })[0].militaire).toBe(true)
    expect(lireAvionsApi('x')).toEqual([])
  })
  it('navires : statut et heure facultatifs', () => {
    const [n] = lireNaviresApi({ navires: [{ id: '1', lat: 1, lon: 2, vitesse: 3, cap: 4 }] })
    expect(n.statut).toBeNull()
    expect(lireNaviresApi({ navires: [{ id: 1 }] })).toEqual([])
  })
})

describe('orbites', () => {
  it('lireTle lit les trois lignes, écarte les jeux incomplets et borne le nombre', () => {
    expect(lireTle(TLE_ISS)).toEqual([{ nom: 'ISS (ZARYA)', l1: expect.stringMatching(/^1 25544U/), l2: expect.stringMatching(/^2 25544/) }])
    expect(lireTle(`${TLE_ISS}${TLE_ISS}${TLE_ISS}`, 2)).toHaveLength(2)
    expect(lireTle('ISS\n1 court\n2 court\n')).toEqual([])
    expect(lireTle(null)).toEqual([])
    expect(lireTle('0 ISS (ZARYA)\r\n' + TLE_ISS.split('\n').slice(1).join('\r\n'))[0].nom).toBe('ISS (ZARYA)')
  })
  it("l'ISS est vers 350 km, entre ses latitudes extrêmes, à environ 7,7 km/s", () => {
    const [o] = creerOrbites(lireTle(TLE_ISS), 'stations')
    const p = positionA(o, EPOQUE)!
    expect(p.altKm).toBeGreaterThan(330)
    expect(p.altKm).toBeLessThan(450)
    expect(Math.abs(p.lat)).toBeLessThanOrEqual(51.7)
    expect(p.vitesseKms).toBeGreaterThan(7.5)
    expect(p.vitesseKms).toBeLessThan(7.9)
    expect(positions([o], EPOQUE)).toHaveLength(1)
  })
  it('un jeu aux éléments absurdes est ignoré sans exception', () => {
    const l2 = '2 25544  51.6416 247.4627 9999999 130.5360 325.0288 15.72125391563537'
    expect(() => creerOrbites([{ nom: 'x', l1: lireTle(TLE_ISS)[0].l1, l2 }], 'stations')).not.toThrow()
    expect(() => creerOrbites([{ nom: 'y', l1: 'zzz', l2: 'zzz' }], 'stations')).not.toThrow()
  })
  it("la trace d'une orbite fait presque un tour en 100 min et est coupée à l'antiméridien", () => {
    const [o] = creerOrbites(lireTle(TLE_ISS), 'stations')
    const morceaux = trace(o, EPOQUE, 100)
    expect(morceaux.length).toBeGreaterThan(1)
    for (const m of morceaux) for (let i = 1; i < m.length; i++) expect(Math.abs(m[i][0] - m[i - 1][0])).toBeLessThan(180)
    expect(morceaux.flat().length).toBeGreaterThan(95)
  })
})

describe('lectures des actualités, marchés et failles', () => {
  const art = { id: 'a', titre: 'T', resume: 'r', lien: 'https://x/a', source: 'bbc', source_nom: 'BBC', t: 5, theme: 'guerre', niveau: 'crit', pays: 'Ukraine', lat: 49, lon: 32 }
  it('actualités : ignore thèmes inconnus, liens non https et lignes cassées', () => {
    const r = lireInfosApi({ infos: [art, { ...art, id: 'b', theme: 'bidon' }, { ...art, id: 'c', lien: 'javascript:alert(1)' }, { ...art, id: 'd', lat: null, lon: null, pays: null }, null], flux: [{ id: 'bbc', nom: 'BBC', ok: true, n: 3 }, { id: 3 }] })
    expect(r.infos.map((a) => a.id)).toEqual(['a', 'd'])
    expect(r.infos[0]).toMatchObject({ sourceNom: 'BBC', lat: 49, lon: 32 })
    expect(r.infos[1].lat).toBeNull()
    expect(r.sources).toEqual([{ id: 'bbc', nom: 'BBC', ok: true, n: 3 }])
    expect(lireInfosApi(null)).toEqual({ infos: [], sources: [] })
  })
  it('marchés et failles', () => {
    expect(lireMarchesApi({ marches: [{ symbole: 'GC=F', nom: 'Or', prix: 1, variation_pct: 2, devise: 'USD' }, { symbole: 'x' }] })).toHaveLength(1)
    const f = lireFaillesApi({ total: 3, recentes: [{ cve: 'CVE-1', nom: 'n', lien: 'https://nvd.nist.gov/x', rancongiciel: true }, { cve: 'CVE-2', nom: 'n', lien: 'http://x' }] })
    expect(f.total).toBe(3)
    expect(f.recentes.map((v) => v.cve)).toEqual(['CVE-1'])
    expect(lireFaillesApi('x')).toEqual({ total: 0, recentes: [] })
  })
})
