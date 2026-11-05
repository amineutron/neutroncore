import { describe, expect, it } from 'vitest'
import { CADENCE_DEPART, ETAT_DEPART, REGLAGES_AMBILIGHT, avancer, couleurDeNiveau, decider, type ReglagesAmbilight } from './djAmbilight'

const R = (p: Partial<ReglagesAmbilight> = {}): ReglagesAmbilight => ({ ...REGLAGES_AMBILIGHT, auto: false, ...p })   // la correspondance simple ; l'auto a ses tests (djAmbilightAuto.test.ts)

/** Joue une suite de signaux à intervalle régulier ; rend les niveaux obtenus. */
const jouer = (signaux: number[], reglages: ReglagesAmbilight, pasMs = 100): number[] => {
  let etat = ETAT_DEPART
  return signaux.map((s, i) => { const r = avancer(etat, s, i * pasMs, reglages); etat = r.etat; return r.niveau })
}

describe('avancer : du signal au niveau de l’Ambilight', () => {
  it('reste entre le minimum et le maximum choisis', () => {
    const niveaux = jouer([0, 1, 0.5, 0, 1, 1, 0], R({ min: 20, max: 80, lissage: 0 }))
    for (const n of niveaux) { expect(n).toBeGreaterThanOrEqual(0.2 - 1e-9); expect(n).toBeLessThanOrEqual(0.8 + 1e-9) }
  })
  it('sans lissage, le niveau suit le signal d’un coup : silence = minimum, plein son = maximum', () => {
    expect(jouer([0], R({ min: 10, max: 90, lissage: 0 }))[0]).toBeCloseTo(0.1)
    expect(jouer([1], R({ min: 10, max: 90, lissage: 0 }))[0]).toBeCloseTo(0.9)
    expect(jouer([0.5], R({ min: 10, max: 90, lissage: 0 }))[0]).toBeCloseTo(0.5)
  })
  it('avec du lissage, un pic bref n’atteint pas le maximum', () => {
    const n = jouer([0, 0, 0, 1, 0, 0], R({ min: 0, max: 100, lissage: 60 }))
    expect(Math.max(...n)).toBeLessThan(0.5)
  })
  it('monte plus vite qu’il ne redescend', () => {
    const r = R({ min: 0, max: 100, lissage: 50 })
    const montee = jouer([0, 1, 1, 1], r)           // de 0 vers 1
    const descente = jouer([1, 0, 0, 0], r)         // de 1 vers 0
    expect(montee[3]).toBeGreaterThan(1 - descente[3])
  })
  it('plus le lissage est grand, plus le niveau est lent', () => {
    const signaux = [0, 1, 1, 1, 1]
    const vif = jouer(signaux, R({ lissage: 10 }))[4]
    const lent = jouer(signaux, R({ lissage: 90 }))[4]
    expect(vif).toBeGreaterThan(lent)
  })
  it('converge vers le signal constant', () => {
    const n = jouer(Array(100).fill(0.7), R({ min: 0, max: 100, lissage: 50 }))
    expect(n[99]).toBeCloseTo(0.7, 2)
  })
  it('la première image part du signal lui-même, sans montée depuis zéro', () => {
    expect(jouer([1], R({ min: 0, max: 100, lissage: 100 }))[0]).toBeCloseTo(1)
  })
  it('un trou de temps (onglet en arrière-plan) ne fait pas sauter le niveau', () => {
    let etat = ETAT_DEPART
    etat = avancer(etat, 0, 0, R({ lissage: 50 })).etat
    const apres = avancer(etat, 1, 60_000, R({ lissage: 50 }))
    expect(apres.niveau).toBeLessThan(1)
  })
  it('un minimum supérieur au maximum est remis dans l’ordre plutôt que de sortir de la plage', () => {
    const n = jouer([0, 1], R({ min: 80, max: 30, lissage: 0 }))
    expect(Math.min(...n)).toBeGreaterThanOrEqual(0.3 - 1e-9)
    expect(Math.max(...n)).toBeLessThanOrEqual(0.8 + 1e-9)
  })
  it('ignore un signal absurde (NaN, hors plage)', () => {
    const n = jouer([Number.NaN, 5, -3], R({ min: 0, max: 100, lissage: 0 }))
    expect(n.every((v) => v >= 0 && v <= 1)).toBe(true)
  })
  it('ne modifie pas l’état reçu', () => {
    const avant = { ...ETAT_DEPART }
    avancer(avant, 1, 100, R())
    expect(avant).toEqual(ETAT_DEPART)
  })
})

describe('couleurDeNiveau', () => {
  it('éteint à 0, pleine couleur à 1, proportionnel entre les deux', () => {
    expect(couleurDeNiveau(0, '#ff8c28')).toEqual({ r: 0, g: 0, b: 0 })
    expect(couleurDeNiveau(1, '#ff8c28')).toEqual({ r: 255, g: 140, b: 40 })
    expect(couleurDeNiveau(0.5, '#ff8c28')).toEqual({ r: 128, g: 70, b: 20 })
  })
  it('borne le niveau et retombe sur du blanc chaud si la couleur est invalide', () => {
    expect(couleurDeNiveau(3, '#ff8c28')).toEqual({ r: 255, g: 140, b: 40 })
    expect(couleurDeNiveau(-1, '#ff8c28')).toEqual({ r: 0, g: 0, b: 0 })
    expect(couleurDeNiveau(1, 'n’importe quoi')).toEqual({ r: 255, g: 140, b: 40 })
  })
})

describe('decider : une seule requête utile à la fois, jamais plus vite que la cadence', () => {
  it('envoie la première valeur tout de suite', () => {
    expect(decider(CADENCE_DEPART, 0, 0.5, 10).envoyer).toBe(true)
  })
  it('n’envoie pas avant la période (10 Hz = 100 ms)', () => {
    const premier = decider(CADENCE_DEPART, 0, 0.2, 10)
    expect(decider(premier.cadence, 50, 0.9, 10).envoyer).toBe(false)
    expect(decider(premier.cadence, 100, 0.9, 10).envoyer).toBe(true)
  })
  it('n’envoie pas un niveau quasi identique (zone morte), sauf pour rafraîchir la TV chaque seconde', () => {
    const premier = decider(CADENCE_DEPART, 0, 0.5, 10)
    expect(decider(premier.cadence, 200, 0.505, 10).envoyer).toBe(false)
    expect(decider(premier.cadence, 1000, 0.505, 10).envoyer).toBe(true)
  })
  it('un tick manqué n’est pas rattrapé : le dernier niveau suffit', () => {
    const premier = decider(CADENCE_DEPART, 0, 0.1, 10)
    const tard = decider(premier.cadence, 450, 0.8, 10)
    expect(tard.envoyer).toBe(true)
    expect(decider(tard.cadence, 460, 0.1, 10).envoyer).toBe(false)
  })
  it('borne la cadence demandée à 1..15 Hz pour ne pas saturer la TV', () => {
    const premier = decider(CADENCE_DEPART, 0, 0.1, 500)
    expect(decider(premier.cadence, 30, 0.9, 500).envoyer).toBe(false)           // plafonné à 15 Hz = 66 ms
    expect(decider(premier.cadence, 70, 0.9, 500).envoyer).toBe(true)
  })
  it('ne modifie pas la cadence reçue', () => {
    const avant = { ...CADENCE_DEPART }
    decider(avant, 0, 0.5, 10)
    expect(avant).toEqual(CADENCE_DEPART)
  })
})
