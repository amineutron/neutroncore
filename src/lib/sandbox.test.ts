import { describe, expect, it } from 'vitest'
import { fastest, filterHistory, fits, fmtArgs, fmtMs, initialSelection, levelTone, type HistoryEntry, type Model, type Run } from './sandbox'

const model = (name: string, need: number, def = false): Model => ({ name, size_mb: need, need_mb: need, default: def })
const run = (m: string, ms: number, valid = true, extra: Partial<Run> = {}): Run => ({ model: m, skipped: false, ms, proposal: { valid, tool: 'x.y', arguments: {}, note: '' }, ...extra })

describe('affichage', () => {
  it.each([['sur', 'ok'], ['confirmation', 'crit'], ['destructif', 'crit'], ['inconnu', 'warn'], ['injoignable', 'crit']] as const)(
    'ton de %s', (l, t) => expect(levelTone(l)).toBe(t))
  it('durees et arguments', () => {
    expect(fmtMs(undefined)).toBe('-')
    expect(fmtMs(850)).toBe('850 ms')
    expect(fmtMs(2340)).toBe('2.3 s')
    expect(fmtArgs({})).toBe('aucun')
    expect(fmtArgs({ level: 30, name: 'a' })).toBe('level=30, name="a"')
  })
})

describe('comparaison', () => {
  it('le plus rapide ignore les refus, les sautes et les erreurs', () => {
    const runs = [run('a', 900), run('b', 300, false), run('c', 500, true, { error: 'x' }), { model: 'd', skipped: true }, run('e', 700)]
    expect(fastest(runs)).toBe('e')
    expect(fastest([{ model: 'd', skipped: true }])).toBeNull()
  })
  it('selection initiale', () => {
    const ms = [model('a', 1, true), model('b', 2), model('c', 3, true)]
    expect(initialSelection(ms, [])).toEqual(['a', 'c'])
    expect(initialSelection(ms, ['b', 'disparu'])).toEqual(['b'])
    expect(initialSelection(ms, ['disparu'])).toEqual(['a', 'c'])
  })
  it('tient dans la vram', () => {
    expect(fits(model('a', 5000), { used_mb: 0, total_mb: 12000, free_mb: 6000 })).toBe(true)
    expect(fits(model('a', 7000), { used_mb: 0, total_mb: 12000, free_mb: 6000 })).toBe(false)
    expect(fits(model('a', 1), null)).toBe(false)
  })
})

describe('historique', () => {
  const h = (level: HistoryEntry['level'], kind: HistoryEntry['kind'], ts: number): HistoryEntry => ({ ts, kind, text: 't', level, tool: '' })
  const items = [h('sur', 'rules', 1), h('inconnu', 'compare', 2), h('destructif', 'rules', 3)]
  it('le plus recent d abord', () => expect(filterHistory(items, { level: 'tous', kind: 'tous' }).map((e) => e.ts)).toEqual([3, 2, 1]))
  it('filtres', () => {
    expect(filterHistory(items, { level: 'a-risque', kind: 'tous' }).map((e) => e.ts)).toEqual([3, 2])
    expect(filterHistory(items, { level: 'sur', kind: 'rules' }).map((e) => e.ts)).toEqual([1])
    expect(filterHistory(items, { level: 'tous', kind: 'compare' }).map((e) => e.ts)).toEqual([2])
  })
})
