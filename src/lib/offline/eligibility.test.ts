import { describe, expect, it } from 'vitest'
import { classify, cleanPath, REASON_CONFIRM, REASON_DELETE, REASON_LIVE } from './eligibility'

describe('classify : liste fermee', () => {
  it.each([
    ['PUT', '/launcher/favorites', 'queue'],
    ['PUT', '/launcher/sessions/notif-settings', 'queue'],
    ['PUT', '/branches/reglages', 'queue'],
    ['POST', '/notifications/read', 'queue'],
    ['POST', '/requests/declined-auto/12/hide', 'queue'],
    ['put', '/lyra/settings', 'queue'],
    // direct sur un appareil ou un service : refuse
    ['POST', '/tv/power', 'refuse'],
    ['POST', '/hue/scene', 'refuse'],
    ['POST', '/spatial/direct', 'refuse'],
    ['POST', '/tests/run', 'refuse'],
    ['POST', '/launcher/claude', 'refuse'],
    ['PUT', '/camera/reglages', 'refuse'],
    // mauvais verbe sur un chemin eligible
    ['POST', '/launcher/favorites', 'refuse'],
    ['PUT', '/notifications/read', 'refuse'],
    // chemins suspects
    ['PUT', '/launcher/favorites/../tv', 'refuse'],
    ['PUT', 'launcher/favorites', 'refuse'],
  ])('%s %s -> %s', (m, p, kind) => {
    expect(classify(m, p, {}).kind).toBe(kind)
  })

  it('DELETE est toujours refuse, meme sur un chemin connu', () => {
    expect(classify('DELETE', '/launcher/favorites')).toEqual({ kind: 'refuse', reason: REASON_DELETE })
  })

  it('X-Confirm refuse, quelle que soit la casse, meme sur un chemin eligible', () => {
    expect(classify('PUT', '/launcher/favorites', {}, { 'X-Confirm': 'abc' })).toEqual({ kind: 'refuse', reason: REASON_CONFIRM })
    expect(classify('PUT', '/launcher/favorites', {}, { 'x-confirm': 'abc' }).kind).toBe('refuse')
  })

  it('refus d\'action directe : phrase claire', () => {
    const v = classify('POST', '/tv/power', {})
    expect(v).toEqual({ kind: 'refuse', reason: REASON_LIVE })
    expect(REASON_LIVE).toMatch(/hors ligne/)
  })

  it('PUT : un seul element par chemin ; POST : un par corps', () => {
    const a = classify('PUT', '/launcher/favorites', { x: 1 })
    const b = classify('PUT', '/launcher/favorites', { x: 2 })
    expect(a).toEqual(b)
    const c = classify('POST', '/notifications/read', { ids: [1] })
    const d = classify('POST', '/notifications/read', { ids: [2] })
    expect(c).not.toEqual(d)
  })

  it('corps trop gros ou non serialisable : refuse', () => {
    expect(classify('PUT', '/launcher/favorites', 'x'.repeat(25_000)).kind).toBe('refuse')
    const cyc: Record<string, unknown> = {}
    cyc.self = cyc
    expect(classify('PUT', '/launcher/favorites', cyc).kind).toBe('refuse')
  })

  it('la query est ignoree pour le chemin', () => {
    expect(cleanPath('/a/b?x=1#y')).toBe('/a/b')
    expect(classify('PUT', '/launcher/favorites?x=1', {}).kind).toBe('queue')
  })
})
