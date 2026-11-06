import { describe, expect, it } from 'vitest'
import { DjMoteur } from './djMoteur'
import { suiteRythmee } from './djBench'
import { lireReglages, REGLAGES_DEFAUT, type ReglagesDj } from './djReglages'
import { nouvelleCouche, type Profil } from './djCouches'
import { COMMUN_DEFAUT, type Dims, type Scene } from './spatialFx'
import type { ImageAudio } from './djSignaux'

const DIMS: Dims = { w: 400, h: 300, d: 250 }
const SCENE: Scene = { id: 'sc000001', nom: 'onde', effets: ['onde'], palette: 'neon', axe: 'x', source: { x: 50, y: 30, z: 35 }, intensite: 100 }
const PROFIL: Profil = { id: 'p', nom: 't', couches: [nouvelleCouche('couleurs', { id: 'couleurs0' }), nouvelleCouche('scene', { id: 'scene000' })] }
const ctx = { profil: PROFIL, scene: SCENE, scenes: [SCENE], commun: COMMUN_DEFAUT, dims: DIMS }

/** Joue des images dans un moteur, une par une à leur heure, et rend ce qu'il a lu après chacune. */
function jouer(images: ImageAudio[], r: ReglagesDj = REGLAGES_DEFAUT, moteur = new DjMoteur()) {
  moteur.regler(r)
  const lectures: ReturnType<DjMoteur['lecture']>[] = []
  images.forEach((im) => { const ms = im.t * 1000; moteur.pousser(im, ms); lectures.push(moteur.lecture(ms)) })
  return { moteur, lectures }
}
const dernier = <T,>(v: T[]): T => v[v.length - 1]

describe('moteur : tempo par le cycle', () => {
  it('trouve le tempo d un rythme irrégulier (les trois quarts des grosses caisses absentes)', () => {
    const { lectures } = jouer(suiteRythmee(138, 4, 30, { oubli: 0.75, oubliUn: 0.3 }).images)
    const l = dernier(lectures)
    expect(Math.abs(l.bpm / 138 - 1)).toBeLessThan(0.03)
    expect(l.source).toBe('cycle')
    expect(l.enMain).toBe(true)
    expect(l.cycle?.mesure).toBe(4)
  })
  it('éteint, le tempo ne vient jamais du cycle et rien n est calculé', () => {
    const r = lireReglages({ cycle: { actif: false } })
    const { lectures } = jouer(suiteRythmee(128, 4, 30).images, r)
    expect(lectures.every((l) => l.source !== 'cycle' && l.cycle === null && !l.enMain && l.temps === null)).toBe(true)
    expect(Math.abs(dernier(lectures).bpm / 128 - 1)).toBeLessThan(0.03)            // les grosses caisses suffisent ici
  })
  it('suit un changement de morceau (100 puis 150 par minute)', () => {
    const a = suiteRythmee(100, 4, 25).images, b = suiteRythmee(150, 4, 40, { graine: 3 }).images
    const decale = b.map((im) => ({ ...im, t: im.t + 25 }))
    const { lectures } = jouer([...a, ...decale])
    expect(Math.abs(lectures[24 * 30].bpm / 100 - 1)).toBeLessThan(0.03)
    expect(Math.abs(dernier(lectures).bpm / 150 - 1)).toBeLessThan(0.03)
  })
  it('le tempo imposé à la main n est pas pris par le cycle', () => {
    const m = new DjMoteur()
    m.reglerTempo(90)
    const { lectures } = jouer(suiteRythmee(128, 4, 25).images, REGLAGES_DEFAUT, m)
    expect(dernier(lectures).bpm).toBe(90)
    expect(dernier(lectures).source).toBe('main')
  })
  it('compte les temps de la mesure et envoie un pic sur le premier', () => {
    const { lectures } = jouer(suiteRythmee(128, 4, 40).images)
    const fin = lectures.slice(25 * 30)
    const temps = fin.map((l) => l.temps)
    expect(temps.every((t) => t !== null)).toBe(true)
    expect(new Set(temps)).toEqual(new Set([1, 2, 3, 4]))
    // chaque temps dure ~0,47 s : l ordre est toujours 1, 2, 3, 4, 1...
    const suite = temps.filter((t, i) => i === 0 || t !== temps[i - 1])
    expect(suite.every((t, i) => i === 0 || t === ((suite[i - 1]! % 4) + 1))).toBe(true)
    // le pic « temps1 » monte une fois par mesure (1,875 s) : 15 s / 1,875 = 8 mesures
    const pics = fin.filter((l, i) => i > 0 && l.signaux.temps1 > 0.9 && fin[i - 1].signaux.temps1 < 0.9).length
    expect(pics).toBeGreaterThanOrEqual(6)
    expect(pics).toBeLessThanOrEqual(9)
  })
})

describe('moteur : onde rapide et avance', () => {
  const beatApres = (r: ReglagesDj) => {
    const { moteur } = jouer(suiteRythmee(120, 4, 12).images, r)
    return moteur.lumiere(12000, ctx)
  }
  it('l onde rapide et l avance viennent des réglages', () => {
    expect(beatApres(REGLAGES_DEFAUT).sortie.params.vitesseOnde).toBe(REGLAGES_DEFAUT.onde.vitesse)
    expect(beatApres(lireReglages({ onde: { actif: false } })).sortie.params.vitesseOnde).toBeUndefined()
    expect(beatApres(lireReglages({ onde: { vitesse: 3 } })).sortie.params.vitesseOnde).toBe(3)
  })
  it('l avance décale le temps des effets, et seulement quand elle est active', () => {
    const sans = beatApres(lireReglages({ avance: { actif: false, ms: 100 } })).beat
    const avec = beatApres(lireReglages({ avance: { actif: true, ms: 100 } })).beat
    expect(avec - sans).toBeCloseTo((100 / 1000) * (120 / 60), 1)            // 100 ms à 120 par minute : 0,2 temps
    expect(beatApres(lireReglages({ avance: { actif: true, ms: 0 } })).beat).toBeCloseTo(sans, 5)
  })
  it('les réglages changent à chaud, sans repartir de zéro', () => {
    const m = new DjMoteur()
    const images = suiteRythmee(128, 4, 30).images
    jouer(images.slice(0, 20 * 30), REGLAGES_DEFAUT, m)
    const avant = m.lecture(20000).bpm
    m.regler(lireReglages({ cycle: { actif: false } }))
    for (const im of images.slice(20 * 30)) m.pousser(im, im.t * 1000)
    expect(Math.abs(avant / 128 - 1)).toBeLessThan(0.03)
    expect(Math.abs(m.lecture(30000).bpm / 128 - 1)).toBeLessThan(0.03)
  })
})
