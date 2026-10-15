import { describe, expect, it } from 'vitest'
import { VUE_ENTIERE, ZOOM_MAX, borner, deplacer, zoomer } from './zoom'

const CADRE = { w: 800, h: 600 }

describe('zoom d’une image agrandie', () => {
  it('le point visé reste sous le doigt', () => {
    const v = zoomer(VUE_ENTIERE, 2, 100, -50, CADRE)
    expect(v).toEqual({ k: 2, x: -100, y: 50 })
    // ce point de l'image (à 100,-50 du centre avant) est toujours affiché à 100,-50
    expect(v.x + 100 * v.k).toBe(100)
  })

  it('le zoom est borné, et revenir à 1 recentre l’image', () => {
    expect(zoomer({ k: 6, x: 0, y: 0 }, 4, 0, 0, CADRE).k).toBe(ZOOM_MAX)
    expect(zoomer({ k: 2, x: -300, y: 200 }, 0.1, 50, 50, CADRE)).toEqual({ k: 1, x: 0, y: 0 })
  })

  it('on ne sort pas l’image du cadre en la déplaçant', () => {
    expect(deplacer({ k: 2, x: 0, y: 0 }, 5000, -5000, CADRE)).toEqual({ k: 2, x: 400, y: -300 })
    expect(deplacer(VUE_ENTIERE, 40, 40, CADRE)).toEqual(VUE_ENTIERE)
    expect(borner({ k: 0.2, x: 9, y: 9 }, CADRE)).toEqual(VUE_ENTIERE)
  })
})
