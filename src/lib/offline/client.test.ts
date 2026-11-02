import { describe, expect, it } from 'vitest'
import { createReadCache } from './cache'
import { createOfflineClient, isNetworkError } from './client'
import { fakeStorage } from './fakeStorage'
import { createNetwork } from './net'
import { createQueueStore, type QueueItem } from './queue'

class HttpErr extends Error { constructor(public status: number, m: string) { super(m) } }
const netErr = () => new TypeError('Failed to fetch')

function setup(opts: { probe?: boolean[]; enabled?: boolean } = {}) {
  let t = 1_000_000
  const probes = opts.probe ?? []
  const net = createNetwork({
    probe: async () => probes.shift() ?? false,
    browserOnline: () => true,
    setTimer: () => 0,
    clearTimer: () => {},
  })
  const storage = fakeStorage()
  const client = createOfflineClient({
    cache: createReadCache({ storage, now: () => t }),
    queueStore: createQueueStore(storage),
    net,
    now: () => t,
    enabled: opts.enabled ?? true,
  })
  const sent: QueueItem[] = []
  let status = 200
  let down = false
  client.configure({
    send: async (i) => { if (down) throw netErr(); sent.push(i); return status },
    makeError: (s, m) => new HttpErr(s, m),
  })
  return {
    client, net, storage, sent,
    advance: (ms: number) => { t += ms },
    setStatus: (s: number) => { status = s },
    setDown: (d: boolean) => { down = d },
  }
}

describe('isNetworkError', () => {
  it('distingue le transport des reponses HTTP', () => {
    expect(isNetworkError(new TypeError('x'))).toBe(true)
    expect(isNetworkError(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe(true)
    expect(isNetworkError(new HttpErr(500, 'x'))).toBe(false)
    expect(isNetworkError(null)).toBe(false)
  })
})

describe('get', () => {
  it('en ligne : rend la donnee fraiche, la garde, ne signale rien', async () => {
    const s = setup()
    expect(await s.client.get('/a', async () => ({ v: 1 }))).toEqual({ v: 1 })
    expect(s.client.getSnapshot()).toMatchObject({ net: 'online', staleSince: null })
  })

  it('reseau tombe (requete + sonde ratees) : sert le cache ET le dit avec son age', async () => {
    const s = setup({ probe: [false, false] })
    await s.client.get('/a', async () => ({ v: 1 }))
    s.advance(5 * 60_000)
    await s.net.probeNow() // 1er echec de sonde
    const out = await s.client.get('/a', async () => { throw netErr() }) // echec requete -> 2e echec -> hors ligne
    expect(out).toEqual({ v: 1 })
    const snap = s.client.getSnapshot()
    expect(snap.net).toBe('offline')
    expect(snap.staleSince).toBe(1_000_000)
  })

  it('hors ligne et sans cache : l\'erreur remonte (rien d\'invente)', async () => {
    const s = setup({ probe: [false, false] })
    await s.net.probeNow()
    await expect(s.client.get('/jamais-vu', async () => { throw netErr() })).rejects.toBeInstanceOf(TypeError)
  })

  it('reponse HTTP en erreur (500/404) : jamais remplacee par le cache, serveur joignable', async () => {
    const s = setup()
    await s.client.get('/a', async () => 1)
    await expect(s.client.get('/a', async () => { throw new HttpErr(502, 'bad') })).rejects.toBeInstanceOf(HttpErr)
    expect(s.client.getSnapshot().net).toBe('online')
    expect(s.client.getSnapshot().staleSince).toBeNull()
  })

  it('echec isole de requete mais sonde OK : pas de cache servi, erreur remontee', async () => {
    const s = setup({ probe: [true] })
    await s.client.get('/a', async () => 1)
    await expect(s.client.get('/a', async () => { throw netErr() })).rejects.toBeInstanceOf(TypeError)
    expect(s.client.getSnapshot().staleSince).toBeNull()
  })

  it('retour du reseau : plus rien de perime, la donnee fraiche remplace l\'ancienne', async () => {
    const s = setup({ probe: [false, false, true] })
    await s.client.get('/a', async () => 'v1')
    await s.net.probeNow()
    await s.client.get('/a', async () => { throw netErr() })
    expect(s.client.getSnapshot().staleSince).not.toBeNull()
    await s.net.probeNow() // sonde reussie
    expect(s.client.getSnapshot().staleSince).toBeNull()
    expect(await s.client.get('/a', async () => 'v2')).toBe('v2')
  })

  it('chemins non cacheables (jeton) : jamais servis depuis le cache', async () => {
    const s = setup({ probe: [false, false] })
    await s.client.get('/auth/token?action=x', async () => ({ token: 't' }))
    await s.net.probeNow()
    await expect(s.client.get('/auth/token?action=x', async () => { throw netErr() })).rejects.toBeInstanceOf(TypeError)
  })

  it('desactive (demo) : passe-plat', async () => {
    const s = setup({ enabled: false })
    expect(await s.client.get('/a', async () => 7)).toBe(7)
  })
})

describe('write', () => {
  async function goOffline(s: ReturnType<typeof setup>) {
    await s.net.probeNow()
    await s.net.probeNow()
    expect(s.net.state()).toBe('offline')
  }

  it('hors ligne + action eligible : mise en file, accuse clair, persistee', async () => {
    const s = setup({ probe: [false, false] })
    await goOffline(s)
    const r = await s.client.write('PUT', '/launcher/favorites', { a: 1 }, undefined, async () => { throw new Error('ne doit pas partir') })
    expect(r).toEqual({ success: true, queued: true, offline: true })
    expect(s.client.getSnapshot().pending).toBe(1)
    expect(createQueueStore(s.storage).load()).toHaveLength(1)
  })

  it('hors ligne + action directe ou destructive ou X-Confirm : refus avec phrase, rien en file ni envoye', async () => {
    const s = setup({ probe: [false, false] })
    await goOffline(s)
    const never = async () => { throw new Error('ne doit pas partir') }
    await expect(s.client.write('POST', '/tv/power', {}, undefined, never)).rejects.toThrow(/hors ligne.*direct/)
    await expect(s.client.write('DELETE', '/tracking/sessions/1', undefined, undefined, never)).rejects.toThrow(/suppression/)
    await expect(s.client.write('PUT', '/launcher/favorites', {}, { 'X-Confirm': 't' }, never)).rejects.toThrow(/confirmation/)
    expect(s.client.getSnapshot().pending).toBe(0)
  })

  it('PUT repete hors ligne : un seul element (le dernier)', async () => {
    const s = setup({ probe: [false, false] })
    await goOffline(s)
    for (const n of [1, 2, 3]) await s.client.write('PUT', '/launcher/favorites', { n }, undefined, async () => 0)
    expect(s.client.getSnapshot().pending).toBe(1)
  })

  it('retour du reseau : la file est rejouee dans l\'ordre, videe, compte rendu', async () => {
    const s = setup({ probe: [false, false, true] })
    await goOffline(s)
    await s.client.write('PUT', '/launcher/favorites', { n: 1 }, undefined, async () => 0)
    await s.client.write('POST', '/notifications/read', { ids: [1] }, undefined, async () => 0)
    await s.net.probeNow() // revient en ligne
    await s.client.flush()
    expect(s.sent.map((i) => i.path)).toEqual(['/launcher/favorites', '/notifications/read'])
    const snap = s.client.getSnapshot()
    expect(snap.pending).toBe(0)
    expect(snap.lastFlush).toMatchObject({ done: 2, rejected: 0, expired: 0 })
  })

  it('rejeu rejete par le serveur (409) : abandonne et signale, pas reessaye', async () => {
    const s = setup({ probe: [false, false, true] })
    await goOffline(s)
    await s.client.write('PUT', '/launcher/favorites', { n: 1 }, undefined, async () => 0)
    s.setStatus(409)
    await s.net.probeNow()
    await s.client.flush()
    expect(s.client.getSnapshot().pending).toBe(0)
    expect(s.client.getSnapshot().lastFlush).toMatchObject({ done: 0, rejected: 1 })
  })

  it('action trop ancienne : jamais rejouee', async () => {
    const s = setup({ probe: [false, false, true] })
    await goOffline(s)
    await s.client.write('PUT', '/launcher/favorites', { n: 1 }, undefined, async () => 0)
    s.advance(25 * 3_600_000)
    await s.net.probeNow()
    await s.client.flush()
    expect(s.sent).toHaveLength(0)
    expect(s.client.getSnapshot().lastFlush).toMatchObject({ expired: 1 })
  })

  it('requete en ligne qui echoue au transport puis sonde ratee : eligible -> file ; non eligible -> erreur honnete (resultat incertain)', async () => {
    const s = setup({ probe: [false] })
    s.net.reportSuccess()
    const r = await s.client.write('PUT', '/launcher/favorites', { a: 1 }, undefined, async () => { throw netErr() })
    expect(r).toMatchObject({ queued: true })
    const s2 = setup({ probe: [false] })
    s2.net.reportSuccess()
    await expect(s2.client.write('POST', '/tv/power', {}, undefined, async () => { throw netErr() })).rejects.toThrow(/interrompu/)
    expect(s2.client.getSnapshot().pending).toBe(0)
  })

  it('erreur HTTP (403, 500) : remontee telle quelle, jamais mise en file', async () => {
    const s = setup()
    s.net.reportSuccess()
    await expect(s.client.write('PUT', '/launcher/favorites', {}, undefined, async () => { throw new HttpErr(500, 'x') })).rejects.toBeInstanceOf(HttpErr)
    expect(s.client.getSnapshot().pending).toBe(0)
  })

  it('requireOnline refuse hors ligne seulement', async () => {
    const s = setup({ probe: [false, false] })
    expect(() => s.client.requireOnline('x')).not.toThrow()
    await goOffline(s)
    expect(() => s.client.requireOnline('cette action demande une confirmation')).toThrow(/hors ligne/)
  })

  it('changement de cle API : cache et file vides', async () => {
    const s = setup({ probe: [false, false] })
    await s.client.get('/a', async () => 1)
    await goOffline(s)
    await s.client.write('PUT', '/launcher/favorites', {}, undefined, async () => 0)
    s.client.onKeyChange()
    expect(s.client.getSnapshot().pending).toBe(0)
    expect(s.storage.map.size).toBe(0)
  })
})
