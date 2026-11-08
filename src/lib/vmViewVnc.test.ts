import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeWs, stubBrowser } from './__fixtures__/fakeWs'
import { REFUSED_AT_OPEN } from './vmView'
import { AbortedError, type ScreenHandlers } from './vmViewSources'

// noVNC factice : on verifie ce que la source lui donne et comment elle traduit ses evenements ; le vrai RFB a
// besoin d'un DOM et d'un vrai flux (essai reel fait a part).
class FakeRfb extends EventTarget {
  static last: FakeRfb | null = null
  scaleViewport = false; focusOnClick = false; background = ''
  keys: unknown[][] = []; disconnected = 0; cad = 0; pasted: string[] = []
  constructor(public target: unknown, public ws: FakeWs, public options: { wsProtocols?: string[] }) { super(); FakeRfb.last = this }
  disconnect() { this.disconnected++; this.ws.close(1000); this.dispatchEvent(new CustomEvent('disconnect', { detail: { clean: true } })) }
  /** le pont ferme : noVNC rend `clean` selon qu'il etait connecte ou non */
  serverClosed(code: number, connected: boolean) { this.ws.serverClose(code, connected); this.dispatchEvent(new CustomEvent('disconnect', { detail: { clean: connected } })) }
  sendCtrlAltDel() { this.cad++ }
  sendKey(...a: unknown[]) { this.keys.push(a) }
  clipboardPasteFrom(t: string) { this.pasted.push(t) }
}
vi.mock('@novnc/novnc', () => ({ default: FakeRfb }))
let tokenGate: Promise<string> | null = null
vi.mock('./vmHubApi', () => ({ viewToken: vi.fn(async (vm: string) => tokenGate ?? `jeton-${vm}`) }))

const { vncSource, VNC_AUTH_UNSUPPORTED } = await import('./vmViewVnc')

const handlers = () => {
  const h = { onConnect: vi.fn(), onDisconnect: vi.fn(), onSecurityFailure: vi.fn(), onName: vi.fn() } satisfies ScreenHandlers
  return h
}
const target = {} as HTMLElement

beforeEach(() => { stubBrowser(); FakeRfb.last = null; tokenGate = null })

describe('vncSource : ouverture', () => {
  it('jeton vm_view, adresse ws derivee de l\'origine, sous-protocole binary donne au WebSocket ET a RFB', async () => {
    const h = handlers()
    const s = await vncSource(target, 'tp-linux-01', h)
    const ws = FakeWs.instances[0]
    expect(ws.url).toBe('ws://hote:9876/vms-console/tp-linux-01/vnc?token=jeton-tp-linux-01')
    expect(ws.protocols).toEqual(['binary'])
    expect(FakeRfb.last!.options).toEqual({ wsProtocols: ['binary'] })
    expect(FakeRfb.last!.scaleViewport).toBe(true)
    expect(FakeRfb.last!.background).toBe('#0e0a10')
    ws.open(); FakeRfb.last!.dispatchEvent(new CustomEvent('connect', { detail: {} }))
    FakeRfb.last!.dispatchEvent(new CustomEvent('desktopname', { detail: { name: 'QEMU (tp-linux-01)' } }))
    expect(h.onConnect).toHaveBeenCalledTimes(1)
    expect(h.onName).toHaveBeenCalledWith('QEMU (tp-linux-01)')
    s.key(0xff0d, 'Enter', true); s.key(0x61, null)
    expect(FakeRfb.last!.keys).toEqual([[0xff0d, 'Enter', true], [0x61, null, undefined]])
    s.sendCtrlAltDel(); s.paste('mdp')
    expect(FakeRfb.last!.cad).toBe(1); expect(FakeRfb.last!.pasted).toEqual(['mdp'])
  })
  it('annule pendant la demande du jeton : erreur AbortedError, aucun WebSocket ouvert', async () => {
    let release!: (t: string) => void
    tokenGate = new Promise<string>((r) => { release = r })
    const ac = new AbortController()
    const p = vncSource(target, 'vm', handlers(), ac.signal)
    ac.abort()
    release('tard')
    await expect(p).rejects.toBeInstanceOf(AbortedError)
    expect(FakeWs.instances).toHaveLength(0)
    expect(FakeRfb.last).toBeNull()
  })
})

describe('vncSource : fermetures', () => {
  it('jamais ouvert (jeton refuse avant accept : 1006 brutal) = « connexion impossible … jeton refusé ou expiré »', async () => {
    const h = handlers()
    await vncSource(target, 'vm', h)
    FakeRfb.last!.serverClosed(1006, false)
    expect(h.onDisconnect).toHaveBeenCalledWith(REFUSED_AT_OPEN, false)
  })
  it('4409 apres ouverture : « déjà ouverte »', async () => {
    const h = handlers()
    await vncSource(target, 'vm', h)
    FakeWs.instances[0].open()
    FakeRfb.last!.serverClosed(4409, true)
    expect(h.onDisconnect).toHaveBeenCalledTimes(1)
    expect(h.onDisconnect.mock.calls[0][0]).toMatch(/déjà ouverte/)
  })
  it('4503 apres ouverture : machine eteinte / vnc injoignable', async () => {
    const h = handlers()
    await vncSource(target, 'vm', h)
    FakeWs.instances[0].open()
    FakeRfb.last!.serverClosed(4503, true)
    expect(h.onDisconnect.mock.calls[0][0]).toMatch(/éteinte/)
  })
  it('fermeture demandee par nous : « déconnecté », propre, meme si le code est 1000', async () => {
    const h = handlers()
    const s = await vncSource(target, 'vm', h)
    FakeWs.instances[0].open()
    s.disconnect()
    expect(FakeRfb.last!.disconnected).toBe(1)
    expect(h.onDisconnect).toHaveBeenCalledWith('déconnecté', true)
  })
  it('mot de passe demande : refus explicite et deconnexion', async () => {
    const h = handlers()
    await vncSource(target, 'vm', h)
    FakeWs.instances[0].open()
    FakeRfb.last!.dispatchEvent(new CustomEvent('credentialsrequired', { detail: { types: ['password'] } }))
    expect(h.onSecurityFailure).toHaveBeenCalledWith(VNC_AUTH_UNSUPPORTED)
    expect(FakeRfb.last!.disconnected).toBe(1)
    expect(h.onDisconnect).toHaveBeenCalledWith('déconnecté', true)
  })
  it('securityfailure : la raison du serveur est transmise', async () => {
    const h = handlers()
    await vncSource(target, 'vm', h)
    FakeRfb.last!.dispatchEvent(new CustomEvent('securityfailure', { detail: { status: 1, reason: 'Too many connections' } }))
    expect(h.onSecurityFailure).toHaveBeenCalledWith('Too many connections')
  })
})
