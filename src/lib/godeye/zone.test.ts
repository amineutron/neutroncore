import { describe, expect, it } from 'vitest'
import { VUE_DEPART } from '../vueMonde'
import { arrondir, boiteDeVue, cleBoite, partDuMonde, requeteBoite } from './zone'

describe('zone visible', () => {
  it('le monde entier au zoom de départ', () => {
    const b = boiteDeVue({ cx: 0, cy: 0, zoom: 1 }, 720, 360)
    expect(b).toEqual({ sud: -90, nord: 90, ouest: -180, est: 180 })
    expect(partDuMonde(b)).toBeCloseTo(1, 5)
    expect(VUE_DEPART.zoom).toBe(1)
  })
  it('zoomer resserre la zone autour du centre', () => {
    const b = boiteDeVue({ cx: 10, cy: 48, zoom: 4 }, 800, 400)
    expect(b.est - b.ouest).toBeCloseTo(90, 3)
    expect((b.ouest + b.est) / 2).toBeCloseTo(10, 3)
    expect(partDuMonde(b)).toBeLessThan(0.1)
  })
  it('arrondir va vers l\'extérieur, reste dans le monde et stabilise la clé', () => {
    const b = arrondir({ sud: 41.2, ouest: -3.7, nord: 51.1, est: 9.9 })
    expect(b).toEqual({ sud: 40, ouest: -5, nord: 55, est: 10 })
    expect(cleBoite(arrondir({ sud: 41.9, ouest: -3.1, nord: 51.5, est: 9.2 }))).toBe(cleBoite(b))
    expect(arrondir({ sud: -89, ouest: -179, nord: 89, est: 179 })).toEqual({ sud: -90, ouest: -180, nord: 90, est: 180 })
    expect(requeteBoite(b)).toBe('sud=40&ouest=-5&nord=55&est=10')
  })
})
