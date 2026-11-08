import { describe, expect, it } from 'vitest'
import { lireResume, phrases } from './resume'

describe('resume', () => {
  it('réponse inutilisable : null', () => {
    expect(lireResume(null)).toBeNull()
    expect(lireResume(3)).toBeNull()
  })
  it('vide : une phrase neutre', () => {
    expect(phrases(lireResume({})!)).toEqual(['rien de notable depuis la dernière fois'])
  })
  it('phrases complètes, accord du pluriel, tri par type', () => {
    const r = lireResume({
      depuis: '2026-11-06T08:00:00Z', seismes: { total: 12, max: { mag: 5.43, lieu: 'Japon' } },
      evenements: { total: 1, par_type: { incendie: 1, volcan: 0 } }, suivis: [{ nom: 'ISS', distance_km: 340.4 }, { nom: 'X', distance_km: 0 }], zones: [{ nom: 'Baltique', entrees: 2 }, { nom: 'Vide', entrees: 0 }],
    })!
    const p = phrases(r)
    expect(p[0]).toBe('12 séismes en 24 h ; le plus fort : magnitude 5.4, Japon')
    expect(p[1]).toBe('1 événement en 24 h (1 incendie)')
    expect(p[2]).toContain('340 km')
    expect(p[3]).toContain('moins de 1 km')
    expect(p[4]).toBe('zone Baltique : 2 entrées')
    expect(p).toHaveLength(5)
  })
})
