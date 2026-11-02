import { describe, expect, it } from 'vitest'
import {
  defaultLayout, hiddenIds, mergeVisibleOrder, indexAtPoint, indexAtVisualPoint, loadLayout, normalizeLayout, persistLayout,
  previewOrder, reorder, safeZoom, sizeOf, toLocalPoint, toLocalRect, visibleIds, withHidden, withSize,
  type Rect, type SettingsStore,
} from './homeLayout'

const IDS = ['a', 'b', 'c', 'd']

describe('normalizeLayout', () => {
  it.each([
    [undefined], [null], ['x'], [42], [{}], [{ order: 'oops', hidden: 3, sizes: [] }],
  ])('valeur brute %p -> disposition par defaut', (raw) => {
    expect(normalizeLayout(raw, IDS)).toEqual(defaultLayout(IDS))
  })

  it('ignore les widgets inconnus et doublons, ajoute les nouveaux en fin', () => {
    const l = normalizeLayout({ order: ['c', 'zzz', 'a', 'c'], hidden: { zzz: true, b: true }, sizes: { a: 2, c: 9, zzz: 1 } }, IDS)
    expect(l.order).toEqual(['c', 'a', 'b', 'd'])
    expect(l.hidden).toEqual({ b: true })
    expect(l.sizes).toEqual({ a: 2 })
  })
})

describe('reorder', () => {
  it.each([
    [0, 2, ['b', 'c', 'a', 'd']],
    [3, 0, ['d', 'a', 'b', 'c']],
    [1, 1, IDS],
    [1, 99, ['a', 'c', 'd', 'b']],
    [1, -5, ['b', 'a', 'c', 'd']],
    [-1, 2, IDS],
    [9, 2, IDS],
  ])('de %i vers %i', (from, to, want) => {
    expect(reorder(IDS, from, to)).toEqual(want)
  })
  it('ne modifie pas le tableau d\'origine', () => {
    const src = [...IDS]
    reorder(src, 0, 3)
    expect(src).toEqual(IDS)
  })
})

describe('masquer et redimensionner', () => {
  it('immuable, taille par defaut = l', () => {
    const l = defaultLayout(IDS)
    const l2 = withHidden(withSize(l, 'b', 1), 'c', true)
    expect(l).toEqual(defaultLayout(IDS))
    expect(sizeOf(l2, 'b')).toBe(1)
    expect(sizeOf(l2, 'a')).toBe(3)
    expect(visibleIds(l2)).toEqual(['a', 'b', 'd'])
    expect(hiddenIds(l2)).toEqual(['c'])
    expect(hiddenIds(withHidden(l2, 'c', false))).toEqual([])
  })
})

// grille 2 colonnes x 2 lignes, cases de 100 x 50 avec gouttiere de 10
const GRID: Rect[] = [
  { left: 0, top: 0, width: 100, height: 50 }, { left: 110, top: 0, width: 100, height: 50 },
  { left: 0, top: 60, width: 100, height: 50 }, { left: 110, top: 60, width: 100, height: 50 },
]

describe('indexAtPoint (position souris -> case)', () => {
  it.each([
    [{ x: 10, y: 10 }, 0], [{ x: 150, y: 20 }, 1], [{ x: 50, y: 100 }, 2], [{ x: 200, y: 105 }, 3],
    [{ x: 105, y: 25 }, 0],       // gouttiere verticale : a egalite, la premiere
    [{ x: 40, y: 54 }, 0],        // gouttiere horizontale, plus proche de la ligne du haut
    [{ x: 40, y: 58 }, 2],
    [{ x: -500, y: -500 }, 0], [{ x: 9999, y: 9999 }, 3],  // hors grille
  ])('%p -> %i', (p, want) => {
    expect(indexAtPoint(p, GRID)).toBe(want)
  })
  it('liste vide', () => expect(indexAtPoint({ x: 1, y: 1 }, [])).toBe(-1))
})

describe('compensation du zoom du root (mode tele)', () => {
  it.each([1, 1.1, 1.35, 1.8, 2.4])('meme case visee a zoom %f', (z) => {
    // rendu visuel = local * zoom, pour la souris comme pour les cases
    const visual = GRID.map((r) => ({ left: r.left * z, top: r.top * z, width: r.width * z, height: r.height * z }))
    for (const [p, want] of [[{ x: 150, y: 20 }, 1], [{ x: 50, y: 100 }, 2], [{ x: 200, y: 105 }, 3]] as const) {
      expect(indexAtVisualPoint({ x: p.x * z, y: p.y * z }, visual, z)).toBe(want)
    }
  })

  it('regression : melanger souris visuelle et cases locales vise la mauvaise case', () => {
    const z = 2
    // une colonne de 4 cases hautes de 100 : la souris sur la case 1 (y local 170)
    const col: Rect[] = [0, 1, 2, 3].map((i) => ({ left: 0, top: i * 100, width: 300, height: 100 }))
    const p = { x: 50 * z, y: 170 * z }
    expect(indexAtPoint(p, col)).toBe(3)                    // le bug : pas de conversion
    expect(indexAtPoint(toLocalPoint(p, z), col)).toBe(1)   // corrige
  })

  it('conversions et zoom invalide', () => {
    expect(toLocalRect({ left: 20, top: 40, width: 60, height: 80 }, 2)).toEqual({ left: 10, top: 20, width: 30, height: 40 })
    expect(safeZoom('1.35')).toBe(1.35)
    expect(safeZoom('normal')).toBe(1)
    expect(safeZoom(0)).toBe(1)
    expect(safeZoom(undefined)).toBe(1)
  })
})

describe('mergeVisibleOrder', () => {
  it('les masques gardent leur place', () => {
    const l = withHidden(defaultLayout(IDS), 'b', true)
    expect(mergeVisibleOrder(l, ['d', 'c', 'a']).order).toEqual(['d', 'b', 'c', 'a'])
    expect(mergeVisibleOrder(l, ['a', 'c', 'd']).order).toEqual(IDS)
  })
})

describe('previewOrder', () => {
  it('apercu pendant le glisser, ordre initial hors cible', () => {
    expect(previewOrder(IDS, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(previewOrder(IDS, 0, -1)).toEqual(IDS)
  })
})

describe('stockage dans les reglages', () => {
  const mem = (): SettingsStore & { data: Record<string, unknown> } => {
    const s = { data: { theme: 'sky' } as Record<string, unknown>,
      read: () => s.data, write: (patch: Record<string, unknown>) => { s.data = { ...s.data, ...patch } } }
    return s
  }
  it('aller-retour sans toucher aux autres reglages', () => {
    const st = mem()
    const l = withSize(withHidden(defaultLayout(IDS), 'a', true), 'b', 2)
    persistLayout(st, l)
    expect(st.data.theme).toBe('sky')
    expect(loadLayout(st, IDS)).toEqual(l)
  })
  it('lecture qui leve -> defaut', () => {
    const bad: SettingsStore = { read: () => { throw new Error('x') }, write: () => {} }
    expect(loadLayout(bad, IDS)).toEqual(defaultLayout(IDS))
  })
})
