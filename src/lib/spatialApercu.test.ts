import { describe, expect, it } from 'vitest'
import { BORNES, LEGENDES, PERIODE, balayage, communDeDemo, lampeDeDemo, seuilDeDemo, TEMPS_PAR_S, type CleCommun } from './spatialApercu'
import { COMMUN_DEFAUT } from './spatialFx'

describe('aperçu d’un réglage', () => {
  it('balaie du minimum au maximum, avec une pause aux deux bouts', () => {
    expect(balayage(0)).toBe(0)
    expect(balayage(PERIODE * 0.1)).toBe(0)
    expect(balayage(PERIODE * 0.47)).toBeCloseTo(0.5)
    expect(balayage(PERIODE * 0.9)).toBe(1)
    expect(balayage(PERIODE * 1.47)).toBeCloseTo(0.5)
    expect(balayage(-1)).toBeGreaterThanOrEqual(0)
  })
  it('couvre chaque réglage commun, légende et bornes', () => {
    for (const cle of Object.keys(COMMUN_DEFAUT) as CleCommun[]) {
      expect(BORNES[cle][0]).toBeLessThan(BORNES[cle][1])
      expect(LEGENDES[cle].quoi.length).toBeGreaterThan(10)
      expect(communDeDemo(cle, 42)[cle]).toBe(42)
    }
  })
  it('la lampe témoin montre l’effet du réglage', () => {
    const creux = 0.9 / TEMPS_PAR_S                           // tard dans un temps
    expect(lampeDeDemo('profondeur', 0, creux)).toBeCloseTo(1)      // aucune pulsation : lumière continue
    expect(lampeDeDemo('profondeur', 100, creux)).toBeLessThan(0.1)
    expect(lampeDeDemo('plancher', 60, creux)).toBeGreaterThan(0.55)
    expect(lampeDeDemo('retombee', 100, 0.5 / TEMPS_PAR_S)).toBeGreaterThan(lampeDeDemo('retombee', 0, 0.5 / TEMPS_PAR_S))
    expect(lampeDeDemo('vie', 100, 3 / TEMPS_PAR_S)).toBeGreaterThan(0.3)            // deux mesures : encore allumée au 4e temps
    expect(lampeDeDemo('vie', 0, 3.9 / TEMPS_PAR_S)).toBeLessThan(0.05)              // un temps : déjà éteinte
    expect(lampeDeDemo('attaque', 0, 0.01)).toBeGreaterThan(lampeDeDemo('attaque', 100, 0.01))
    expect(lampeDeDemo('intensite', 10, 0)).toBeCloseTo(0.1)
  })
  it('sensibilité : plus elle monte, plus de sons comptent', () => {
    expect(seuilDeDemo(0)).toBeGreaterThan(seuilDeDemo(100))
    const petitSon = 1.01 / TEMPS_PAR_S                       // deuxième son, faible
    expect(lampeDeDemo('sensibilite', 0, petitSon)).toBe(0)
    expect(lampeDeDemo('sensibilite', 100, petitSon)).toBeGreaterThan(0.8)
    expect(lampeDeDemo('sensibilite', 0, 0.01)).toBeGreaterThan(0.8)   // le gros coup passe toujours
  })
})

describe('ce que huebeat entend', () => {
  it('met sons et seuil sur la même échelle et compte les temps pris', async () => {
    const { echelleEcoute } = await import('./spatialApercu')
    const e = echelleEcoute({ niveaux: [0.1, 0.5, 0.32, 0], seuils: [0.3, 0.3, 0.3, 0], pris: [0, 1, 0, 0] })
    expect(e.barres.map((b) => b.passe)).toEqual([false, true, true, false])     // le 3e passe le seuil mais n'est pas pris (trop près du 2e)
    expect(e.barres.map((b) => b.pris)).toEqual([false, true, false, false])
    expect(e.temps).toBe(1)
    expect(e.barres[1].h).toBeCloseTo(1 / 1.08)
    expect(e.seuil[0]).toBeCloseTo(0.3 / 0.5 / 1.08)
    expect(echelleEcoute({ niveaux: [], seuils: [], pris: [] })).toEqual({ barres: [], seuil: [], temps: 0 })
    expect(echelleEcoute({ niveaux: [1, 2], seuils: [1], pris: [0, 0] }).barres).toHaveLength(1)
  })
})
