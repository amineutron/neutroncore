import { describe, expect, it } from 'vitest'
import { ELEMENTS_DEFAUT, lireElements } from './elements'

describe('bandeau tele actif par défaut', () => {
  it('défaut vrai', () => expect(ELEMENTS_DEFAUT.bandeau).toBe(true))
  it('ancien stockage sans valeur : vrai', () => {
    expect(lireElements(null).bandeau).toBe(true)
    expect(lireElements(JSON.stringify({ halos: false })).bandeau).toBe(true)
  })
  it('un bandeau décoché le reste', () => expect(lireElements(JSON.stringify({ bandeau: false })).bandeau).toBe(false))
})
