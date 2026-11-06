import { describe, expect, it } from 'vitest'
import { isDevSession, journalLines } from './tachesJournal'

const sessions = [
  { name: '[DEV] build', logs: [{ timestamp: '2026-10-20T10:00:00', message: 'a' }] },
  { name: 'dv convert', logs: [{ timestamp: '2026-10-20T09:00:00', message: 'b' }] },
]

describe('journalLines', () => {
  it('reconnaît les sessions [DEV]', () => {
    expect(isDevSession('[DEV] x')).toBe(true)
    expect(isDevSession('dv [DEV]')).toBe(false)
  })
  it('garde tout par défaut, du plus récent au plus ancien', () => {
    expect(journalLines(sessions, false).map((l) => l.message)).toEqual(['a', 'b'])
  })
  it('masque les [DEV] sur demande, avant la limite', () => {
    expect(journalLines(sessions, true, 1).map((l) => l.message)).toEqual(['b'])
  })
})
