import { describe, expect, it } from 'vitest'
import { aAvancer, cadreEtape, etapesJouables, indexSuivant, lireRotation, lireZones, MAX_ETAPES, PAUSE_GESTE_MS, ROTATION_DEFAUT, zoomPourRayon } from './rotation'

const zone = (o: object = {}) => ({ id: 'z1', nom: 'Baltique', centre: { lat: 58, lon: 20 }, rayon_km: 600, actif: true, ...o })

describe('lireRotation', () => {
  it('défaut pour tout ce qui est invalide', () => {
    expect(lireRotation(null)).toEqual(ROTATION_DEFAUT)
    expect(lireRotation({ etapes: 'x', secondes: 'y' })).toEqual(ROTATION_DEFAUT)
  })
  it('borne les secondes et filtre les étapes', () => {
    const r = lireRotation({ actif: true, secondes: 1, etapes: [{ type: 'zone', zone_id: 'a b' }, { type: 'zone', zone_id: 'ok' }, { type: 'monde' }, { type: 'autre' }] })
    expect(r.actif).toBe(true)
    expect(r.secondes).toBe(5)
    expect(r.etapes).toEqual([{ type: 'zone', zone_id: 'ok' }, { type: 'monde' }])
    expect(lireRotation({ secondes: 9999 }).secondes).toBe(300)
  })
  it('plafonne le nombre d\'étapes', () => {
    expect(lireRotation({ etapes: Array.from({ length: 40 }, () => ({ type: 'monde' })) }).etapes).toHaveLength(MAX_ETAPES)
  })
})

describe('lireZones', () => {
  it('accepte liste nue ou enveloppe, cercle ou rectangle', () => {
    expect(lireZones([zone()])).toHaveLength(1)
    expect(lireZones({ zones: [zone()] })[0]).toMatchObject({ id: 'z1', rayonKm: 600 })
    const r = lireZones([{ id: 'r', nom: 'R', bbox: { s: 40, w: 0, n: 50, e: 10 } }])[0]
    expect(r.centre).toEqual({ lat: 45, lon: 5 })
    expect(r.rayonKm).toBeGreaterThan(300)
  })
  it('ignore les zones invalides', () => {
    expect(lireZones([{ id: 'x' }, zone({ centre: { lat: 120, lon: 0 } }), 5, null])).toEqual([])
    expect(lireZones('rien')).toEqual([])
  })
})

describe('cadrage et avancement', () => {
  const zones = lireZones([zone(), zone({ id: 'z2', actif: false })])
  it('zoom borné', () => {
    expect(zoomPourRayon(10)).toBe(12)
    expect(zoomPourRayon(20_000)).toBe(1.5)
  })
  it('monde : cadre de départ ; zone coupée ou inconnue : rien', () => {
    expect(cadreEtape({ type: 'monde' }, zones)).toMatchObject({ zoom: 1 })
    expect(cadreEtape({ type: 'zone', zone_id: 'z1' }, zones)).toMatchObject({ cx: 20, cy: 58 })
    expect(cadreEtape({ type: 'zone', zone_id: 'z2' }, zones)).toBeNull()
    expect(cadreEtape({ type: 'zone', zone_id: 'nope' }, zones)).toBeNull()
  })
  it('etapesJouables saute les zones mortes', () => {
    expect(etapesJouables([{ type: 'monde' }, { type: 'zone', zone_id: 'z2' }, { type: 'zone', zone_id: 'z1' }], zones)).toHaveLength(2)
  })
  it('indexSuivant circulaire', () => {
    expect(indexSuivant(-1, 3)).toBe(0)
    expect(indexSuivant(2, 3)).toBe(0)
    expect(indexSuivant(0, 0)).toBe(-1)
  })
  it('pause après un geste, puis délai de l\'étape', () => {
    const base = { secondes: 20, derniereEtape: 0, dernierGeste: 0 }
    expect(aAvancer({ ...base, maintenant: 19_000 })).toBe(false)
    expect(aAvancer({ ...base, maintenant: 20_000 })).toBe(false) // le geste initial a 0 : pause de 30 s
    expect(aAvancer({ ...base, maintenant: PAUSE_GESTE_MS })).toBe(true)
    expect(aAvancer({ ...base, dernierGeste: 100_000, maintenant: 110_000 })).toBe(false)
    expect(aAvancer({ ...base, dernierGeste: 100_000, derniereEtape: 100_000, maintenant: 130_000 })).toBe(true)
  })
})
