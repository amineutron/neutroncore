import { describe, expect, it } from 'vitest'
import { createNetwork, INITIAL, nextDelay, probeOnce, step } from './net'

describe('step : hysteresis', () => {
  it('un succes remet en ligne et efface les echecs', () => {
    expect(step({ state: 'offline', fails: 5 }, true, false)).toEqual({ state: 'online', fails: 0 })
  })
  it('un seul echec ne suffit pas', () => {
    const m = step({ state: 'online', fails: 0 }, false, true)
    expect(m).toEqual({ state: 'online', fails: 1 })
    expect(step(m, false, true)).toEqual({ state: 'offline', fails: 2 })
  })
  it('navigator.onLine=false accelere la decision, mais ne la prend jamais seul', () => {
    expect(step({ state: 'online', fails: 0 }, false, false).state).toBe('offline')
    // le navigateur dit « en ligne » et la sonde reussit : en ligne, quoi qu'il arrive avant
    expect(step({ state: 'offline', fails: 3 }, true, true).state).toBe('online')
  })
  it('etat initial inconnu reste inconnu apres un echec isole', () => {
    expect(step(INITIAL, false, true).state).toBe('unknown')
  })
})

describe('nextDelay', () => {
  it.each([[0, 30_000], [1, 2_000], [2, 4_000], [3, 8_000], [4, 16_000], [5, 30_000], [9, 30_000]])(
    '%i echecs -> %i ms', (fails, ms) => expect(nextDelay({ state: 'offline', fails })).toBe(ms))
})

describe('probeOnce', () => {
  it('vrai sur 2xx, faux sur 5xx, faux sur erreur reseau, sans jamais lever', async () => {
    expect(await probeOnce((async () => ({ ok: true })) as unknown as typeof fetch, '/health')).toBe(true)
    expect(await probeOnce((async () => ({ ok: false })) as unknown as typeof fetch, '/health')).toBe(false)
    expect(await probeOnce((async () => { throw new TypeError('x') }) as unknown as typeof fetch, '/health')).toBe(false)
  })
  it('delai depasse : faux (la requete est abandonnee)', async () => {
    const hang = ((_u: string, init: RequestInit) => new Promise((_, rej) => {
      init.signal!.addEventListener('abort', () => rej(new DOMException('a', 'AbortError')))
    })) as unknown as typeof fetch
    expect(await probeOnce(hang, '/health', 10)).toBe(false)
  })
  it('n\'envoie aucun en-tete d\'authentification et pas de cache', async () => {
    let seen: RequestInit | undefined
    await probeOnce((async (_u: string, i: RequestInit) => { seen = i; return { ok: true } }) as unknown as typeof fetch, '/health')
    expect(seen?.headers).toBeUndefined()
    expect(seen?.cache).toBe('no-store')
  })
})

function harness(results: boolean[], browserOnline = true) {
  const timers: { fn: () => void; ms: number }[] = []
  const net = createNetwork({
    probe: async () => results.shift() ?? true,
    browserOnline: () => browserOnline,
    setTimer: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t },
    clearTimer: (h) => { const i = timers.indexOf(h as never); if (i >= 0) timers.splice(i, 1) },
  })
  return { net, timers }
}

describe('createNetwork', () => {
  it('start : sonde, passe en ligne, programme la suivante a 30 s', async () => {
    const { net, timers } = harness([true])
    let changes = 0
    net.subscribe(() => changes++)
    net.start()
    await Promise.resolve(); await Promise.resolve()
    expect(net.state()).toBe('online')
    expect(changes).toBe(1)
    expect(timers.at(-1)?.ms).toBe(30_000)
  })

  it('deux echecs de sonde -> hors ligne, avec recul', async () => {
    const { net } = harness([false, false])
    await net.probeNow()
    expect(net.state()).toBe('unknown')
    await net.probeNow()
    expect(net.state()).toBe('offline')
  })

  it('reportFailure + sonde ratee = hors ligne ; sonde reussie = reste en ligne (requete isolee)', async () => {
    const a = harness([true]); a.net.reportSuccess()
    expect(await a.net.reportFailure()).toBe('online')
    const b = harness([false]); b.net.reportSuccess()
    expect(await b.net.reportFailure()).toBe('offline')
  })

  it('reportSuccess ramene en ligne sans sonde', () => {
    const { net } = harness([])
    net.reportSuccess()
    expect(net.state()).toBe('online')
  })

  it('stop annule le minuteur', async () => {
    const { net, timers } = harness([true])
    net.start(); await Promise.resolve(); await Promise.resolve()
    net.stop()
    expect(timers).toHaveLength(0)
  })
})
