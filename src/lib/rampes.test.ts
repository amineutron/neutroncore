import { describe, expect, it } from 'vitest'
import {
  ajouterPoint, arrondi, cheminCourbe, changerForme, courbeGamma, couleurLampe, deplacerPoint, dureeLisible, evaluer,
  kelvinVersRgb, mettreALechelle, supprimerPoint, valeur, type Point, type Rampe,
} from './rampes'

const P = (t: number, v: number, forme: Point['forme'] = 'lineaire'): Point => ({ t, v, forme })
const rampe = (over: Partial<Rampe> = {}): Rampe => ({
  id: 'r', nom: 'r', duree_s: 100, pas_s: 10, boucle: false,
  pistes: [{ lampes: ['3'], bri: [P(0, 0), P(100, 200)], kelvin: [] }], ...over,
})

// Les cas ci-dessous sont ceux de tests/test_rampes.py (API) : les deux moteurs doivent donner les mêmes nombres.
describe('moteur de rampes (miroir de lib/rampes.py)', () => {
  it('linéaire et bornes', () => {
    const r = rampe()
    expect([0, -5, 25, 50, 100, 500].map((t) => evaluer(r, t)['3'].bri)).toEqual([0, 0, 50, 100, 200, 200])
  })

  it('formes', () => {
    const f = (forme: Point['forme'], t: number) => evaluer(rampe({ pistes: [{ lampes: ['3'], bri: [P(0, 0, forme), P(100, 200)], kelvin: [] }] }), t)['3'].bri
    expect([f('lineaire', 25), f('doux', 25), f('doux', 50), f('palier', 99)]).toEqual([50, 31, 100, 0])
  })

  it('éteinte à zéro, jamais éteinte par arrondi', () => {
    expect(evaluer(rampe(), 0)['3']).toEqual({ on: false, bri: 0, kelvin: null })
    const r = rampe({ pistes: [{ lampes: ['3'], bri: [P(0, 0.4), P(100, 0.4)], kelvin: [] }] })
    expect(evaluer(r, 10)['3']).toEqual({ on: true, bri: 1, kelvin: null })
  })

  it('valeur tenue avant et après', () => {
    const r = rampe({ pistes: [{ lampes: ['3'], bri: [P(40, 50), P(60, 150)], kelvin: [] }] })
    expect([0, 40, 50, 60, 100].map((t) => evaluer(r, t)['3'].bri)).toEqual([50, 50, 100, 150, 150])
  })

  it('boucle et temps invalide', () => {
    expect(evaluer(rampe({ boucle: true }), 125)['3'].bri).toBe(50)
    expect(evaluer(rampe(), NaN)['3'].bri).toBe(0)
  })

  it('kelvin seul, plusieurs lampes', () => {
    const r = rampe({ pistes: [{ lampes: ['3', '4'], bri: [], kelvin: [P(0, 2000), P(100, 6500)] }] })
    const e = evaluer(r, 50)
    expect(e['3']).toEqual(e['4'])
    expect(e['3']).toEqual({ on: true, bri: null, kelvin: 4250 })
  })

  it('arrondi à la manière de Python (moitiés vers le pair)', () => {
    expect([0.5, 1.5, 2.5, 50.5, 3.4, 3.6].map(arrondi)).toEqual([0, 2, 2, 50, 3, 4])
  })

  it('courbe gamma identique à courbe_gamma', () => {
    const g = courbeGamma(1800, 1, 254)
    expect(g).toHaveLength(9)
    expect(g[0].v).toBe(1)
    expect(g[8].v).toBe(254)
    expect(g[4].v).toBeCloseTo(1 + 253 * Math.pow(0.5, 2.2), 1)
  })
})

describe('édition de courbe', () => {
  const c = [P(0, 10), P(50, 100), P(100, 200)]

  it('ajoute dans l’ordre, refuse trop près, hors durée ou courbe pleine', () => {
    expect(ajouterPoint(c, 25, 40, 100, 24).map((p) => p.t)).toEqual([0, 25, 50, 100])
    expect(ajouterPoint(c, 50.5, 40, 100, 24)).toBe(c)
    expect(ajouterPoint(c, 101, 40, 100, 24)).toBe(c)
    expect(ajouterPoint(c, 25, 40, 100, 3)).toBe(c)
  })

  it('déplace entre ses voisins et dans les bornes, sans muter', () => {
    const avant = JSON.stringify(c)
    const r = deplacerPoint(c, 1, 999, 999, 100, 0, 254)
    expect(r[1]).toEqual({ t: 99, v: 254, forme: 'lineaire' })
    expect(deplacerPoint(c, 1, -5, -5, 100, 0, 254)[1]).toMatchObject({ t: 1, v: 0 })
    expect(deplacerPoint(c, 0, -5, 10, 100, 0, 254)[0].t).toBe(0)
    expect(deplacerPoint(c, 2, 500, 10, 100, 0, 254)[2].t).toBe(100)
    expect(deplacerPoint(c, 9, 1, 1, 100, 0, 254)).toBe(c)
    expect(JSON.stringify(c)).toBe(avant)
  })

  it('supprime, change la forme, met à l’échelle', () => {
    expect(supprimerPoint(c, 1).map((p) => p.t)).toEqual([0, 100])
    expect(changerForme(c, 0, 'doux')[0].forme).toBe('doux')
    expect(c[0].forme).toBe('lineaire')
    expect(mettreALechelle(c, 100, 200).map((p) => p.t)).toEqual([0, 100, 200])
  })

  it('valeur sur courbe vide', () => {
    expect(valeur([], 5)).toBeNull()
  })
})

describe('affichage', () => {
  it('durée lisible', () => {
    expect([45, 90, 1800, 3900, 7200].map(dureeLisible)).toEqual(['45 s', '2 min', '30 min', '1 h05', '2 h00'])
  })

  it('couleurs', () => {
    expect(kelvinVersRgb(2000)[0]).toBe(255)
    expect(kelvinVersRgb(2000)[2]).toBeLessThan(kelvinVersRgb(6500)[2])
    expect(couleurLampe(undefined)).toBe(couleurLampe({ on: false, bri: 0, kelvin: null }))
    const faible = couleurLampe({ on: true, bri: 10, kelvin: 3000 })
    const forte = couleurLampe({ on: true, bri: 254, kelvin: 3000 })
    expect(faible).not.toBe(forte)
  })

  it('chemin SVG : part du bord gauche, finit au bord droit', () => {
    const d = cheminCourbe([P(0, 0), P(100, 200)], 100, 0, 254, 200, 100)
    expect(d.startsWith('M0 100.0')).toBe(true)
    expect(d.endsWith('L200 21.3')).toBe(true)
    expect(cheminCourbe([], 100, 0, 254, 200, 100)).toBe('')
  })
})
