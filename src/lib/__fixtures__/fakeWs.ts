// WebSocket factice pour les tests des sources VNC / serie : enregistre l'adresse, les protocoles et les envois,
// et laisse le test jouer l'ouverture, les messages et les fermetures (avec code), comme le ferait le pont.
import { vi } from 'vitest'

export class FakeWs extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3
  static instances: FakeWs[] = []
  readyState = 0
  binaryType = 'blob'
  sent: (string | ArrayBufferLike | ArrayBufferView)[] = []
  closedBy: { code?: number; reason?: string } | null = null
  onopen: ((e: Event) => void) | null = null
  onclose: ((e: Event) => void) | null = null
  onmessage: ((e: Event) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  constructor(public url: string, public protocols?: string | string[]) { super(); FakeWs.instances.push(this) }
  send(d: string | ArrayBufferLike | ArrayBufferView) { this.sent.push(d) }
  close(code?: number, reason?: string) { this.closedBy = { code, reason }; this.serverClose(code ?? 1005, true) }
  /** le pont accepte */
  open() { this.readyState = 1; const e = new Event('open'); this.dispatchEvent(e); this.onopen?.(e) }
  /** un message du pont */
  message(data: ArrayBuffer | string) { const e = Object.assign(new Event('message'), { data }); this.dispatchEvent(e); this.onmessage?.(e) }
  /** fermeture venue du pont (ou echo de la notre), avec code et proprete */
  serverClose(code: number, wasClean = true) {
    this.readyState = 3
    const e = Object.assign(new Event('close'), { code, wasClean, reason: '' })
    this.dispatchEvent(e); this.onclose?.(e)
  }
}

/** Globaux du navigateur dont les sources ont besoin, poses pour un test en environnement node. */
export function stubBrowser(origin = 'http://hote:9876'): void {
  FakeWs.instances = []
  vi.stubGlobal('WebSocket', FakeWs)
  vi.stubGlobal('window', { location: { origin } })
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#0e0a10' }))
}

export const bytesOf = (d: string | ArrayBufferLike | ArrayBufferView): string => {
  if (typeof d === 'string') return d
  const view = ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : new Uint8Array(d)
  return new TextDecoder().decode(view)
}
