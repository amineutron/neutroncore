import { describe, expect, it } from 'vitest'
import { ELEMENTS_DEFAUT, lireElements } from './elements'

describe('lireElements', () => {
  it('sans réglage : défauts (nuit, regroupement, texture actifs ; satellite coupé)', () => {
    expect(lireElements(null)).toEqual(ELEMENTS_DEFAUT)
    expect(lireElements('illisible')).toEqual(ELEMENTS_DEFAUT)
  })
  it('un ancien enregistrement sans les nouvelles clés garde les défauts', () => {
    const e = lireElements('{"halos":false}')
    expect(e.halos).toBe(false)
    expect(e.nuit && e.regroupement && e.texture).toBe(true)
    expect(e.satellite).toBe(false)
  })
  it('relit les nouvelles options', () => {
    const e = lireElements('{"satellite":true,"nuit":false}')
    expect(e.satellite).toBe(true)
    expect(e.nuit).toBe(false)
  })
})
