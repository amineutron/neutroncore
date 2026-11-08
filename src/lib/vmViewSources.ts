// Sources de l'ecran et de la console serie : la meme interface pour le vrai flux (noVNC / xterm sur WebSocket)
// et pour la demo (flux simules, aucun reseau). Les composants ne font que choisir ici ; les deux modules
// sont charges a la demande, et la branche morte sort du bundle : la condition lit import.meta.env ICI (constante de
// compilation dans ce module ; une constante importee d'un autre module n'est pas repliee par le bundler).
const DEMO = import.meta.env.VITE_MOCK_API === '1'

export type ScreenHandlers = {
  onConnect: () => void
  /** fermeture, propre ou non, avec la phrase deja traduite (codes 4401 / 4404 / 4409 / 4503 / 1009 / 1000 du pont) */
  onDisconnect: (reason: string, clean: boolean) => void
  onSecurityFailure: (reason: string) => void
  onName: (name: string) => void
}
export type ScreenSession = {
  disconnect: () => void
  sendCtrlAltDel: () => void
  paste: (text: string) => void
  /** une touche (keysym X11, code DOM) : appui puis relachement si `down` est omis */
  key: (keysym: number, code: string | null, down?: boolean) => void
  /** mise a l'echelle dans le cadre (noVNC scaleViewport) */
  setScale: (on: boolean) => void
}
/** `signal` : annulation pendant l'ouverture (on a quitte l'onglet avant le jeton ou le chargement du client) :
 *  la source n'ouvre pas le flux et leve une erreur ; rien ne reste ouvert sur un noeud detache. */
export type ScreenSource = (target: HTMLElement, vm: string, h: ScreenHandlers, signal?: AbortSignal) => Promise<ScreenSession>

export type SerialHandlers = {
  onOpen: () => void
  onData: (bytes: Uint8Array) => void
  onClose: (reason: string, clean: boolean) => void
}
export type SerialSession = {
  send: (data: string | Uint8Array<ArrayBuffer>) => void
  resize: (cols: number, rows: number) => void
  close: () => void
}
export type SerialSource = (vm: string, h: SerialHandlers, signal?: AbortSignal) => Promise<SerialSession>

export class AbortedError extends Error { constructor() { super('connexion annulée') } }
export const throwIfAborted = (signal?: AbortSignal): void => { if (signal?.aborted) throw new AbortedError() }

export async function screenSource(): Promise<ScreenSource> {
  if (DEMO) return (await import('../mock/vmViewDemo')).demoScreenSource
  return (await import('./vmViewVnc')).vncSource
}

export async function serialSource(): Promise<SerialSource> {
  if (DEMO) return (await import('../mock/vmViewDemo')).demoSerialSource
  return (await import('./vmViewSerial')).wsSerialSource
}
