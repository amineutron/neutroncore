// Ecran d'une machine par noVNC : WebSocket binaire ouvert ICI (pour lire le code de fermeture du pont, que noVNC
// ne remonte pas) puis confie a RFB. Jeton court demande juste avant l'ouverture, jamais la cle API dans l'adresse.
import { viewToken } from './vmHubApi'
import { closeReason, wsUrl } from './vmView'
import { throwIfAborted, type ScreenSource } from './vmViewSources'

const detail = <T>(e: Event): T => (e as CustomEvent<T>).detail
export const VNC_AUTH_UNSUPPORTED = 'mot de passe VNC requis (non pris en charge) : la console QEMU locale n\'en demande pas'

export const vncSource: ScreenSource = async (target, vm, h, signal) => {
  const { default: RFB } = await import('@novnc/novnc')
  throwIfAborted(signal)
  const token = await viewToken(vm)
  throwIfAborted(signal)   // apres chaque attente : si on a quitte entre-temps, aucun flux n'est ouvert
  const ws = new WebSocket(wsUrl(window.location.origin, vm, 'vnc', token), ['binary'])
  let code: number | null = null
  let opened = false   // un jeton refuse ferme avant accept() : le navigateur ne voit qu'une poignee de main echouee (1006)
  let byUs = false     // fermeture demandee ici : « déconnecté », pas le texte du code 1000
  ws.addEventListener('open', () => { opened = true })
  ws.addEventListener('close', (e) => { code = e.code })   // enregistres AVANT que RFB pose ses onopen/onclose : lus en premier
  const rfb = new RFB(target, ws, { wsProtocols: ['binary'] })
  rfb.scaleViewport = true
  rfb.focusOnClick = true
  rfb.background = getComputedStyle(target).getPropertyValue('--ink').trim() || '#000'
  rfb.addEventListener('connect', () => h.onConnect())
  rfb.addEventListener('disconnect', (e) => {
    const clean = detail<{ clean: boolean }>(e).clean
    h.onDisconnect(byUs ? 'déconnecté' : closeReason(code, clean, opened), byUs || clean)
  })
  rfb.addEventListener('securityfailure', (e) => h.onSecurityFailure(detail<{ status: number; reason?: string }>(e).reason ?? 'échec de sécurité'))
  rfb.addEventListener('credentialsrequired', () => { h.onSecurityFailure(VNC_AUTH_UNSUPPORTED); byUs = true; rfb.disconnect() })
  rfb.addEventListener('desktopname', (e) => h.onName(detail<{ name: string }>(e).name))
  return {
    disconnect: () => { byUs = true; rfb.disconnect() },
    sendCtrlAltDel: () => rfb.sendCtrlAltDel(),
    paste: (text) => rfb.clipboardPasteFrom(text),
    key: (keysym, code, down) => rfb.sendKey(keysym, code, down),
    setScale: (on) => { rfb.scaleViewport = on },
  }
}
