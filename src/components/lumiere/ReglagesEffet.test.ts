import { describe, expect, it } from 'vitest'
import { resumeSurcharge } from './ReglagesEffet'

describe('résumé des réglages propres à un effet', () => {
  it('dit ce que l’effet règle lui-même', () => {
    expect(resumeSurcharge(undefined)).toBe('comme la scène')
    expect(resumeSurcharge({ tempo: 1 })).toBe('comme la scène')
    expect(resumeSurcharge({ palette: 'fire', tempo: 0.5, respiration: { vie: 67 } })).toBe('propres : couleurs, respiration, tempo')
  })
})
