import { describe, expect, it } from 'vitest'
import { positionSoleil } from './globe'
import { altitudeSoleil, estDeNuit, polygoneNuit, poleDeNuit, terminateur } from './nuit'

const ete = { lat: 20, lon: 30 }
const hiver = { lat: -20, lon: -100 }

describe('altitudeSoleil', () => {
  it('90 degrés sous le soleil, négative à l\'opposé', () => {
    expect(altitudeSoleil(20, 30, ete)).toBeCloseTo(90)
    expect(altitudeSoleil(-20, -150, ete)).toBeCloseTo(-90)
  })
  it('estDeNuit suit le signe', () => {
    expect(estDeNuit(0, 30, ete)).toBe(false)
    expect(estDeNuit(0, -150, ete)).toBe(true)
  })
})

describe('terminateur', () => {
  it.each([ete, hiver, { lat: 0, lon: 0 }])('tous ses points sont à altitude nulle (%o)', (s) => {
    for (const [lon, lat] of terminateur(s, 72)) expect(Math.abs(altitudeSoleil(lat, lon, s))).toBeLessThan(0.3)
  })
  it('couvre -180 à 180 avec n + 1 points', () => {
    const t = terminateur(ete, 36)
    expect(t).toHaveLength(37)
    expect(t[0][0]).toBe(-180)
    expect(t[36][0]).toBe(180)
  })
})

describe('polygoneNuit', () => {
  it('le pôle de nuit est bien de nuit', () => {
    for (const s of [ete, hiver]) {
      const pole = poleDeNuit(s)
      expect(estDeNuit(pole, 0, s)).toBe(true)
      expect(polygoneNuit(s).slice(-2).every(([, lat]) => lat === pole)).toBe(true)
    }
  })
  it('marche avec le vrai soleil du moment', () => {
    const s = positionSoleil(new Date('2026-06-21T12:00:00Z'))
    expect(s.lat).toBeGreaterThan(20)
    expect(polygoneNuit(s).length).toBeGreaterThan(10)
  })
})
