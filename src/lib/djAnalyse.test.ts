import { describe, expect, it } from 'vitest'
import {
  DROP_VIDE, HORLOGE_DEPART, SUIVI_CLE_VIDE, avancerCle, avancerDrop, avancerHorloge, meilleureCle, nomDeCle, recalerSurAttaque,
  suivreTempo, tempoDepuisAttaques, type EtatDrop,
} from './djAnalyse'

/** Notes d'une gamme, Do en premier : 1 pour chaque note de la gamme, avec la tonique et la quinte plus fortes. */
const gamme = (tonique: number, mineur: boolean): number[] => {
  const degres = mineur ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]
  const c = new Array(12).fill(0.05)
  degres.forEach((d) => { c[(tonique + d) % 12] = 0.5 })
  c[tonique] = 1
  c[(tonique + 7) % 12] = 0.8
  return c
}

describe('tonalité', () => {
  it.each([[0, false, 'do majeur'], [9, true, 'la mineur'], [2, true, 'ré mineur'], [7, false, 'sol majeur']] as const)(
    'reconnaît la gamme %i (mineur : %s)', (tonique, mineur, nom) => {
      const m = meilleureCle(gamme(tonique, mineur))
      expect(m?.cle).toEqual({ tonique, mineur })
      expect(nomDeCle(m?.cle ?? null)).toBe(nom)
      expect(m?.score).toBeGreaterThan(0.8)
    })
  it('ne devine rien sur du silence', () => {
    expect(meilleureCle(new Array(12).fill(0))).toBeNull()
    expect(nomDeCle(null)).toBe('à trouver')
  })
  it('trouve la tonalité après quelques secondes d’écoute', () => {
    let e = SUIVI_CLE_VIDE
    for (let i = 0; i < 90; i++) e = avancerCle(e, gamme(9, true), 1 / 30, i / 30)
    expect(e.cle).toEqual({ tonique: 9, mineur: true })
  })
  it('ne saute pas sur un accord isolé', () => {
    let e = SUIVI_CLE_VIDE
    for (let i = 0; i < 300; i++) e = avancerCle(e, gamme(9, true), 1 / 30, i / 30)
    const accord = new Array(12).fill(0.02); accord[0] = 1; accord[4] = 0.9; accord[7] = 0.9       // un accord de do majeur
    for (let i = 300; i < 330; i++) e = avancerCle(e, accord, 1 / 30, i / 30)                      // pendant une seconde
    expect(e.cle).toEqual({ tonique: 9, mineur: true })
  })
  it('change de tonalité quand la musique y reste', () => {
    let e = SUIVI_CLE_VIDE
    for (let i = 0; i < 300; i++) e = avancerCle(e, gamme(9, true), 1 / 30, i / 30)
    for (let i = 300; i < 1000; i++) e = avancerCle(e, gamme(2, false), 1 / 30, i / 30)
    expect(e.cle).toEqual({ tonique: 2, mineur: false })
  })
})

describe('tempo', () => {
  const coups = (bpm: number, n: number, depart = 0) => Array.from({ length: n }, (_, i) => depart + (i * 60) / bpm)
  it.each([100, 124, 140, 170])('retrouve %i pulsations par minute', (bpm) => {
    const t = tempoDepuisAttaques(coups(bpm, 20))
    expect(t?.bpm).toBeGreaterThanOrEqual(bpm - 1)
    expect(t?.bpm).toBeLessThanOrEqual(bpm + 1)
    expect(t?.confiance).toBeGreaterThan(0.9)
  })
  it('ramène un double-temps dans la plage', () => {
    expect(tempoDepuisAttaques(coups(248, 30))?.bpm).toBeCloseTo(124, 0)
    expect(tempoDepuisAttaques(coups(62, 30))?.bpm).toBeCloseTo(124, 0)
  })
  it('supporte des coups ratés', () => {
    const l = coups(120, 30).filter((_, i) => i % 5 !== 3)
    expect(tempoDepuisAttaques(l)?.bpm).toBeCloseTo(120, 0)
  })
  it('refuse de conclure avec trop peu de coups', () => {
    expect(tempoDepuisAttaques(coups(120, 4))).toBeNull()
    expect(tempoDepuisAttaques([])).toBeNull()
  })
})

describe('horloge', () => {
  it('avance au tempo', () => {
    expect(avancerHorloge({ beat: 0, bpm: 120 }, 1).beat).toBeCloseTo(2)
    expect(avancerHorloge(HORLOGE_DEPART, -1).beat).toBe(0)
  })
  it('se recale à moitié sur une attaque proche d’un temps', () => {
    expect(recalerSurAttaque({ beat: 3.2, bpm: 120 }).beat).toBeCloseTo(3.1)
    expect(recalerSurAttaque({ beat: 3.9, bpm: 120 }).beat).toBeCloseTo(3.95)
  })
  it('ignore un contretemps', () => {
    expect(recalerSurAttaque({ beat: 3.5, bpm: 120 }).beat).toBe(3.5)
  })
  it('suit le tempo mesuré sans sauter', () => {
    const h = suivreTempo({ beat: 0, bpm: 120 }, { bpm: 126, confiance: 0.9 })
    expect(h.bpm).toBeGreaterThan(120)
    expect(h.bpm).toBeLessThan(126)
    expect(suivreTempo({ beat: 0, bpm: 120 }, { bpm: 126, confiance: 0.3 }).bpm).toBe(120)
    expect(suivreTempo({ beat: 0, bpm: 120 }, null).bpm).toBe(120)
  })
})

describe('montée et drop', () => {
  /** Rejoue un scénario image par image à 30 par seconde. */
  type Phase = { s: number; basses: number; volume: number; kickChaque?: number; caisseChaque?: number }
  const jouer = (phases: Phase[]) => {
    let e: EtatDrop = DROP_VIDE, t = 0
    const drops: number[] = []
    const montees: number[] = []
    for (const p of phases) {
      for (let i = 0; i < p.s * 30; i++, t += 1 / 30) {
        const kick = p.kickChaque ? i % Math.round(30 * p.kickChaque) === 0 : false
        const snare = p.caisseChaque ? i % Math.round(30 * p.caisseChaque) === 0 : false
        const r = avancerDrop(e, { basses: p.basses, volume: p.volume, lufs: -40 + 34 * p.volume, kick, snare }, 1 / 30, t)
        e = r.etat; montees.push(r.montee)
        if (r.drop) drops.push(Math.round(t * 10) / 10)
      }
    }
    return { drops, montees, etat: e }
  }
  it('voit le drop quand tout revient après un break', () => {
    const r = jouer([
      { s: 20, basses: 0.7, volume: 0.8, kickChaque: 0.5 },     // morceau fort
      { s: 6, basses: 0.03, volume: 0.45, caisseChaque: 0.6 },   // break avec caisses claires
      { s: 6, basses: 0.8, volume: 0.9, kickChaque: 0.5 },       // retour
    ])
    expect(r.drops).toHaveLength(1)
    expect(r.drops[0]).toBeGreaterThan(26)
    expect(r.drops[0]).toBeLessThan(27.2)
  })
  it('la montée grimpe pendant le break puis retombe au drop', () => {
    const r = jouer([
      { s: 20, basses: 0.7, volume: 0.8, kickChaque: 0.5 },
      { s: 7, basses: 0.03, volume: 0.45, caisseChaque: 0.4 },
      { s: 3, basses: 0.8, volume: 0.9, kickChaque: 0.5 },
    ])
    const max = Math.max(...r.montees)
    expect(max).toBeGreaterThan(0.6)
    expect(r.montees[r.montees.length - 1]).toBe(0)
  })
  it('un morceau régulier ne déclenche jamais de drop', () => {
    expect(jouer([{ s: 60, basses: 0.6, volume: 0.7, kickChaque: 0.5 }]).drops).toEqual([])
  })
  it('un silence ou un début calme n’est pas un break', () => {
    expect(jouer([{ s: 30, basses: 0.02, volume: 0.05 }, { s: 5, basses: 0.8, volume: 0.9, kickChaque: 0.5 }]).drops).toEqual([])
  })
  it('une coupure de quelques temps (moins de 3 s) n’est pas un break', () => {
    const r = jouer([
      { s: 20, basses: 0.7, volume: 0.8, kickChaque: 0.5 },
      { s: 1.5, basses: 0.03, volume: 0.5 }, { s: 5, basses: 0.7, volume: 0.8, kickChaque: 0.5 },
    ])
    expect(r.drops).toEqual([])
  })
  it('une batterie à caisses claires régulières n’est pas une montée (régression : vraie musique, 63 à 76 % du temps en montée)', () => {
    const r = jouer([{ s: 40, basses: 0.1, volume: 0.6, kickChaque: 0.4, caisseChaque: 0.35 }])
    expect(Math.max(...r.montees)).toBe(0)
  })
  it('des basses faibles sans creux de volume ne font pas un break', () => {
    const r = jouer([{ s: 20, basses: 0.7, volume: 0.6, kickChaque: 0.5 }, { s: 6, basses: 0.05, volume: 0.58 }])
    expect(Math.max(...r.montees)).toBe(0)
  })
  it('des caisses claires qui s’accélèrent lancent une montée', () => {
    const r = jouer([
      { s: 20, basses: 0.7, volume: 0.8, kickChaque: 0.5 },
      { s: 2, basses: 0.7, volume: 0.8, kickChaque: 0.5, caisseChaque: 0.8 },
      { s: 2, basses: 0.7, volume: 0.8, kickChaque: 0.5, caisseChaque: 0.25 },
      { s: 2, basses: 0.7, volume: 0.8, kickChaque: 0.5, caisseChaque: 0.12 },
    ])
    expect(Math.max(...r.montees)).toBeGreaterThan(0)
  })
  it('une coupure franche d’une seconde puis le retour est un drop (régression : arrêt net vu dans la vraie musique)', () => {
    let e: EtatDrop = DROP_VIDE, t = 0
    const drops: number[] = []
    const pas = (basses: number, volume: number, lufs: number, lufsM: number, kick: boolean) => {
      const r = avancerDrop(e, { basses, volume, lufs, lufsM, kick, snare: false }, 1 / 30, t)
      e = r.etat
      if (r.drop) drops.push(t)
      t += 1 / 30
    }
    for (let i = 0; i < 30 * 20; i++) pas(0.6, 0.7, -14, -14, i % 15 === 0)           // le morceau joue fort
    for (let i = 0; i < 30; i++) pas(0, 0.2, -17, -70, false)                          // une seconde de silence net
    for (let i = 0; i < 30 * 3; i++) pas(0.8, 0.8, -14, -14, i % 15 === 0)             // tout revient
    expect(drops).toHaveLength(1)
  })
  it('ne répète pas un drop avant le repos', () => {
    const cycle = [{ s: 6, basses: 0.03, volume: 0.45, caisseChaque: 0.6 }, { s: 3, basses: 0.8, volume: 0.9, kickChaque: 0.5 }]
    const r = jouer([{ s: 20, basses: 0.7, volume: 0.8, kickChaque: 0.5 }, ...cycle, ...cycle])
    expect(r.drops.length).toBe(2)
    expect(r.drops[1] - r.drops[0]).toBeGreaterThanOrEqual(9)
  })
})
