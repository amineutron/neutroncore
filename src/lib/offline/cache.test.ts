import { describe, expect, it } from 'vitest'
import { createReadCache, DAY, isCacheable, PREFIX } from './cache'
import { fakeStorage } from './fakeStorage'
import { formatAge, offlineLabel } from './format'

describe('isCacheable', () => {
  it.each([
    ['/tracking/sessions', true],
    ['/qbit/torrents?filter=all', true],
    ['/auth/token?action=x', false],
    ['/health', false],
    ['/launcher/sessions/events', false],
    ['/camera/apercu', false],
    ['/camera/flux?token=1', false],
    ['/system/qbt-password', false],
    ['http://evil/x', false],
  ])('%s -> %s', (p, ok) => expect(isCacheable(p)).toBe(ok))
})

describe('createReadCache', () => {
  it('rend la donnee avec son age', () => {
    let t = 1_000
    const c = createReadCache({ storage: fakeStorage(), now: () => t })
    c.put('/a', { v: 1 })
    t += 90_000
    expect(c.get('/a')).toEqual({ data: { v: 1 }, savedAt: 1_000, ageMs: 90_000 })
  })

  it('expire apres le ttl et purge l\'entree', () => {
    let t = 0
    const st = fakeStorage()
    const c = createReadCache({ storage: st, now: () => t, ttlMs: 1000 })
    c.put('/a', 1)
    t = 1001
    expect(c.get('/a')).toBeNull()
    expect(st.map.size).toBe(0)
  })

  it('horloge revenue en arriere : entree ecartee (age negatif = donnee douteuse)', () => {
    let t = 10 * DAY
    const c = createReadCache({ storage: fakeStorage(), now: () => t })
    c.put('/a', 1)
    t = 5 * DAY
    expect(c.get('/a')).toBeNull()
  })

  it('refuse les chemins sensibles et les entrees trop grosses', () => {
    const c = createReadCache({ storage: fakeStorage(), now: () => 0, maxEntryChars: 50 })
    expect(c.put('/auth/token', 1)).toBe(false)
    expect(c.put('/big', 'x'.repeat(100))).toBe(false)
    expect(c.size()).toBe(0)
  })

  it('evince les plus anciennes au-dela de maxEntries', () => {
    let t = 0
    const c = createReadCache({ storage: fakeStorage(), now: () => t, maxEntries: 3 })
    for (const p of ['/1', '/2', '/3', '/4']) { t += 1; c.put(p, p) }
    expect(c.size()).toBe(3)
    expect(c.get('/1')).toBeNull()
    expect(c.get('/4')).not.toBeNull()
  })

  it('quota depasse : libere les plus anciennes et retente', () => {
    let t = 0
    const st = fakeStorage(400)
    const c = createReadCache({ storage: st, now: () => t, maxTotalChars: 10_000 })
    for (const p of ['/1', '/2', '/3']) { t += 1; c.put(p, 'x'.repeat(40)) }
    t += 1
    expect(c.put('/nouveau', 'y'.repeat(80))).toBe(true)
    expect(c.get('/nouveau')).not.toBeNull()
  })

  it('ignore les cles etrangeres et entrees corrompues', () => {
    const st = fakeStorage()
    st.setItem('autre', 'x')
    st.setItem(PREFIX + '/bad', 'pas-un-format')
    const c = createReadCache({ storage: st, now: () => 0 })
    expect(c.get('/bad')).toBeNull()
    c.put('/a', 1)
    c.clear()
    expect(st.getItem('autre')).toBe('x')
    expect(c.size()).toBe(0)
  })
})

describe('format', () => {
  it.each([
    [10_000, 'moins d’une minute'],
    [59_000, 'moins d’une minute'],
    [61_000, '2 min'],
    [12 * 60_000, '12 min'],
    [3 * 3_600_000, '3 h'],
    [5 * DAY, '5 j'],
  ])('%i ms -> %s', (ms, txt) => expect(formatAge(ms)).toBe(txt))

  it('libelle du bandeau', () => {
    expect(offlineLabel(0, 12 * 60_000)).toBe('hors ligne — données d’il y a 12 min')
    expect(offlineLabel(null, 0)).toMatch(/aucune donnée/)
  })
})
