import { describe, expect, it } from 'vitest'
import { lireZones } from './rotation'
import { cadreTele, globePourMode, lireTele, TELE_DEFAUT, vitesseDegres } from './tele'

describe('tele', () => {
  it('lecture tolérante', () => {
    expect(lireTele(null)).toEqual(TELE_DEFAUT)
    expect(lireTele('{x')).toEqual(TELE_DEFAUT)
    expect(lireTele(JSON.stringify({ mode: 'zone', zone_id: 'a b', vitesse: 99, resume: true }))).toEqual({ mode: 'zone', zone_id: '', vitesse: 4, resume: true })
    expect(lireTele(JSON.stringify({ mode: 'bidon' })).mode).toBe('rotation')
  })
  it('vitesse en degrés par seconde', () => {
    expect(vitesseDegres(1)).toBe(5)
    expect(vitesseDegres(0.5)).toBe(2.5)
  })
  it('cadrage : zone connue, zone absente, autres modes', () => {
    const zones = lireZones([{ id: 'z', nom: 'Z', centre: { lat: 10, lon: 20 }, rayon_km: 500 }])
    expect(cadreTele({ ...TELE_DEFAUT, mode: 'zone', zone_id: 'z' }, zones)).toMatchObject({ vue: { cx: 20, cy: 10 }, zoneAbsente: false })
    expect(cadreTele({ ...TELE_DEFAUT, mode: 'zone', zone_id: 'nope' }, zones)).toMatchObject({ zoneAbsente: true })
    expect(cadreTele({ ...TELE_DEFAUT, mode: 'plan' }, zones).zoneAbsente).toBe(false)
  })
  it('globe seulement en rotation', () => {
    expect(globePourMode('rotation')).toBe(true)
    expect(globePourMode('plan')).toBe(false)
    expect(globePourMode('zone')).toBe(false)
  })
})
