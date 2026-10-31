import { describe, expect, it } from 'vitest'
import { navigue, texteTempo } from './spatialTele'

describe('navigation à la télécommande', () => {
  it('se déplace dans la grille et reste au bord', () => {
    expect(navigue(0, 'ArrowRight', 4, 10)).toBe(1)
    expect(navigue(3, 'ArrowRight', 4, 10)).toBe(3)
    expect(navigue(9, 'ArrowRight', 4, 10)).toBe(9)
    expect(navigue(4, 'ArrowLeft', 4, 10)).toBe(4)
    expect(navigue(5, 'ArrowLeft', 4, 10)).toBe(4)
    expect(navigue(1, 'ArrowDown', 4, 10)).toBe(5)
    expect(navigue(7, 'ArrowDown', 4, 10)).toBe(7)
    expect(navigue(5, 'ArrowUp', 4, 10)).toBe(1)
    expect(navigue(2, 'ArrowUp', 4, 10)).toBe(2)
  })
  it('tolère une grille vide ou un index hors bornes', () => {
    expect(navigue(3, 'ArrowDown', 4, 0)).toBe(0)
    expect(navigue(99, 'Enter', 4, 5)).toBe(4)
    expect(navigue(0, 'ArrowRight', 0, 3)).toBe(0)
  })
  it('dit le tempo en clair', () => {
    expect(texteTempo(108.4, true)).toBe('108 par minute')
    expect(texteTempo(0, true)).toBe('tempo en recherche')
    expect(texteTempo(120, true, true)).toBe('pas de son')
    expect(texteTempo(120, false)).toBe('lampes arrêtées')
  })
})
