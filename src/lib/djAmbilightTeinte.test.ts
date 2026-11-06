import { describe, expect, it } from 'vitest'
import { REGLAGES_AMBILIGHT } from './djAmbilight'
import { lireReglagesAmbilight } from './djAmbilightSaves'
import { choisirTeinte, teinteDesLampes, teinteEnSuccession } from './djAmbilightTeinte'

describe('teinteDesLampes : la couleur que montrent les lampes, sans leur luminosité', () => {
  it('prend la lampe la plus lumineuse et la remet à pleine luminosité', () => {
    const t = teinteDesLampes([{ id: 1, rgb: [0.1, 0.0, 0.0] }, { id: 2, rgb: [0.0, 0.4, 0.2] }])
    expect(t).toBe('#00ff80')
  })
  it('rend null quand toutes les lampes sont éteintes ou qu’il n’y en a pas', () => {
    expect(teinteDesLampes([])).toBeNull()
    expect(teinteDesLampes([{ id: 1, rgb: [0, 0, 0] }])).toBeNull()
    expect(teinteDesLampes([{ id: 1, rgb: [0.01, 0.01, 0.01] }])).toBeNull()
  })
  it('borne les valeurs absurdes', () => {
    expect(teinteDesLampes([{ id: 1, rgb: [5, 0, Number.NaN] }])).toBe('#ff0000')
  })
})

describe('teinteEnSuccession : les couleurs se succèdent à chaque mesure (4 temps)', () => {
  const liste = ['#ff0000', '#00ff00', '#ffff00']
  it('une mesure par couleur, en boucle', () => {
    expect(teinteEnSuccession(liste, 0)).toBe('#ff0000')
    expect(teinteEnSuccession(liste, 3.9)).toBe('#ff0000')
    expect(teinteEnSuccession(liste, 4)).toBe('#00ff00')
    expect(teinteEnSuccession(liste, 8)).toBe('#ffff00')
    expect(teinteEnSuccession(liste, 12)).toBe('#ff0000')
  })
  it('liste vide : null ; temps négatif ou absurde : première couleur', () => {
    expect(teinteEnSuccession([], 5)).toBeNull()
    expect(teinteEnSuccession(liste, -7)).toBe('#ff0000')
    expect(teinteEnSuccession(liste, Number.NaN)).toBe('#ff0000')
  })
})

describe('choisirTeinte : à la main, sinon les lampes, sinon la scène, sinon la couleur de repli', () => {
  const base = { ...REGLAGES_AMBILIGHT, couleur: '#123456' }
  const lampes = [{ id: 1, rgb: [0, 0.5, 0] as [number, number, number] }]
  it('les couleurs choisies à la main passent avant tout', () => {
    expect(choisirTeinte({ reglages: { ...base, couleurs: ['#ff0000'] }, lampes, scene: ['#0000ff'], beat: 0 })).toBe('#ff0000')
  })
  it('sans choix manuel, suit les lampes quand elles répondent', () => {
    expect(choisirTeinte({ reglages: { ...base, couleurs: [] }, lampes, scene: ['#0000ff'], beat: 0 })).toBe('#00ff00')
  })
  it('lampes absentes ou éteintes : les couleurs de la scène, l’une après l’autre', () => {
    const a = { reglages: { ...base, couleurs: [] }, lampes: null, scene: ['#0000ff', '#ff00ff'] }
    expect(choisirTeinte({ ...a, beat: 0 })).toBe('#0000ff')
    expect(choisirTeinte({ ...a, beat: 4 })).toBe('#ff00ff')
    expect(choisirTeinte({ ...a, lampes: [{ id: 1, rgb: [0, 0, 0] }], beat: 4 })).toBe('#ff00ff')
  })
  it('rien du tout : la couleur de repli', () => {
    expect(choisirTeinte({ reglages: { ...base, couleurs: [] }, lampes: null, scene: [], beat: 0 })).toBe('#123456')
  })
})

describe('les réglages gardent les couleurs choisies', () => {
  it('par défaut : aucune, donc on suit les lampes', () => {
    expect(REGLAGES_AMBILIGHT.couleurs).toEqual([])
    expect(lireReglagesAmbilight({}).couleurs).toEqual([])
  })
  it('relit une liste valide, nettoie le reste', () => {
    expect(lireReglagesAmbilight({ couleurs: ['#FF0000', 'oups', 42, '0f0'] }).couleurs).toEqual(['#ff0000', '#00ff00'])
    expect(lireReglagesAmbilight({ couleurs: 'rouge' }).couleurs).toEqual([])
  })
})
