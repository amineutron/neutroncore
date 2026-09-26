import { describe, expect, it } from 'vitest'
import { hexToHsv, hsvToHex, normalizeHex } from './color'

describe('normalizeHex', () => {
  it.each([
    ['#AABBCC', '#aabbcc'], ['aabbcc', '#aabbcc'], ['#abc', '#aabbcc'], [' #f6c177 ', '#f6c177'],
  ])('%s -> %s', (input, out) => expect(normalizeHex(input)).toBe(out))

  it.each(['', '#ab', '#abcd', '#gggggg', 'rouge', '#aabbccdd'])('refuse %s', (input) => {
    expect(normalizeHex(input)).toBeNull()
  })
})

describe('hsv <-> hex', () => {
  it.each([
    [{ h: 0, s: 1, v: 1 }, '#ff0000'], [{ h: 120, s: 1, v: 1 }, '#00ff00'], [{ h: 240, s: 1, v: 1 }, '#0000ff'],
    [{ h: 60, s: 1, v: 1 }, '#ffff00'], [{ h: 300, s: 1, v: 1 }, '#ff00ff'], [{ h: 0, s: 0, v: 1 }, '#ffffff'],
    [{ h: 200, s: 0.5, v: 0 }, '#000000'], [{ h: 360, s: 1, v: 1 }, '#ff0000'],
  ])('%o -> %s', (hsv, hex) => expect(hsvToHex(hsv)).toBe(hex))

  it.each(['#f6c177', '#eb6f92', '#2f8ff0', '#3ddc97', '#7d4ce0', '#808080'])('aller-retour %s', (hex) => {
    const hsv = hexToHsv(hex)
    expect(hsv).not.toBeNull()
    expect(hsvToHex(hsv!)).toBe(hex)
  })

  it('les gris ont une teinte 0 et une saturation nulle', () => {
    expect(hexToHsv('#808080')).toMatchObject({ h: 0, s: 0 })
  })

  it('code invalide -> null', () => expect(hexToHsv('nope')).toBeNull())
})
