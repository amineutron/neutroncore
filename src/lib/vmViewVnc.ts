// Ecran d'une machine par noVNC : WebSocket binaire ouvert ICI (pour lire le code de fermeture du pont, que noVNC
// ne remonte pas) puis confie a RFB. Jeton court demande juste avant l'ouverture, jamais la cle API dans l'adresse.
import { viewToken } from './vmHubApi'
import { closeReason, wsUrl } from './vmView'
import type { ScreenSource } from './vmViewSources'

const detail = <T>(e: Event): T => (e as CustomEvent<T>).detail

export const vncSource: ScreenSource = async (target, vm, h) => {
  const { default: RFB } = await import('@novnc/novnc')
  const token = await viewToken(vm)
  const ws = new WebSocket(wsUrl(window.location.origin, vm, 'vnc', token), ['binary'])
  let code: number | null = null
  let opened = false   // un jeton refuse ferme avant accept() : le navigateur ne voit qu'une poignee de main echouee (1006)
  ws.addEventListener('open', () => { opened = true })
  ws.addEventListener('close', (e) => { code = e.code })   // enregistres AVANT que RFB pose ses onopen/onclose : lus en premier
  const rfb = new RFB(target, ws, { wsProtocols: ['binary'] })
  rfb.scaleViewport = true
  rfb.focusOnClick = true
  rfb.background = getComputedStyle(target).getPropertyValue('--ink').trim() || '#000'
  rfb.addEventListener('connect', () => h.onConnect())
  rfb.addEventListener('disconnect', (e) => { const clean = detail<{ clean: boolean }>(e).clean; h.onDisconnect(closeReason(code, clean, opened), clean) })
  rfb.addEventListener('securityfailure', (e) => h.onSecurityFailure(detail<{ status: number; reason?: string }>(e).reason ?? 'échec de sécurité'))
  rfb.addEventListener('desktopname', (e) => h.onName(detail<{ name: string }>(e).name))
  return {
    disconnect: () => rfb.disconnect(),
    sendCtrlAltDel: () => rfb.sendCtrlAltDel(),
    paste: (text) => rfb.clipboardPasteFrom(text),
    focus: () => rfb.focus({ preventScroll: true }),
    setScale: (on) => { rfb.scaleViewport = on },
  }
}
