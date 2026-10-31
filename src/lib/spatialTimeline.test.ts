import { describe, expect, it } from 'vitest'
import {
  ajouter, blocSousTete, deplacer, deplacerAuMesure, dureeTotale, elargir, mesureDepuisPx, placeAuMesure, positionTete,
  redimensionner, refus, sansScenesInconnues, supprimer, versBlocs, versPas,
} from './spatialTimeline'

const set = [{ scene: 'a', mesures: 4 }, { scene: 'b', mesures: 2 }, { scene: 'c', mesures: 8 }]
const ordre = (p: { scene: string }[]) => p.map((x) => x.scene)

describe('ligne de temps d’un set', () => {
  it('place les blocs bout à bout et revient aux pas', () => {
    const blocs = versBlocs(set)
    expect(blocs.map((b) => b.debut)).toEqual([0, 4, 6])
    expect(versPas(blocs)).toEqual(set)
    expect(dureeTotale(set)).toBe(14)
  })
  it('ne garde que l’ordre quand des blocs se chevauchent', () => {
    const blocs = versBlocs(set)
    blocs[2] = { ...blocs[2], debut: 1 }
    expect(ordre(versPas(blocs))).toEqual(['a', 'c', 'b'])
  })
  it('borne les durées de 1 à 64', () => {
    expect(redimensionner(set, 0, 0)[0].mesures).toBe(1)
    expect(redimensionner(set, 0, 500)[0].mesures).toBe(64)
    expect(elargir(set, 1, -5)[1].mesures).toBe(1)
    expect(elargir(set, 1, 1)[1].mesures).toBe(3)
    expect(redimensionner(set, 9, 3)).toBe(set)
  })
  it('ajoute à la fin ou à une place, et plafonne à 64 scènes', () => {
    expect(ordre(ajouter(set, 'd'))).toEqual(['a', 'b', 'c', 'd'])
    expect(ajouter(set, 'd', 1)[1]).toEqual({ scene: 'd', mesures: 4 })
    const plein = Array.from({ length: 64 }, () => ({ scene: 'a', mesures: 1 }))
    expect(ajouter(plein, 'b')).toBe(plein)
  })
  it('supprime et réordonne sans toucher l’original', () => {
    expect(ordre(supprimer(set, 1))).toEqual(['a', 'c'])
    expect(ordre(deplacer(set, 0, 2))).toEqual(['b', 'c', 'a'])
    expect(ordre(deplacer(set, 2, 0))).toEqual(['c', 'a', 'b'])
    expect(ordre(deplacer(set, 1, 99))).toEqual(['a', 'c', 'b'])
    expect(ordre(set)).toEqual(['a', 'b', 'c'])
  })
  it('trouve la place d’un bloc glissé à une mesure', () => {
    expect(placeAuMesure(set, 0)).toBe(0)
    expect(placeAuMesure(set, 5)).toBe(2)
    expect(placeAuMesure(set, 50)).toBe(3)
    expect(ordre(deplacerAuMesure(set, 0, 12))).toEqual(['b', 'c', 'a'])
    expect(ordre(deplacerAuMesure(set, 2, 0))).toEqual(['c', 'a', 'b'])
    expect(ordre(deplacerAuMesure(set, 1, 4))).toEqual(['a', 'b', 'c'])
  })
  it('convertit les pixels en mesures', () => {
    expect(mesureDepuisPx(95, 24)).toBe(4)
    expect(mesureDepuisPx(-30, 24)).toBe(0)
  })
  it('suit la tête de lecture, en boucle ou non', () => {
    expect(positionTete(set, 4 * 4)).toBe(4)
    expect(positionTete(set, 14 * 4 + 8)).toBe(2)
    expect(positionTete(set, 14 * 4 + 8, false)).toBe(14)
    expect(positionTete([], 10)).toBe(0)
    expect(blocSousTete(set, 4 * 5)?.scene).toBe('b')
    expect(blocSousTete(set, 4 * 13)?.scene).toBe('c')
    expect(blocSousTete(set, 4 * 14, true)?.scene).toBe('a')
    expect(blocSousTete([], 3)).toBeNull()
  })
  it('refuse comme le serveur', () => {
    const connues = new Set(['a', 'b', 'c'])
    expect(refus(set, connues)).toBeNull()
    expect(refus([], connues)).toMatch(/de 1 à 64/)
    expect(refus([{ scene: 'z', mesures: 4 }], connues)).toBe('étape 1 : scène inconnue')
    expect(refus([{ scene: 'a', mesures: 65 }], connues)).toBe('étape 1 : de 1 à 64 mesures')
    expect(refus([{ scene: 'a', mesures: 2.5 }], connues)).toMatch(/mesures/)
    expect(ordre(sansScenesInconnues(set, new Set(['a', 'c'])))).toEqual(['a', 'c'])
  })
})
