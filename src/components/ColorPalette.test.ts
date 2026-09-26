import { describe, expect, it } from 'vitest'
import { normalizeHex, SWATCHES } from './ColorPalette'

describe('normalizeHex', () => {
  it.each([
    ['#AABBCC', '#aabbcc'], ['aabbcc', '#aabbcc'], ['#abc', '#aabbcc'], [' #f6c177 ', '#f6c177'],
  ])('%s -> %s', (input, out) => expect(normalizeHex(input)).toBe(out))

  it.each(['', '#ab', '#abcd', '#gggggg', 'rouge', '#aabbccdd'])('refuse %s', (input) => {
    expect(normalizeHex(input)).toBeNull()
  })
})

describe('nuancier', () => {
  it('chaque teinte a un code hexa valide et unique', () => {
    expect(SWATCHES.length).toBeGreaterThanOrEqual(30)
    SWATCHES.forEach((s) => expect(normalizeHex(s.hex)).toBe(s.hex))
    expect(new Set(SWATCHES.map((s) => s.hex)).size).toBe(SWATCHES.length)
  })
})
