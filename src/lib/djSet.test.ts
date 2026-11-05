import { describe, expect, it } from 'vitest'
import { avancement, avancerSet, demarrerSet, mesuresTotales, precedent, suivant } from './djSet'
import type { SetDj } from './djCouches'

const set = (boucle: boolean, fins: ('mesures' | 'drop' | 'manuel')[] = ['mesures', 'drop', 'manuel']): SetDj => ({
  id: 'set00001', nom: 'test', boucle,
  pas: fins.map((fin, i) => ({ scene: `scene00${i}`, profil: null, mesures: 2, fin })),
})

describe('set DJ', () => {
  it('un pas de 2 mesures passe au suivant après 8 temps', () => {
    const s = set(false)
    const l = demarrerSet(s, 100)
    expect(avancerSet(s, l, 107.9, false).change).toBe(false)
    const r = avancerSet(s, l, 108, false)
    expect(r.change).toBe(true)
    expect(r.lecture).toEqual({ set: 'set00001', index: 1, depuis: 108 })
  })
  it('un pas « drop » attend le drop, mais pas avant une mesure', () => {
    const s = set(false)
    const l = { set: s.id, index: 1, depuis: 0 }
    expect(avancerSet(s, l, 50, false).change).toBe(false)
    expect(avancerSet(s, l, 3, true).change).toBe(false)
    expect(avancerSet(s, l, 4, true).change).toBe(true)
  })
  it('un pas manuel ne passe jamais tout seul', () => {
    const s = set(false)
    const l = { set: s.id, index: 2, depuis: 0 }
    expect(avancerSet(s, l, 9999, true)).toEqual({ lecture: l, change: false })
  })
  it('un set sans boucle finit, avec boucle il recommence', () => {
    expect(suivant(set(false), { set: 'set00001', index: 2, depuis: 0 }, 5)).toBeNull()
    expect(suivant(set(true), { set: 'set00001', index: 2, depuis: 0 }, 5)).toEqual({ set: 'set00001', index: 0, depuis: 5 })
  })
  it('revient en arrière, en bouclant', () => {
    const s = set(true)
    expect(precedent(s, { set: s.id, index: 0, depuis: 0 }, 7).index).toBe(2)
    expect(precedent(s, { set: s.id, index: 2, depuis: 0 }, 7).index).toBe(1)
  })
  it('un pas inconnu ne plante pas', () => {
    expect(avancerSet(set(false), { set: 'set00001', index: 9, depuis: 0 }, 1, false)).toEqual({ lecture: null, change: false })
  })
  it('mesure l’avancement du pas', () => {
    const s = set(false)
    expect(avancement(s, { set: s.id, index: 0, depuis: 0 }, 4)).toBeCloseTo(0.5)
    expect(avancement(s, { set: s.id, index: 2, depuis: 0 }, 4)).toBe(1)
    expect(avancement(s, { set: s.id, index: 0, depuis: 10 }, 0)).toBe(0)
  })
  it('compte les mesures d’un set', () => {
    expect(mesuresTotales(set(false))).toBe(2 + 1 + 2)
  })
})
