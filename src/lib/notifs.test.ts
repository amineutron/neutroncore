import { describe, expect, it } from 'vitest'
import { ago, dayLabel, groupByDay, worstUnread, type Notif } from './notifs'

const NOW = new Date(2026, 9, 6, 18, 0).getTime()
const at = (d: Date) => d.getTime() / 1000
const n = (id: string, when: Date, level: Notif['level'] = 'warn', read = false): Notif =>
  ({ id, at: at(when), source: 'system', level, title: id, detail: '', action: '', ref: '', count: 1, read })

describe('dayLabel', () => {
  it.each([
    [new Date(2026, 9, 6, 0, 5), "aujourd'hui"], [new Date(2026, 9, 5, 23, 59), 'hier'],
    [new Date(2026, 9, 3, 12, 0), 'samedi 3 octobre'],
  ])('%s', (d, label) => expect(dayLabel(d.getTime(), NOW)).toBe(label))
})

describe('groupByDay', () => {
  it('regroupe en gardant l’ordre', () => {
    const g = groupByDay([n('a', new Date(2026, 9, 6, 17)), n('b', new Date(2026, 9, 6, 9)), n('c', new Date(2026, 9, 5, 20))], NOW)
    expect(g.map((d) => [d.label, d.entries.map((e) => e.id)])).toEqual([["aujourd'hui", ['a', 'b']], ['hier', ['c']]])
  })
  it('liste vide', () => expect(groupByDay([], NOW)).toEqual([]))
})

describe('ago', () => {
  it.each([[10, "à l'instant"], [5 * 60, 'il y a 5 min'], [3 * 3600 + 20, 'il y a 3 h']])('%d s', (s, out) => {
    expect(ago(NOW / 1000 - s, NOW)).toBe(out)
  })
  it('une date future (horloges décalées) ne donne pas de durée négative', () => {
    expect(ago(NOW / 1000 + 30, NOW)).toBe("à l'instant")
  })
})

describe('worstUnread', () => {
  it('ignore les lues et prend le plus grave', () => {
    const d = new Date(2026, 9, 6, 12)
    expect(worstUnread([n('a', d, 'crit', true), n('b', d, 'warn'), n('c', d, 'info')])).toBe('warn')
    expect(worstUnread([n('a', d, 'crit', true)])).toBeNull()
  })
})
