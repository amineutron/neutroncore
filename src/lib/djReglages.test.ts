import { describe, expect, it } from 'vitest'
import { BORNES, REGLAGES_DEFAUT, avanceMs, lireReglages, vitesseOnde } from './djReglages'

describe('réglages d analyse et de latence', () => {
  it('reprend les valeurs de départ pour ce qui manque ou déraille', () => {
    expect(lireReglages(undefined)).toEqual(REGLAGES_DEFAUT)
    expect(lireReglages(null)).toEqual(REGLAGES_DEFAUT)
    expect(lireReglages('n importe quoi')).toEqual(REGLAGES_DEFAUT)
    expect(lireReglages({ cycle: { fenetreS: 'long', mesure: 7, actif: 'oui' }, onde: { vitesse: NaN }, avance: { ms: Infinity } })).toEqual(REGLAGES_DEFAUT)
  })
  it('borne chaque valeur', () => {
    const r = lireReglages({ cycle: { fenetreS: 1000, seuil: -3, bpmMin: 1, bpmMax: 9999 }, onde: { vitesse: 99 }, avance: { ms: 5000 } })
    expect(r.cycle.fenetreS).toBe(BORNES.fenetreS[1])
    expect(r.cycle.seuil).toBe(BORNES.seuil[0])
    expect(r.cycle.bpmMin).toBe(BORNES.bpm[0])
    expect(r.cycle.bpmMax).toBe(BORNES.bpm[1])
    expect(r.onde.vitesse).toBe(BORNES.onde[1])
    expect(r.avance.ms).toBe(BORNES.avance[1])
  })
  it('garde un tempo maxi au moins 20 plus haut que le mini, et le préféré entre les deux', () => {
    const r = lireReglages({ cycle: { bpmMin: 150, bpmMax: 100, centreBpm: 60 } })
    expect(r.cycle.bpmMax).toBeGreaterThanOrEqual(r.cycle.bpmMin + 20)
    expect(r.cycle.centreBpm).toBeGreaterThanOrEqual(r.cycle.bpmMin)
    expect(r.cycle.centreBpm).toBeLessThanOrEqual(r.cycle.bpmMax)
  })
  it('garde les choix valides', () => {
    const r = lireReglages({ cycle: { actif: false, mesure: 3 }, onde: { actif: false, vitesse: 2.5 }, avance: { actif: false, ms: 120 } })
    expect(r.cycle.actif).toBe(false)
    expect(r.cycle.mesure).toBe(3)
    expect(r.onde).toEqual({ actif: false, vitesse: 2.5 })
    expect(r.avance).toEqual({ actif: false, ms: 120 })
  })
  it('un bloc éteint se comporte comme avant : onde d origine, aucune avance', () => {
    const r = lireReglages({ onde: { actif: false, vitesse: 6 }, avance: { actif: false, ms: 200 } })
    expect(vitesseOnde(r)).toBe(1)
    expect(avanceMs(r)).toBe(0)
    expect(vitesseOnde(REGLAGES_DEFAUT)).toBe(REGLAGES_DEFAUT.onde.vitesse)
    expect(avanceMs(REGLAGES_DEFAUT)).toBe(REGLAGES_DEFAUT.avance.ms)
  })
  it('passe l aller-retour par du JSON', () => {
    expect(lireReglages(JSON.parse(JSON.stringify(REGLAGES_DEFAUT)))).toEqual(REGLAGES_DEFAUT)
  })
})
