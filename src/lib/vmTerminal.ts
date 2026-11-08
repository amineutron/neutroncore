// Terminal xterm.js pour la console serie : charge a la demande (bloc a part), theme aux couleurs du design system
// (tokens lus sur :root), police JetBrains Mono auto-hebergee ('JBM', declaree dans styles.css).
import '@xterm/xterm/css/xterm.css'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal, type ITheme } from '@xterm/xterm'

export type Term = { term: Terminal; fit: () => void; dispose: () => void }

/** Theme depuis les variables CSS du theme courant ; un token absent laisse la valeur par defaut d'xterm. */
export function themeFromTokens(style: { getPropertyValue(name: string): string }): ITheme {
  const tok = (name: string) => style.getPropertyValue(name).trim() || undefined
  return {
    background: tok('--ink'), foreground: tok('--text'), cursor: tok('--gold'), cursorAccent: tok('--ink'),
    selectionBackground: tok('--gold-soft'), black: tok('--ink'), red: tok('--crit'), green: tok('--ok'), yellow: tok('--warn'),
    magenta: tok('--rose'), white: tok('--text'), brightBlack: tok('--faint'), brightRed: tok('--crit'), brightGreen: tok('--ok'),
    brightYellow: tok('--gold'), brightMagenta: tok('--rose'), brightWhite: tok('--text'),
  }
}

export function createTerminal(container: HTMLElement): Term {
  const term = new Terminal({
    theme: themeFromTokens(getComputedStyle(document.documentElement)),
    fontFamily: "'JBM', ui-monospace, monospace", fontSize: 13, lineHeight: 1.2, cursorBlink: true, scrollback: 2000, convertEol: false,
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(container)
  const doFit = () => { try { fit.fit() } catch { /* conteneur pas encore mesurable */ } }
  doFit()
  return { term, fit: doFit, dispose: () => { fit.dispose(); term.dispose() } }
}
