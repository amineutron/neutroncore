import { describe, expect, it } from 'vitest'
import { ETAT_ONDES_VIDE, agesDesOndes, avancerOndes, chauffer, niveauRelatif, ondePic, picBasses, reagir, scintillement, type EtatBandes } from './spatialBandes'
import { evaluer, type Dims, type Fixture, type FxParams } from './spatialFx'

// Mêmes cas que test_spatial_bandes.py (huebeat) : les deux calculs doivent donner les mêmes nombres.
const NUL = { basses: 0, voix: 0, aigus: 0 }
const dims: Dims = { w: 500, h: 600, d: 230 }

describe('réactions au son : niveaux et ondes', () => {
  it('niveau relatif', () => {
    expect(niveauRelatif(3, 1)).toBe(1)
    expect(niveauRelatif(2, 1)).toBe(0.5)
    expect(niveauRelatif(1, 1)).toBe(0)
    expect(niveauRelatif(9, 1)).toBe(1)
    expect(niveauRelatif(0.5, 1)).toBe(0)
    expect(niveauRelatif(5, 0)).toBe(0)
    expect(niveauRelatif(NaN, 1)).toBe(0)
  })

  it('pic de basses : vers le haut, hors période réfractaire', () => {
    expect(picBasses(0.2, 0.7, 1)).toBe(true)
    expect(picBasses(0.7, 0.8, 1)).toBe(false)
    expect(picBasses(0.2, 0.5, 1)).toBe(false)
    expect(picBasses(0.2, 0.9, 0.1)).toBe(false)
  })

  it('ondes déclenchées puis retirées, sans modifier l’ancien état', () => {
    let e = avancerOndes(ETAT_ONDES_VIDE, 0.1, 10)
    expect(e.ondes).toEqual([])
    e = avancerOndes(e, 0.9, 10.1)
    expect(e.ondes).toEqual([10.1])
    let e2 = avancerOndes(e, 0.1, 10.2)
    expect(e.ondes).toEqual([10.1])
    e2 = avancerOndes(e2, 0.9, 10.3)
    expect(e2.ondes).toEqual([10.1])
    let e3 = avancerOndes(e2, 0.1, 10.4)
    e3 = avancerOndes(e3, 0.9, 10.5)
    expect(e3.ondes).toEqual([10.1, 10.5])
    expect(avancerOndes(e3, 0, 11.7).ondes).toEqual([10.5])
    expect(agesDesOndes(e3, 10.6).map((a) => Math.round(a * 10) / 10)).toEqual([0.5, 0.1])
    expect(ETAT_ONDES_VIDE.ondes).toEqual([])
  })
})

describe('réactions au son : rendu', () => {
  it('l’onde part de la source et grandit', () => {
    const o: [number, number, number] = [0, 0, 0]
    expect(ondePic(o, o, 500, 0)).toBeCloseTo(1, 6)
    expect(ondePic([100, 0, 0], o, 500, 0)).toBeCloseTo(0.29096045886431016, 10)
    expect(ondePic([450, 0, 0], o, 500, 1)).toBeCloseTo(0.2857142857142857, 10)
    expect(ondePic(o, o, 500, 1.5)).toBe(0)
    expect(ondePic(o, o, 500, -0.1)).toBe(0)
    expect(ondePic([450, 0, 0], o, 500, 0)).toBeLessThan(0.001)
  })

  it('scintillement reproductible (même suite que Python)', () => {
    const suite: number[] = []
    for (let x = 0; x < 6; x++) for (let y = 0; y < 2; y++) suite.push(scintillement([x * 37, y * 11, 50], 1, 0))
    expect(suite).toEqual([0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1])
    expect(scintillement([1, 2, 3], 0, 5)).toBe(0)
    expect(scintillement([37, 11, 50], 0.4, 0)).toBe(0.4)
    expect(scintillement([-1, -1, -1], 1, 1e6 / 20)).toBeGreaterThanOrEqual(0)
  })

  it('la chaleur garde la luminosité', () => {
    const [r, g, b] = chauffer([0.5, 0.5, 0.5], 1)
    expect([r, g, b].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0.5, 0.3875, 0.3])
    expect(chauffer([0, 0, 0], 1)).toEqual([0, 0, 0])
    expect(chauffer([0.4, 0.2, 0.1], 0)).toEqual([0.4, 0.2, 0.1])
  })

  it('reagir', () => {
    const etat: EtatBandes = { niveaux: { ...NUL, voix: 1 }, ondes: [0.2], t: 1 }
    const [r, g, b] = reagir([0.2, 0.1, 0], [450, 0, 0], [0, 0, 0], 500, etat)
    expect(r).toBeCloseTo(0.2, 5)
    expect(g).toBeCloseTo(0.105, 5)
    expect(b).toBeCloseTo(0.02, 5)
    const o: [number, number, number] = [0, 0, 0]
    expect(reagir([0, 0, 0], o, o, 500, { niveaux: NUL, ondes: [0], t: 0 }).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0.7, 0.7, 0.7])
    expect(reagir([0, 0, 0], o, o, 500, { niveaux: NUL, ondes: [], t: 0 })).toEqual([0, 0, 0])
  })

  it('evaluer : inchangé sans l’option, la voix change la teinte mais pas la luminosité', () => {
    const f: Fixture = { id: 'f', kind: 'lampe', pos: [80, 20, 100] }
    const p: FxParams = { source: [0, 0, 100], axe: 'x', palette: 'neon', intensite: 1 }
    const sans = evaluer(['onde', 'maree'], f, dims, p, 0.3)
    expect(evaluer(['onde', 'maree'], f, dims, { ...p, bandesEtat: undefined }, 0.3)).toEqual(sans)
    const avec = evaluer(['onde', 'maree'], f, dims, { ...p, bandesEtat: { niveaux: { ...NUL, voix: 1 }, ondes: [], t: 0 } }, 0.3)
    expect(avec.rgb).not.toEqual(sans.rgb)
    expect(avec.niveau).toBeCloseTo(sans.niveau, 9)
    // un stroboscope ne réagit pas aux bandes
    const strobe: Fixture = { id: 's', kind: 'strobe', pos: [80, 20, 100] }
    const bandes: EtatBandes = { niveaux: { ...NUL, voix: 1 }, ondes: [0], t: 0 }
    expect(evaluer(['onde'], strobe, dims, { ...p, bandesEtat: bandes }, 0)).toEqual(evaluer(['onde'], strobe, dims, p, 0))
  })
})
