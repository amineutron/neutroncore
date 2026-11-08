// Clavier virtuel de l'ecran VNC : un champ cache recoit la saisie (le clavier Android ne monte que sur un champ),
// et chaque touche devient un keysym X11 pour `RFB.sendKey`. Logique pure, memes valeurs que noVNC
// (core/input/keysym.js et keysymdef.js, que le paquet n'exporte pas : son `exports` ne livre que rfb.js).

/** Touches speciales (KeyboardEvent.key -> keysym). */
export const SPECIAL_KEYSYM: Record<string, number> = {
  Enter: 0xff0d, Backspace: 0xff08, Tab: 0xff09, Escape: 0xff1b, Delete: 0xffff, Insert: 0xff63,
  ArrowLeft: 0xff51, ArrowUp: 0xff52, ArrowRight: 0xff53, ArrowDown: 0xff54,
  Home: 0xff50, End: 0xff57, PageUp: 0xff55, PageDown: 0xff56,
  F1: 0xffbe, F2: 0xffbf, F3: 0xffc0, F4: 0xffc1, F5: 0xffc2, F6: 0xffc3, F7: 0xffc4, F8: 0xffc5, F9: 0xffc6, F10: 0xffc7, F11: 0xffc8, F12: 0xffc9,
}
export const MODIFIER_KEYSYM = { ctrl: 0xffe3, alt: 0xffe9, meta: 0xffeb, shift: 0xffe1 } as const
const MODIFIER_CODE = { ctrl: 'ControlLeft', alt: 'AltLeft', meta: 'MetaLeft', shift: 'ShiftLeft' } as const

/** Keysym d'un point de code : Latin-1 tel quel, sinon le repli general de X11 (0x01000000 | u), comme noVNC
 *  hors de sa table de cas particuliers. */
export function charKeysym(codePoint: number): number {
  if (codePoint >= 0x20 && codePoint <= 0xff) return codePoint
  return 0x01000000 | codePoint
}

/** Un texte saisi -> keysyms dans l'ordre ; un saut de ligne devient Entree. */
export function textKeysyms(text: string): number[] {
  const out: number[] = []
  for (const ch of text.replace(/\r\n?/g, '\n')) {
    const cp = ch.codePointAt(0) ?? 0
    out.push(ch === '\n' ? SPECIAL_KEYSYM.Enter : ch === '\t' ? SPECIAL_KEYSYM.Tab : charKeysym(cp))
  }
  return out
}

export type KeyPress = { keysym: number; code: string | null }
type KeyLike = { key: string; code?: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; shiftKey?: boolean; isComposing?: boolean }

/** Ce qu'un `keydown` du champ cache envoie a la machine : touche speciale, ou raccourci (Ctrl/Alt/Meta + caractere)
 *  encadre de ses modificateurs ; les caracteres simples passent par `input` (null ici, rien a envoyer). */
export function keydownToPresses(e: KeyLike): KeyPress[] | null {
  if (e.isComposing) return null
  const special = SPECIAL_KEYSYM[e.key]
  const mods: KeyPress[] = []
  if (e.ctrlKey) mods.push({ keysym: MODIFIER_KEYSYM.ctrl, code: MODIFIER_CODE.ctrl })
  if (e.altKey) mods.push({ keysym: MODIFIER_KEYSYM.alt, code: MODIFIER_CODE.alt })
  if (e.metaKey) mods.push({ keysym: MODIFIER_KEYSYM.meta, code: MODIFIER_CODE.meta })
  if (special !== undefined) return [...mods, { keysym: special, code: e.code ?? null }]
  if (mods.length && [...e.key].length === 1) return [...mods, { keysym: charKeysym(e.key.codePointAt(0) ?? 0), code: e.code ?? null }]
  return null
}
