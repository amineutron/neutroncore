import { describe, expect, it } from 'vitest'
import { ETAT_DEPART, REGLAGES_AMBILIGHT, avancer, type ReglagesAmbilight } from './djAmbilight'
import { lireReglagesAmbilight, SAUVEGARDES_DEPART } from './djAmbilightSaves'

const FPS = 30
const R = (p: Partial<ReglagesAmbilight> = {}): ReglagesAmbilight => ({ ...REGLAGES_AMBILIGHT, min: 0, max: 100, lissage: 0, ...p })

/** Joue `secondes` de signal `f(t)` (t en s) à 30 images/s ; rend les niveaux, et l'état à passer à la suite. */
function jouer(f: (t: number) => number, secondes: number, r: ReglagesAmbilight, depart = ETAT_DEPART, t0 = 0) {
  let etat = depart
  const niveaux: number[] = []
  for (let i = 0; i < secondes * FPS; i++) {
    const t = t0 + i / FPS
    const a = avancer(etat, f(t), t * 1000, r)
    etat = a.etat
    niveaux.push(a.niveau)
  }
  return { niveaux, etat, fin: t0 + secondes }
}
const amplitude = (v: number[]): number => Math.max(...v) - Math.min(...v)
const fin = (v: number[], s: number): number[] => v.slice(-s * FPS)
const oscille = (bas: number, haut: number, hz = 1) => (t: number): number => bas + (haut - bas) * (0.5 + 0.5 * Math.sin(2 * Math.PI * hz * t))

describe('sensibilité auto : le niveau suit la dynamique de la musique', () => {
  it('sans auto, un signal qui ne varie qu’entre 0,4 et 0,6 reste un faible mouvement autour de 50 %', () => {
    const { niveaux } = jouer(oscille(0.4, 0.6), 30, R({ auto: false }))
    expect(amplitude(fin(niveaux, 10))).toBeLessThan(0.25)
  })
  it('avec auto, le même signal balaie presque toute la plage min..max', () => {
    const { niveaux } = jouer(oscille(0.4, 0.6), 30, R({ auto: true }))
    expect(amplitude(fin(niveaux, 10))).toBeGreaterThan(0.8)
  })
  it('respecte le minimum et le maximum choisis', () => {
    const { niveaux } = jouer(oscille(0.4, 0.6), 30, R({ auto: true, min: 20, max: 70 }))
    const bout = fin(niveaux, 10)
    expect(Math.min(...bout)).toBeGreaterThanOrEqual(0.2 - 1e-9)
    expect(Math.max(...bout)).toBeLessThanOrEqual(0.7 + 1e-9)
    expect(amplitude(bout)).toBeGreaterThan(0.4)
  })
  it('un signal constant n’est pas amplifié en bruit : le niveau reste stable, à mi-plage', () => {
    const { niveaux } = jouer(() => 0.5, 40, R({ auto: true }))
    const bout = fin(niveaux, 10)
    expect(amplitude(bout)).toBeLessThan(0.05)
    expect(bout[bout.length - 1]).toBeGreaterThan(0.35)
    expect(bout[bout.length - 1]).toBeLessThan(0.65)
  })
  it('le silence ramène toujours au minimum, même après longtemps', () => {
    const musique = jouer(oscille(0.3, 0.7), 20, R({ auto: true }))
    const calme = jouer(() => 0, 60, R({ auto: true }), musique.etat, musique.fin)
    expect(calme.niveaux[calme.niveaux.length - 1]).toBeCloseTo(0, 2)
    expect(Math.max(...fin(calme.niveaux, 10))).toBeLessThan(0.05)
  })
  it('s’adapte quand la musique devient plus forte', () => {
    const douce = jouer(oscille(0.1, 0.3, 2), 25, R({ auto: true }))
    const forte = jouer(oscille(0.5, 0.9, 2), 30, R({ auto: true }), douce.etat, douce.fin)
    expect(amplitude(fin(forte.niveaux, 10))).toBeGreaterThan(0.7)
  })
  it('un pic isolé dans un morceau calme ressort nettement au-dessus du reste', () => {
    const f = (t: number) => (Math.abs(t - 25) < 0.15 ? 0.9 : 0.3 + 0.02 * Math.sin(t))
    const { niveaux } = jouer(f, 30, R({ auto: true }))
    const pic = Math.max(...niveaux.slice(24 * FPS, 26 * FPS))
    const calme = niveaux.slice(20 * FPS, 24 * FPS).reduce((a, b) => a + b, 0) / (4 * FPS)
    expect(pic).toBeGreaterThan(calme + 0.3)
  })
  it('ne modifie pas l’état reçu', () => {
    const avant = { ...ETAT_DEPART }
    avancer(avant, 0.6, 100, R({ auto: true }))
    expect(avant).toEqual(ETAT_DEPART)
  })
})

describe('réglage « sensibilité auto » : lecture et sauvegardes', () => {
  it('actif par défaut', () => {
    expect(REGLAGES_AMBILIGHT.auto).toBe(true)
    expect(lireReglagesAmbilight({}).auto).toBe(true)
  })
  it('se lit tel quel, un non-booléen reprend le défaut', () => {
    expect(lireReglagesAmbilight({ auto: false }).auto).toBe(false)
    expect(lireReglagesAmbilight({ auto: 'oui' }).auto).toBe(true)
  })
  it('les sauvegardes de départ le portent', () => {
    for (const s of SAUVEGARDES_DEPART) expect(typeof s.reglages.auto).toBe('boolean')
  })
})
