import { describe, expect, it } from 'vitest'
import { camAt, camForDir, ease, explodeAt, filmDuration, finalShots, fonduAt, montageShots, shotAt, slideAt, type Shot, camIso } from './atelierFilm'
import type { MontageStep } from './atelierMontage'

const cam = (az: number) => ({ az, el: 20, k: 1 })
const S = (titre: string, nouvelles: string[]): MontageStep => ({ n: 1, titre, astuce: '', nouvelles, reprises: [], deduites: [], visibles: nouvelles })

describe('déroulé d’un film', () => {
  const shots: Shot[] = [{ dur: 2, from: cam(0), to: cam(90) }, { dur: 4, from: cam(90), to: cam(90), explode: [0, 1] }]
  it('retrouve le plan et l’avancement à un instant donné', () => {
    expect(filmDuration(shots)).toBe(6)
    expect(shotAt(shots, 0)).toEqual({ index: 0, u: 0 })
    expect(shotAt(shots, 1)).toEqual({ index: 0, u: 0.5 })
    expect(shotAt(shots, 4)).toEqual({ index: 1, u: 0.5 })
    expect(shotAt(shots, 6)).toBeNull()
    expect(shotAt([], 0)).toBeNull()
  })
  it('la caméra part et arrive en douceur, exactement aux bornes', () => {
    expect(camAt(shots[0], 0).az).toBe(0)
    expect(camAt(shots[0], 1).az).toBe(90)
    expect(camAt(shots[0], 0.5).az).toBe(45)
    expect(camAt(shots[0], 0.1).az).toBeLessThan(9)
    expect(camAt({ ...shots[0], camFin: 0.25 }, 0.25).az).toBe(90)
    expect(camAt({ ...shots[0], camFin: 0.25 }, 0.9).az).toBe(90)
  })
  it('éclaté, arrivée des pièces et fondus restent entre 0 et 1', () => {
    expect([explodeAt(shots[1], 0), explodeAt(shots[1], 1), explodeAt(shots[0], 0.5)]).toEqual([0, 1, 0])
    expect([slideAt(0), slideAt(0.3), slideAt(0.75), slideAt(1)]).toEqual([0, 0, 1, 1])
    expect(slideAt(0.5)).toBeGreaterThan(0)
    expect([fonduAt({ ...shots[0], fondu: 'in' }, 0), fonduAt({ ...shots[0], fondu: 'in' }, 0.5), fonduAt({ ...shots[0], fondu: 'out' }, 1), fonduAt(shots[0], 0.5)]).toEqual([1, 0, 1, 0])
    expect([ease(-1), ease(2)]).toEqual([0, 1])
  })
})

describe('notice de montage filmée', () => {
  const steps = [S('Poser les inserts', ['insert_a']), S('Présenter la béquille', ['bequille']), S('Vue d’ensemble', [])]
  const shots = montageShots('support', steps, [camForDir([0, 0, 1]), camForDir([0, 0, -1]), camForDir([0, 0, 1])], [['2 × insert'], ['béquille'], []])
  it('une ouverture, puis un plan par geste dans l’ordre', () => {
    expect(shots).toHaveLength(4)
    expect(shots[0]).toMatchObject({ titre: 'support', sous: 'montage en 3 gestes', fondu: 'in' })
    expect(shots.slice(1).map((s) => s.step)).toEqual([0, 1, 2])
    expect(shots[1]).toMatchObject({ numero: '1 / 3', titre: 'Poser les inserts', liste: ['2 × insert'] })
  })
  it('la caméra de chaque plan repart d’où le précédent l’a laissée', () => {
    expect(shots[2].from).toEqual(shots[1].to)
    expect(shots[3].from.az).toBe(shots[2].to.az)
  })
  it('passe au dos par le chemin court, et un geste sans pièce dure moins', () => {
    expect(Math.abs(shots[2].to.az - shots[2].from.az)).toBeLessThanOrEqual(180)
    expect(shots[3].dur).toBeLessThan(shots[1].dur)
    expect(shots[3].fondu).toBe('out')
  })
  it('rien à monter, rien à filmer', () => {
    expect(montageShots('x', [], [], [])).toEqual([])
  })
})

describe('film de présentation', () => {
  const shots = finalShots('support', '3 pièces imprimées')
  it('ouvre et ferme sur le nom, passe par une vue éclatée qui se referme', () => {
    expect(shots[0]).toMatchObject({ titre: 'support', fondu: 'in' })
    expect(shots[shots.length - 1]).toMatchObject({ titre: 'support', sous: '3 pièces imprimées', fondu: 'out' })
    const eclates = shots.filter((s) => s.explode)
    expect(eclates[0].explode![0]).toBe(0)
    expect(eclates[eclates.length - 1].explode![1]).toBe(0)
    expect(Math.max(...eclates.flatMap((s) => s.explode!))).toBeGreaterThan(1)
  })
  it('dure entre 20 et 30 secondes, sans saut d’éclaté entre deux plans', () => {
    expect(filmDuration(shots)).toBeGreaterThan(20)
    expect(filmDuration(shots)).toBeLessThan(30)
    for (let i = 1; i < shots.length; i++) expect(shots[i].explode?.[0] ?? 0).toBe(shots[i - 1].explode?.[1] ?? 0)
  })
})

describe('vue isométrique d’une vignette', () => {
  const B = (min: [number, number, number], max: [number, number, number]) => ({ min, max })
  const boites = { corps: B([-50, -80, -10], [50, 80, 10]), clip_droit: B([40, 60, 0], [50, 70, 10]), pied: B([-50, -80, -30], [-30, -70, -10]), coeur: B([-5, -5, -2], [5, 5, 2]) }

  it('regarde du côté où se trouve la pièce', () => {
    expect(camIso(['clip_droit'], boites)).toMatchObject({ az: 35, el: 26 })
    expect(camIso(['pied'], boites)).toMatchObject({ az: -145, el: -22 })
  })

  it('une pièce au centre, inconnue ou absente garde la vue par défaut', () => {
    expect(camIso(['coeur'], { corps: boites.corps, coeur: boites.coeur })).toMatchObject({ az: 35, el: 26 })
    expect(camIso(['inconnue'], boites)).toMatchObject({ az: 35, el: 26 })
    expect(camIso([], {})).toMatchObject({ az: 35, el: 26 })
  })
})
