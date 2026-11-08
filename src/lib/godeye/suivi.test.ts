import { describe, expect, it } from 'vitest'
import { avecSuivi, depuisTexte, distanceParcourueKm, idSuivi, lireSuivis, MAX_SUIVIS, objetIdDeSuivi, peutMarquer, sansSuivi, suiviDe, typeSuivi, type Suivi } from './suivi'

const avion = { id: 'avi:3944ee', couche: 'avions' as const, titre: 'AFR1234' }
const brut = { suivis: [
  { id: '3944ee', type: 'avion', nom: 'AFR1234', depuis: '2026-11-07T10:00:00Z', points: [{ t: '2026-11-07T10:01:00Z', lat: 47, lon: 4, alt: 3000 }, { t: 'x', lat: 1, lon: 1 }] },
  { id: 'a', type: 'bateau', nom: 'x', depuis: '2026-11-07T10:00:00Z' },
  { id: 'b', type: 'navire', nom: 'y', depuis: 'pas une date' },
] }

describe('suivis', () => {
  it('relit la réponse en écartant le mal formé', () => {
    const l = lireSuivis(brut)
    expect(l).toHaveLength(1)
    expect(l[0].points).toEqual([{ t: Date.parse('2026-11-07T10:01:00Z'), lat: 47, lon: 4, alt: 3000 }])
    expect(lireSuivis(null)).toEqual([])
  })
  it('identifiants et types', () => {
    expect(typeSuivi({ couche: 'seismes' })).toBeNull()
    expect(idSuivi(avion)).toBe('3944ee')
    expect(objetIdDeSuivi({ id: '25544', type: 'satellite' })).toBe('sat:25544')
  })
  it('marquer : corps, doublon, limite, type refusé', () => {
    const l = lireSuivis(brut)
    expect(peutMarquer([], avion)).toEqual({ ok: true, corps: { id: '3944ee', type: 'avion', nom: 'AFR1234' } })
    expect(suiviDe(l, avion)?.nom).toBe('AFR1234')
    expect(peutMarquer(l, avion)).toEqual({ ok: false, raison: 'déjà marqué' })
    expect(peutMarquer([], { id: 'sei:1', couche: 'seismes', titre: 'M 5' }).ok).toBe(false)
    const plein: Suivi[] = Array.from({ length: MAX_SUIVIS }, (_, i) => ({ id: String(i), type: 'navire', nom: 'n', depuis: 0, points: [] }))
    expect(peutMarquer(plein, avion).ok).toBe(false)
  })
  it('ajout et retrait sans modifier la liste d\'origine', () => {
    const l = lireSuivis(brut)
    expect(sansSuivi(l, l[0])).toEqual([])
    expect(l).toHaveLength(1)
    expect(avecSuivi(l, { ...l[0], nom: 'autre' })).toHaveLength(1)
  })
  it('durées et distance', () => {
    const m = 1_000_000_000_000
    expect(depuisTexte(m, m + 20_000)).toBe('à l\'instant')
    expect(depuisTexte(m, m + 12 * 60_000)).toBe('depuis 12 min')
    expect(depuisTexte(m, m + 3 * 3_600_000)).toBe('depuis 3 h')
    expect(depuisTexte(m, m + 72 * 3_600_000)).toBe('depuis 3 j')
    expect(distanceParcourueKm([{ lon: 0, lat: 0 }, { lon: 0, lat: 1 }])).toBeCloseTo(111.2, 0)
    expect(distanceParcourueKm([{ lon: 0, lat: 0 }])).toBe(0)
  })
})
