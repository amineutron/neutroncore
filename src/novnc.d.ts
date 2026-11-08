// @novnc/novnc ne livre pas de types : surface utilisee par lib/vmViewVnc.ts (noVNC 1.7, docs/API.md du paquet).
declare module '@novnc/novnc' {
  export type RfbOptions = { shared?: boolean; credentials?: { username?: string; password?: string; target?: string }; repeaterID?: string; wsProtocols?: string[] }
  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, urlOrChannel: string | WebSocket, options?: RfbOptions)
    scaleViewport: boolean
    resizeSession: boolean
    clipViewport: boolean
    dragViewport: boolean
    focusOnClick: boolean
    showDotCursor: boolean
    background: string
    viewOnly: boolean
    qualityLevel: number
    compressionLevel: number
    disconnect(): void
    sendCtrlAltDel(): void
    sendKey(keysym: number, code: string | null, down?: boolean): void
    clipboardPasteFrom(text: string): void
    focus(options?: FocusOptions): void
    blur(): void
  }
}
