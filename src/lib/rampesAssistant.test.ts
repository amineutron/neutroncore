import { describe, expect, it } from 'vitest'
import { BRI_MAX, evaluer, type Rampe } from './rampes'
import {
  MODELES_SIMPLES, couleursEnMots, courbesPourReveil, depuisModeleSimple, maxPourcent, motCouleur, peutServirAuReveil,
  phraseRampe, problemeRampe, reglerCouleurs, reglerDuree, reglerMax, tendance,
} from './rampesAssistant'

const rampe = (id: string, lampes = ['1']): Rampe => ({ id, ...depuisModeleSimple(id, lampes)! })

describe('modèles nommés', () => {
  it('quatre modèles, noms parlants', () => expect(MODELES_SIMPLES.map((m) => m.nom)).toEqual(['lever de soleil', 'coucher de soleil', 'lecture', 'nuit douce']))
  it.each(MODELES_SIMPLES.map((m) => m.id))('%s : durée, courbes et lampes cohérentes', (id) => {
    const r = rampe(id)
    expect(r.pistes[0].bri.length).toBeGreaterThan(1)
    expect(r.pistes[0].bri.at(-1)!.t).toBeCloseTo(r.duree_s)
    expect(evaluer(r, 0)['1'].bri).toBeGreaterThanOrEqual(1)
  })
  it('le lever monte, le coucher baisse, la lecture monte puis se stabilise', () => {
    expect(tendance(rampe('lever'))).toBe('monte')
    expect(tendance(rampe('coucher'))).toBe('baisse')
    expect(tendance(rampe('lecture'))).toBe('monte')
    expect(tendance(rampe('nuit'))).toBe('baisse')
  })
  it('modèle inconnu : null', () => expect(depuisModeleSimple('zzz')).toBeNull())
})

describe('réglages simples', () => {
  it('durée : même forme, autre durée', () => {
    const r = reglerDuree(rampe('lever'), 10)
    expect(r.duree_s).toBe(600)
    expect(r.pistes[0].bri.at(-1)!.t).toBe(600)
    expect(r.pistes[0].kelvin.at(-1)!.t).toBe(600)
  })
  it('luminosité maximale en %, sans toucher l’original', () => {
    const r = rampe('lever')
    expect(maxPourcent(r)).toBe(100)
    const r2 = reglerMax(r, 50)
    expect(maxPourcent(r2)).toBe(50)
    expect(maxPourcent(r)).toBe(100)
    expect(r2.pistes[0].bri.every((p) => p.v <= BRI_MAX / 2 + 1)).toBe(true)
  })
  it('couleurs en mots', () => {
    expect(motCouleur(2200)).toBe('bougie'); expect(motCouleur(2700)).toBe('chaude')
    expect(motCouleur(4000)).toBe('neutre'); expect(motCouleur(5500)).toBe('du jour')
    expect(couleursEnMots(reglerCouleurs(rampe('lever'), 2700, 5500))).toEqual({ debut: 'chaude', fin: 'du jour' })
    expect(couleursEnMots({ ...rampe('lever'), pistes: [{ ...rampe('lever').pistes[0], kelvin: [] }] })).toBeNull()
  })
})

describe('phrase', () => {
  it('lever de soleil', () => {
    expect(phraseRampe(rampe('lever'), { '1': 'salon' }))
      .toBe('Pendant 20 min, la lumière monte de 1 % à 100 % sur salon, de la lumière bougie à la lumière du jour.')
  })
  it('lampe sans nom connu, boucle', () => {
    const r = { ...rampe('lecture', ['7']), boucle: true }
    expect(phraseRampe(r)).toContain('sur lampe 7')
    expect(phraseRampe(r)).toContain('en boucle')
  })
  it('courbe vide : message clair', () => expect(phraseRampe({ ...rampe('lever'), pistes: [{ lampes: ['1'], bri: [], kelvin: [] }] })).toContain('pas encore de courbe'))
})

describe('validation', () => {
  it('dit quoi corriger', () => {
    expect(problemeRampe({ ...rampe('lever'), nom: '' })).toContain('nom')
    expect(problemeRampe(rampe('lever', []))).toBe('choisis au moins une lampe')
    expect(problemeRampe(rampe('lever'))).toBe('')
  })
})

describe('lien avec le réveil', () => {
  it('seules les montées servent à un réveil', () => {
    expect(peutServirAuReveil(rampe('lever'))).toBe(true)
    expect(peutServirAuReveil(rampe('coucher'))).toBe(false)
  })
  it('les courbes suivent la durée du réveil', () => {
    const c = courbesPourReveil(rampe('lever'), 30)
    expect(c.bri.at(-1)!.t).toBe(1800)
    expect(c.kelvin.at(-1)!.t).toBe(1800)
  })
})
