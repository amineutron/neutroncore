import { afterEach, describe, expect, it, vi } from 'vitest'
import { DAYS_CHOICES, filterHistory, fmtCourt, fmtSeconds, showShareBar, profileLabel, readChoice, saveChoice, stepShares, type DvHistoryItem } from './dv'

const h = (key: string, outcome: 'converted' | 'failed'): DvHistoryItem =>
  ({ key, title: key, profile: 7, mode: 'dv', outcome, started: '', ended: '', seconds: 1, steps: [] })

describe('fmtSeconds', () => {
  it.each([[null, '-'], [0, '0 s'], [42, '42 s'], [723, '12 min 03 s'], [3900, '1 h 05 min']])('%s -> %s', (s, out) => {
    expect(fmtSeconds(s as number | null)).toBe(out)
  })
})

describe('filterHistory', () => {
  const items = [h('a', 'converted'), h('b', 'failed'), h('c', 'converted')]
  it('filtre par résultat', () => {
    expect(filterHistory(items, 'tout')).toHaveLength(3)
    expect(filterHistory(items, 'convertis').map((i) => i.key)).toEqual(['a', 'c'])
    expect(filterHistory(items, 'échecs').map((i) => i.key)).toEqual(['b'])
  })
})

describe('stepShares', () => {
  it('répartit la durée et ignore les étapes sans durée', () => {
    const s = stepShares([{ n: 1, seconds: 600 }, { n: 2, seconds: 200 }, { n: 3, seconds: null }])
    expect(s.map((x) => [x.n, Math.round(x.pct)])).toEqual([[1, 75], [2, 25]])
  })
  it('rien à répartir', () => { expect(stepShares([{ n: 1, seconds: null }])).toEqual([]) })
})

describe('profileLabel', () => {
  it.each([[7, 'P7 vers P8'], [5, 'P5 vers HDR10'], [null, 'DV']])('%s', (p, out) => expect(profileLabel(p as number | null)).toBe(out))
})

describe('préférences mémorisées', () => {
  afterEach(() => vi.unstubAllGlobals())
  const fake = (store: Record<string, string>) => ({
    getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v },
  })
  it('relit une valeur valide, ignore une valeur inconnue', () => {
    vi.stubGlobal('localStorage', fake({ k: '90', j: 'zzz' }))
    expect(readChoice('k', DAYS_CHOICES, 30)).toBe(90)
    expect(readChoice('j', DAYS_CHOICES, 30)).toBe(30)
    expect(readChoice('absent', DAYS_CHOICES, 30)).toBe(30)
  })
  it('stockage qui lève : défaut, pas d\'exception', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqué') }, setItem: () => { throw new Error('bloqué') } })
    expect(readChoice('k', DAYS_CHOICES, 30)).toBe(30)
    expect(() => saveChoice('k', 7)).not.toThrow()
  })
  it('écrit puis relit', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', fake(store))
    saveChoice('k', 7)
    expect(readChoice('k', DAYS_CHOICES, 30)).toBe(7)
  })
})

describe('fmtCourt', () => {
  it.each([[null, '-'], [42, '42 s'], [2068, '34m28'], [723, '12m03'], [3900, '1h05']])('%s -> %s', (s, out) => {
    expect(fmtCourt(s as number | null)).toBe(out)
  })
})

describe('showShareBar', () => {
  it('pas de barre de répartition pour un échec', () => {
    expect(showShareBar('converted')).toBe(true)
    expect(showShareBar('failed')).toBe(false)
  })
})
