import { describe, expect, it } from 'vitest'
import { MODIFIER_KEYSYM, SPECIAL_KEYSYM, charKeysym, keydownToPresses, textKeysyms } from './vmKeys'

describe('keysyms du clavier virtuel (memes valeurs que noVNC)', () => {
  it('latin-1 tel quel, au-dela : repli X11 0x01000000 | u', () => {
    expect(charKeysym('a'.codePointAt(0)!)).toBe(0x61)
    expect(charKeysym('é'.codePointAt(0)!)).toBe(0xe9)
    expect(charKeysym('€'.codePointAt(0)!)).toBe(0x01000000 | 0x20ac)
    expect(charKeysym('😀'.codePointAt(0)!)).toBe(0x01000000 | 0x1f600)
  })
  it('un texte devient une suite de keysyms ; saut de ligne = Entree, tabulation = Tab', () => {
    expect(textKeysyms('ab\n')).toEqual([0x61, 0x62, SPECIAL_KEYSYM.Enter])
    expect(textKeysyms('x\r\ny\ty')).toEqual([0x78, SPECIAL_KEYSYM.Enter, 0x79, SPECIAL_KEYSYM.Tab, 0x79])
    expect(textKeysyms('')).toEqual([])
  })
  it('touches speciales : Entree, Retour arriere, Tab, Echap, fleches, suppression', () => {
    expect(keydownToPresses({ key: 'Enter', code: 'Enter' })).toEqual([{ keysym: 0xff0d, code: 'Enter' }])
    expect(keydownToPresses({ key: 'Backspace', code: 'Backspace' })).toEqual([{ keysym: 0xff08, code: 'Backspace' }])
    expect(keydownToPresses({ key: 'Tab', code: 'Tab' })![0].keysym).toBe(0xff09)
    expect(keydownToPresses({ key: 'Escape', code: 'Escape' })![0].keysym).toBe(0xff1b)
    expect(keydownToPresses({ key: 'ArrowLeft', code: 'ArrowLeft' })![0].keysym).toBe(0xff51)
    expect(keydownToPresses({ key: 'ArrowDown', code: 'ArrowDown' })![0].keysym).toBe(0xff54)
    expect(keydownToPresses({ key: 'Delete', code: 'Delete' })![0].keysym).toBe(0xffff)
  })
  it('un caractere simple ne passe pas par keydown (il arrive par input), une composition non plus', () => {
    expect(keydownToPresses({ key: 'a', code: 'KeyA' })).toBeNull()
    expect(keydownToPresses({ key: 'Shift', code: 'ShiftLeft' })).toBeNull()
    expect(keydownToPresses({ key: 'Enter', code: 'Enter', isComposing: true })).toBeNull()
  })
  it('raccourci Ctrl+C : modificateur puis caractere ; Ctrl+Entree aussi', () => {
    expect(keydownToPresses({ key: 'c', code: 'KeyC', ctrlKey: true })).toEqual([{ keysym: MODIFIER_KEYSYM.ctrl, code: 'ControlLeft' }, { keysym: 0x63, code: 'KeyC' }])
    expect(keydownToPresses({ key: 'Enter', code: 'Enter', altKey: true })).toEqual([{ keysym: MODIFIER_KEYSYM.alt, code: 'AltLeft' }, { keysym: 0xff0d, code: 'Enter' }])
  })
})
