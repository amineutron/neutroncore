import { describe, expect, it } from 'vitest'
import { anciennete, part, taille } from './disque'

describe('disque', () => {
  it('tailles lisibles', () => {
    expect(taille(0)).toBe('0 o')
    expect(taille(1536)).toBe('1,5 Ko')
    expect(taille(52 * 1024 ** 3)).toBe('52,0 Go')
    expect(taille(250 * 1024 ** 3)).toBe('250 Go')
    expect(taille(1.2 * 1024 ** 4)).toBe('1,2 To')
  })

  it('ancienneté du dernier accès', () => {
    expect(anciennete(0)).toBe('aujourd’hui')
    expect(anciennete(1)).toBe('il y a 1 jour')
    expect(anciennete(12)).toBe('il y a 12 jours')
    expect(anciennete(120)).toBe('il y a 4 mois')
    expect(anciennete(800)).toBe('il y a 2 ans')
  })

  it('part du disque', () => {
    expect(part(25, 100)).toBe(25)
    expect(part(1, 3)).toBe(33.3)
    expect(part(5, 0)).toBe(0)
    expect(part(200, 100)).toBe(100)
  })
})
