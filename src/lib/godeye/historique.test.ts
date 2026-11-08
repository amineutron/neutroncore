import { describe, expect, it } from 'vitest'
import { besoinHistorique, completer, HISTORIQUE_VIDE, lireHistorique } from './historique'

const T = 1_700_000_000_000
const sm = (id: string, t: number) => ({ id, mag: 4, lieu: 'x', lat: 1, lon: 2, prof: 3, t })

describe('lireHistorique', () => {
  it('ignore le bruit, accepte secondes, ms et ISO', () => {
    const h = lireHistorique({ seismes: [{ id: 'a', mag: 5, lat: 1, lon: 1, t: 1_700_000_000 }, { id: 'b' }, null, { id: 'c', mag: 3, lat: 0, lon: 0, t: '2026-11-07T10:00:00Z' }], evenements: [{ id: 'e', titre: 'T', lat: 1, lon: 1, t: T }, { titre: 'sans id' }] })
    expect(h.seismes.map((s) => s.id)).toEqual(['a', 'c'])
    expect(h.seismes[0].t).toBe(1_700_000_000_000)
    expect(h.evenements).toHaveLength(1)
    expect(lireHistorique(null)).toEqual(HISTORIQUE_VIDE)
  })
})

describe('completer', () => {
  const d = { seismes: [sm('a', T)], evenements: [], autre: 1 }
  it('ajoute ce qui manque dans la fenêtre, sans doublon, sans muter', () => {
    const h = { seismes: [sm('a', T - 1), sm('vieux', T - 50 * 3_600_000), sm('b', T - 3_600_000)], evenements: [] }
    const r = completer(d, h, T, 24)
    expect(r.seismes.map((s) => s.id)).toEqual(['a', 'b'])
    expect(d.seismes).toHaveLength(1)
    expect(r.autre).toBe(1)
  })
  it('historique vide : même objet', () => {
    expect(completer(d, HISTORIQUE_VIDE, T, 24)).toBe(d)
  })
})

describe('besoinHistorique', () => {
  const base = { seismes: true, evenements: false, erreurSeismes: false, erreurEvenements: false, heuresDemandees: 6, heuresHistorique: 24 }
  it('rien sans couches', () => expect(besoinHistorique({ ...base, seismes: false })).toBe(false))
  it('source en panne', () => expect(besoinHistorique({ ...base, erreurSeismes: true })).toBe(true))
  it('erreur d\'une couche coupée ignorée', () => expect(besoinHistorique({ ...base, erreurEvenements: true })).toBe(false))
  it('durée longue seulement', () => {
    expect(besoinHistorique({ ...base, heuresDemandees: 72, heuresHistorique: 48 })).toBe(true)
    expect(besoinHistorique(base)).toBe(false)
  })
})
