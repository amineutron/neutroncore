import { describe, expect, it } from 'vitest'
import type { Objet } from './modele'
import { alaUne, compter, interet } from './une'

const o = (id: string, couche: Objet['couche'], ton: Objet['ton'], rayon = 5, sorte?: string): Objet =>
  ({ id, couche, ton, rayon, lon: 0, lat: 0, titre: id, detail: '', sorte })

describe('à la une', () => {
  it('une urgence aérienne passe devant un gros séisme, puis un incendie, puis un avion militaire', () => {
    const liste = [o('mil', 'avions', 'warn'), o('feu', 'evenements', 'crit'), o('sei', 'seismes', 'crit', 20), o('urg', 'avions', 'crit')]
    expect(alaUne(liste).map((x) => x.id)).toEqual(['urg', 'sei', 'feu', 'mil'])
  })
  it("écarte les avions et navires ordinaires, le repère cyber, et borne la liste", () => {
    const liste = [o('civil', 'avions', 'info'), o('nav', 'navires', 'ok'), o('cy', 'cyber', 'crit'), ...Array.from({ length: 15 }, (_, i) => o(`s${i}`, 'seismes', 'ok', 3 + i))]
    const une = alaUne(liste, 5)
    expect(une).toHaveLength(5)
    expect(une.every((x) => x.couche === 'seismes')).toBe(true)
    expect(une[0].id).toBe('s14')
  })
  it("l'ISS passe avant les autres satellites ; ordre stable à égalité", () => {
    const iss = o('iss', 'satellites', 'ok', 6, 'stations')
    expect(interet(iss)).toBeGreaterThan(interet(o('gps', 'satellites', 'ok', 3.5, 'gps-ops')))
    expect(alaUne([o('b', 'seismes', 'ok'), o('a', 'seismes', 'ok')]).map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('ne modifie pas la liste donnée', () => {
    const liste = [o('b', 'seismes', 'ok', 3), o('a', 'seismes', 'ok', 9)]
    alaUne(liste)
    expect(liste.map((x) => x.id)).toEqual(['b', 'a'])
  })
  it('compter', () => {
    expect(compter([o('a', 'avions', 'info'), o('b', 'avions', 'info'), o('c', 'navires', 'ok')])).toMatchObject({ avions: 2, navires: 1, seismes: 0 })
  })
})
