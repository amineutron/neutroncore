import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeWs, bytesOf, stubBrowser } from './__fixtures__/fakeWs'
import { REFUSED_AT_OPEN } from './vmView'
import { AbortedError, type SerialHandlers } from './vmViewSources'

let tokenGate: Promise<string> | null = null
vi.mock('./vmHubApi', () => ({ viewToken: vi.fn(async (vm: string) => tokenGate ?? `jeton-${vm}`) }))
const { wsSerialSource } = await import('./vmViewSerial')

const handlers = () => ({ onOpen: vi.fn(), onData: vi.fn(), onClose: vi.fn() }) satisfies SerialHandlers
const enc = new TextEncoder()

beforeEach(() => { stubBrowser('https://hub.exemple'); tokenGate = null })

describe('wsSerialSource : flux binaire, resize en texte', () => {
  it('adresse wss derivee de l\'origine, binaire ; rien n\'est envoye avant l\'ouverture', async () => {
    const h = handlers()
    const s = await wsSerialSource('cirros-e2e', h)
    const ws = FakeWs.instances[0]
    expect(ws.url).toBe('wss://hub.exemple/vms-console/cirros-e2e/serial?token=jeton-cirros-e2e')
    expect(ws.binaryType).toBe('arraybuffer')
    s.resize(80, 24); s.send('x')
    expect(ws.sent).toHaveLength(0)
    ws.open()
    expect(h.onOpen).toHaveBeenCalledTimes(1)
    s.resize(80, 24)
    expect(ws.sent[0]).toBe('{"resize":[80,24]}')   // en TEXTE
    s.send('ls\r'); s.send(enc.encode('é'))
    expect(ws.sent.slice(1).map(bytesOf)).toEqual(['ls\r', 'é'])
    expect(ws.sent.slice(1).every((d) => typeof d !== 'string')).toBe(true)   // les octets du terminal en binaire
  })
  it('les messages du pont arrivent en octets (binaire, ou texte encode)', async () => {
    const h = handlers()
    await wsSerialSource('vm', h)
    const ws = FakeWs.instances[0]
    ws.open()
    ws.message(enc.encode('cirros login: ').buffer)
    ws.message('texte')
    expect(h.onData.mock.calls.map((c) => new TextDecoder().decode(c[0] as Uint8Array))).toEqual(['cirros login: ', 'texte'])
  })
  it('annule pendant le jeton : AbortedError, aucun WebSocket', async () => {
    let release!: (t: string) => void
    tokenGate = new Promise<string>((r) => { release = r })
    const ac = new AbortController()
    const p = wsSerialSource('vm', handlers(), ac.signal)
    ac.abort(); release('tard')
    await expect(p).rejects.toBeInstanceOf(AbortedError)
    expect(FakeWs.instances).toHaveLength(0)
  })
})

describe('wsSerialSource : fermetures', () => {
  it('jamais ouvert puis 1006 : « connexion impossible … jeton refusé ou expiré »', async () => {
    const h = handlers()
    await wsSerialSource('vm', h)
    FakeWs.instances[0].serverClose(1006, false)
    expect(h.onClose).toHaveBeenCalledWith(REFUSED_AT_OPEN, false)
  })
  it('4409 apres ouverture : « déjà ouverte », propre', async () => {
    const h = handlers()
    await wsSerialSource('vm', h)
    FakeWs.instances[0].open()
    FakeWs.instances[0].serverClose(4409, true)
    expect(h.onClose.mock.calls[0][0]).toMatch(/déjà ouverte/)
    expect(h.onClose.mock.calls[0][1]).toBe(true)
  })
  it('1000 venu du pont (inactivite) : texte du code ; fermeture par nous : « déconnecté »', async () => {
    const h = handlers()
    const s = await wsSerialSource('vm', h)
    FakeWs.instances[0].open()
    FakeWs.instances[0].serverClose(1000, true)
    expect(h.onClose.mock.calls[0][0]).toMatch(/inactivité/)
    const h2 = handlers()
    const s2 = await wsSerialSource('vm2', h2)
    FakeWs.instances[1].open()
    s2.close()
    expect(FakeWs.instances[1].closedBy).toEqual({ code: 1000, reason: 'fermeture' })
    expect(h2.onClose).toHaveBeenCalledWith('déconnecté', true)
    s.close()   // deja fermee : sans effet
    expect(FakeWs.instances[0].closedBy).toBeNull()
  })
  it('fermee par nous pendant la connexion (demontage) : le pont est bien ferme', async () => {
    const h = handlers()
    const s = await wsSerialSource('vm', h)
    s.close()
    expect(FakeWs.instances[0].closedBy).toEqual({ code: 1000, reason: 'fermeture' })
    expect(h.onClose).toHaveBeenCalledWith('déconnecté', true)
  })
})
