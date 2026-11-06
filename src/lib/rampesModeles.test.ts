import { describe, expect, it } from 'vitest'
import { BRI_MAX, evaluer, K_MAX, K_MIN } from './rampes'
import { depuisModele, MODELES } from './rampesModeles'

describe('rampes de départ', () => {
  it.each(MODELES.map((m) => [m.id]))('%s respecte les limites de l’API', (id) => {
    const r = depuisModele(id, ['3'])!
    expect(r.duree_s).toBeGreaterThanOrEqual(30)
    expect(r.pas_s).toBeGreaterThanOrEqual(2)
    expect(r.pas_s).toBeLessThanOrEqual(60)
    for (const p of r.pistes) {
      for (const c of [p.bri, p.kelvin]) {
        expect(c.length).toBeLessThanOrEqual(24)
        expect(c.every((x) => x.t >= 0 && x.t <= r.duree_s)).toBe(true)
        expect(c.every((x, i) => i === 0 || x.t > c[i - 1].t)).toBe(true)
      }
      expect(p.bri.every((x) => x.v >= 0 && x.v <= BRI_MAX)).toBe(true)
      expect(p.kelvin.every((x) => x.v >= K_MIN && x.v <= K_MAX)).toBe(true)
    }
  })

  it('le coucher de soleil baisse, la respiration revient à son départ', () => {
    const c = depuisModele('coucher', ['3'])!
    const bri = (t: number) => evaluer({ ...c, id: 'c' }, t)['3'].bri as number
    expect(bri(0)).toBe(200)
    expect(bri(1350)).toBeLessThan(120)           // la moitié du temps : déjà bien plus bas que la moitié de la lumière
    expect(bri(2700)).toBe(8)
    const r = { ...depuisModele('respiration', ['3'])!, id: 'r' }
    expect(evaluer(r, 0)['3'].bri).toBe(evaluer(r, 60)['3'].bri)
    expect(evaluer(r, 30)['3'].bri).toBe(180)
  })

  it('modèle inconnu', () => {
    expect(depuisModele('nope', ['3'])).toBeNull()
  })
})
