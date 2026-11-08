import { describe, expect, it } from 'vitest'
import { ELEMENTS_DEFAUT } from './elements'
import { FILTRES_DEFAUT } from './filtres'
import { AVANCE_DEFAUT, borneHistorique, corpsReglages, lireAvance, lireAvanceStockee, lireReglagesServeur } from './reglagesServeur'

describe('historique', () => {
  it.each([[0, 1], [100, 48], [24.4, 24], ['x', 24], [NaN, 24]])('borne %s -> %s', (v, r) => {
    expect(borneHistorique(v)).toBe(r)
  })
})

describe('lireAvance', () => {
  it('défauts et copie navigateur illisible', () => {
    expect(lireAvance(undefined)).toEqual(AVANCE_DEFAUT)
    expect(lireAvanceStockee('{cassé')).toEqual(AVANCE_DEFAUT)
    expect(lireAvanceStockee(null)).toEqual(AVANCE_DEFAUT)
  })
  it('relit durée et rotation', () => {
    const a = lireAvance({ historique_heures: 36, rotation: { actif: true, secondes: 40, etapes: [{ type: 'monde' }] } })
    expect(a.historique_heures).toBe(36)
    expect(a.rotation).toMatchObject({ actif: true, secondes: 40 })
  })
})

describe('lireReglagesServeur', () => {
  it('réponse inutilisable : null', () => {
    expect(lireReglagesServeur(null)).toBeNull()
    expect(lireReglagesServeur('x')).toBeNull()
  })
  it('serveur vide : tout à null (on garde le local)', () => {
    expect(lireReglagesServeur({ elements: {}, filtres: {} })).toEqual({ elements: null, filtres: null, avance: null })
  })
  it('serveur rempli : éléments décochés conservés, le reste affiché', () => {
    const r = lireReglagesServeur({ elements: { halos: false }, filtres: { texte: 'abc' }, historique_heures: 48, rotation: { actif: true } })
    expect(r?.elements?.halos).toBe(false)
    expect(r?.elements?.pictos).toBe(true)
    expect(r?.filtres).not.toBeNull()
    expect(r?.avance?.historique_heures).toBe(48)
    expect(r?.avance?.rotation.actif).toBe(true)
  })
  it('corps du PUT', () => {
    const c = corpsReglages(ELEMENTS_DEFAUT, FILTRES_DEFAUT, AVANCE_DEFAUT)
    expect(Object.keys(c).sort()).toEqual(['elements', 'filtres', 'historique_heures', 'rotation'])
  })
})
