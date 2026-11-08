// Console serie d'une machine : WebSocket binaire (octets du terminal dans les deux sens) ; seul le message
// `{"resize":[cols,rows]}` part en texte. Jeton court dans l'adresse, demande juste avant l'ouverture.
import { viewToken } from './vmHubApi'
import { closeReason, resizeMessage, wsUrl } from './vmView'
import { throwIfAborted, type SerialSource } from './vmViewSources'

export const wsSerialSource: SerialSource = async (vm, h, signal) => {
  const token = await viewToken(vm)
  throwIfAborted(signal)   // on a quitte pendant la demande du jeton : rien n'est ouvert
  const ws = new WebSocket(wsUrl(window.location.origin, vm, 'serial', token))
  ws.binaryType = 'arraybuffer'
  const enc = new TextEncoder()
  let opened = false
  let byUs = false
  ws.addEventListener('open', () => { opened = true; h.onOpen() })
  ws.addEventListener('message', (e) => {
    if (e.data instanceof ArrayBuffer) h.onData(new Uint8Array(e.data))
    else if (typeof e.data === 'string') h.onData(enc.encode(e.data))   // un pont qui parlerait en texte reste lisible
  })
  ws.addEventListener('close', (e) => h.onClose(byUs ? 'déconnecté' : closeReason(e.code, e.wasClean, opened), byUs || (e.wasClean && opened)))
  const ready = () => ws.readyState === WebSocket.OPEN
  return {
    send: (data) => { if (ready()) ws.send(typeof data === 'string' ? enc.encode(data) : data) },
    resize: (cols, rows) => { if (ready()) ws.send(resizeMessage(cols, rows)) },
    close: () => { if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) { byUs = true; ws.close(1000, 'fermeture') } },
  }
}
