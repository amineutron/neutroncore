import { beforeEach, describe, expect, it } from 'vitest'
import { ecrirePref, estBool, estTexte, lirePref } from './prefs'

const memoire = new Map<string, string>()
beforeEach(() => {
  memoire.clear()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => memoire.get(k) ?? null,
    setItem: (k: string, v: string) => { memoire.set(k, v) },
  }
})

describe('préférences d’écran', () => {
  it('relit ce qu’on a écrit, sinon le défaut', () => {
    expect(lirePref('a', 'tous', estTexte)).toBe('tous')
    ecrirePref('a', 'actifs')
    expect(lirePref('a', 'tous', estTexte)).toBe('actifs')
  })

  it('ignore une valeur d’un autre type ou illisible', () => {
    memoire.set('b', '42')
    expect(lirePref('b', true, estBool)).toBe(true)
    memoire.set('b', '{pas du json')
    expect(lirePref('b', 'x', estTexte)).toBe('x')
  })

  it('ne casse pas quand le stockage est absent ou refuse', () => {
    ;(globalThis as { localStorage?: unknown }).localStorage = { getItem: () => { throw new Error('bloque') }, setItem: () => { throw new Error('bloque') } }
    expect(lirePref('a', 'defaut', estTexte)).toBe('defaut')
    expect(() => ecrirePref('a', 1)).not.toThrow()
  })
})
