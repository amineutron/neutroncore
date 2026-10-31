import { describe, expect, it } from 'vitest'
import { LIMITES_APERCU, presenceCible, suivrePresence } from './spatialPresence'

// Mêmes cas que la classe Presence de test_spatial_bandes.py (huebeat).
describe('fondu de retour de huebeat dans l’aperçu', () => {
  it('cible : silence et absence de temps pris', () => {
    expect(presenceCible(0.5, 0.5, 120)).toBe(1)
    expect(presenceCible(Infinity, 0.5, 120)).toBe(0)
    expect(presenceCible(0.5, Infinity, 120)).toBe(0)
    expect(presenceCible(2, 0.5, 120)).toBeCloseTo(0.4666666666666667, 10)
    expect(presenceCible(0.5, 5, 120)).toBeCloseTo(0, 10)
  })

  it('retombe d’un coup, remonte en une demi-seconde', () => {
    const dt = 1 / 30
    expect(suivrePresence(0, 1, dt)).toBeCloseTo(0.06666666666666667, 10)
    expect(suivrePresence(0.9, 0.2, dt)).toBe(0.2)
    expect(suivrePresence(0.99, 1, dt)).toBe(1)
    let p = 0
    for (let i = 0; i < 15; i++) p = suivrePresence(p, 1, dt)
    expect(p).toBeCloseTo(1, 9)
    expect(suivrePresence(0.5, 0.5, dt)).toBeCloseTo(0.5, 12)
  })

  it('tempo inconnu : mêmes repères que huebeat (2,5 s puis une seconde de fondu)', () => {
    expect(presenceCible(0.5, 2.5, 0)).toBe(1)
    expect(presenceCible(0.5, 3.0, 0)).toBeCloseTo(0.5, 10)
    expect(presenceCible(0.5, 3.6, 0)).toBe(0)
  })

  it('les limites restantes sont listées', () => {
    expect(LIMITES_APERCU.length).toBeGreaterThan(3)
    expect(LIMITES_APERCU.every((t) => t.length > 20 && !/[\u{1F300}-\u{1FAFF}]/u.test(t))).toBe(true)
  })
})
