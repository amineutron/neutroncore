// Console serie d'une machine : WebSocket binaire (octets du terminal dans les deux sens) ; seul le message
// `{"resize":[cols,rows]}` part en texte. Jeton court dans l'adresse, demande juste avant l'ouverture.
import { viewToken } from './vmHubApi'
import { closeReason, resizeMessage, wsUrl } from './vmView'
import type { SerialSource } from './vmViewSources'

export const wsSerialSource: SerialSource = async (vm, h) => {
  const token = await viewToken(vm)
  const ws = new WebSocket(wsUrl(window.location.origin, vm, 'serial', token))
  ws.binaryType = 'arraybuffer'
  const enc = new TextEncoder()
  let opened = false
  ws.addEventListener('open', () => { opened = true; h.onOpen() })
  ws.addEventListener('message', (e) => {
    if (e.data instanceof ArrayBuffer) h.onData(new Uint8Array(e.data))
    else if (typeof e.data === 'string') h.onData(enc.encode(e.data))   // un pont qui parlerait en texte reste lisible
  })
  ws.addEventListener('close', (e) => h.onClose(closeReason(e.code, e.wasClean, opened), e.wasClean && opened))
  const ready = () => ws.readyState === WebSocket.OPEN
  return {
    send: (data) => {
      if (!ready()) return
      const bytes = typeof data === 'string' ? enc.encode(data) : data
      ws.send(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)   // copie sur un ArrayBuffer propre (type exact attendu par send)
    },
    resize: (cols, rows) => { if (ready()) ws.send(resizeMessage(cols, rows)) },
    close: () => { if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close(1000, 'fermeture') },
  }
}
