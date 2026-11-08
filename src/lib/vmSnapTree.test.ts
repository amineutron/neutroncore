import { describe, expect, it } from 'vitest'
import {
  afterDelete, fitView, K_MAX, K_MIN, layout, neighbor, panBy, px, py, treeOf, zoomAt, XS, YS, PAD,
  type SnapIn,
} from './vmSnapTree'

// arbre d'examen : s1 > s2 > (s3 > (s4 > s5 > s6) | s7 > s8) | s9 > s10, en pre-ordre
const EXAM: SnapIn[] = [
  { name: 's1', depth: 0 }, { name: 's2', depth: 1 }, { name: 's3', depth: 2 }, { name: 's4', depth: 3 },
  { name: 's5', depth: 4 }, { name: 's6', depth: 5 }, { name: 's7', depth: 3 }, { name: 's8', depth: 4 },
  { name: 's9', depth: 2 }, { name: 's10', depth: 3 },
]
const parentsOf = (s: SnapIn[]) => Object.fromEntries(treeOf(s).map((n) => [n.name, n.parent]))

describe('reconstruction depuis la profondeur', () => {
  it('le parent est le dernier noeud de profondeur - 1', () => {
    expect(parentsOf(EXAM)).toEqual({ s1: null, s2: 's1', s3: 's2', s4: 's3', s5: 's4', s6: 's5', s7: 's3', s8: 's7', s9: 's2', s10: 's9' })
  })
  it('plusieurs racines', () => {
    expect(parentsOf([{ name: 'a', depth: 0 }, { name: 'b', depth: 0 }, { name: 'c', depth: 1 }])).toEqual({ a: null, b: null, c: 'b' })
  })
  it('un parent explicite prime sur la profondeur', () => {
    expect(parentsOf([{ name: 'a', depth: 0 }, { name: 'b', depth: 0 }, { name: 'c', depth: 1, parent: 'a' }]).c).toBe('a')
  })
  it('parent inconnu, auto-parent et doublon deviennent des racines propres', () => {
    const t = treeOf([{ name: 'a', depth: 0, parent: 'zzz' }, { name: 'b', depth: 1, parent: 'b' }, { name: 'a', depth: 0 }])
    expect(t.map((n) => [n.name, n.parent])).toEqual([['a', null], ['b', null]])
  })
  it('un cycle de parents explicites est casse sans rien perdre', () => {
    const t = treeOf([{ name: 'a', depth: 0, parent: 'b' }, { name: 'b', depth: 0, parent: 'a' }])
    expect(t).toHaveLength(2)
    expect(t.filter((n) => n.parent === null).length).toBeGreaterThanOrEqual(1)
  })
  it('profondeur negative ou fractionnaire : normalisee', () => {
    expect(treeOf([{ name: 'a', depth: -3 }])[0].depth).toBe(0)
  })
  it('liste vide', () => { expect(treeOf([])).toEqual([]) })
})

describe('disposition', () => {
  const L = layout(treeOf(EXAM), 's6')
  it('x suit la profondeur', () => {
    expect(L.pos.s1.x).toBe(0)
    expect(L.pos.s6.x).toBe(5)
    expect(L.pos.s10.x).toBe(3)
  })
  it('la branche principale reste sur un seul couloir', () => {
    const y = L.pos.s1.y
    for (const n of ['s2', 's3', 's4', 's5', 's6']) expect(L.pos[n].y).toBe(y)
  })
  it('chaque branche ouvre son couloir, tous distincts pour les feuilles', () => {
    const leaves = ['s6', 's8', 's10'].map((n) => L.pos[n].y)
    expect(new Set(leaves).size).toBe(3)
    expect(L.lanes).toBe(3)
  })
  it('le fantome prolonge head quand head est une feuille', () => {
    expect(L.ghost).toEqual({ x: 6, y: L.pos.s6.y })
  })
  it('le fantome ouvre un couloir quand head a deja des enfants (retour en arriere)', () => {
    const l = layout(treeOf(EXAM), 's3')
    expect(l.ghost.x).toBe(L.pos.s3.x + 1)
    expect(l.ghost.y).toBe(3)
    expect(l.lanes).toBe(4)
  })
  it('sans snapshot : un seul point', () => {
    const l = layout([], null)
    expect(l.ghost).toEqual({ x: 0, y: 0 })
    expect(l.lanes).toBe(1)
  })
  it('snapshots sans head connu : fantome sous les couloirs existants', () => {
    expect(layout(treeOf(EXAM), null).ghost).toEqual({ x: 0, y: 3 })
  })
  it('taille du dessin = pas x pas + marges', () => {
    expect(L.w).toBe(6 * XS + 2 * PAD)
    expect(L.h).toBe(2 * YS + 2 * PAD)
    expect(px(2)).toBe(PAD + 2 * XS)
    expect(py(1)).toBe(PAD + YS)
  })
  it('une chaine de 20000 snapshots ne depasse pas la pile', () => {
    const chain: SnapIn[] = Array.from({ length: 20000 }, (_, i) => ({ name: `n${i}`, depth: i }))
    const l = layout(treeOf(chain), 'n19999')
    expect(l.pos.n19999.x).toBe(19999)
    expect(l.lanes).toBe(1)
  })
})

describe('vue : ajuster, zoomer, deplacer', () => {
  it('ajuste sans agrandir au-dela de 1,1 et centre', () => {
    const v = fitView({ w: 200, h: 100 }, 1000, 600)
    expect(v.k).toBe(1.1)
    expect(v.x).toBeCloseTo((1000 - 200 * 1.1) / 2)
  })
  it('reduit un grand arbre pour qu\'il tienne', () => {
    const v = fitView({ w: 2000, h: 300 }, 800, 440)
    expect(v.k).toBeLessThan(0.45 + 0.1)
    expect(v.k).toBeGreaterThanOrEqual(0.5)
  })
  it('le zoom garde fixe le point sous le curseur', () => {
    const v0 = { x: 30, y: 20, k: 1 }
    const v1 = zoomAt(v0, 1.5, 200, 100)
    expect(200 * 0 + (200 - v1.x) / v1.k).toBeCloseTo((200 - v0.x) / v0.k)
    expect((100 - v1.y) / v1.k).toBeCloseTo((100 - v0.y) / v0.k)
  })
  it('le zoom est borne', () => {
    let v = { x: 0, y: 0, k: 1 }
    for (let i = 0; i < 50; i++) v = zoomAt(v, 2, 0, 0)
    expect(v.k).toBe(K_MAX)
    for (let i = 0; i < 50; i++) v = zoomAt(v, 0.5, 0, 0)
    expect(v.k).toBe(K_MIN)
  })
  it('deplacer ne change pas le zoom', () => { expect(panBy({ x: 1, y: 2, k: 1.3 }, 5, -4)).toEqual({ x: 6, y: -2, k: 1.3 }) })
})

describe('clavier', () => {
  const t = treeOf(EXAM)
  it.each([
    ['s4', 'ArrowLeft', 's3'], ['s3', 'ArrowRight', 's4'], ['s4', 'ArrowDown', 's7'], ['s7', 'ArrowUp', 's4'],
    ['s3', 'ArrowDown', 's9'], ['s9', 'ArrowUp', 's3'], ['s4', 'ArrowUp', null], ['s1', 'ArrowLeft', null],
    ['s6', 'ArrowRight', null], ['s1', 'ArrowDown', null],
  ] as const)('%s %s -> %s', (from, key, to) => {
    expect(neighbor(t, from, key)).toBe(to)
  })
  it('nom inconnu : rien', () => { expect(neighbor(t, 'zz', 'ArrowLeft')).toBeNull() })
})

describe('suppression', () => {
  const t = treeOf(EXAM)
  it('les enfants sont rattaches au parent', () => {
    const r = afterDelete(t, 's2')
    expect('nodes' in r).toBe(true)
    if ('nodes' in r) {
      expect(r.moved.sort()).toEqual(['s3', 's9'])
      expect(r.nodes.find((n) => n.name === 's3')?.parent).toBe('s1')
      expect(r.nodes.find((n) => n.name === 's2')).toBeUndefined()
    }
  })
  it('une racine a plusieurs branches ne se supprime pas', () => {
    const r = afterDelete(treeOf([{ name: 'r', depth: 0 }, { name: 'a', depth: 1 }, { name: 'b', depth: 1 }]), 'r')
    expect(r).toHaveProperty('error')
  })
  it('une racine a une seule branche se supprime', () => {
    const r = afterDelete(treeOf([{ name: 'r', depth: 0 }, { name: 'a', depth: 1 }]), 'r')
    expect('nodes' in r && r.nodes[0]).toMatchObject({ name: 'a', parent: null })
  })
  it('snapshot inconnu', () => { expect(afterDelete(t, 'zz')).toHaveProperty('error') })
  it('ne modifie pas l\'arbre d\'origine', () => {
    const before = JSON.stringify(t)
    afterDelete(t, 's2')
    expect(JSON.stringify(t)).toBe(before)
  })
})
