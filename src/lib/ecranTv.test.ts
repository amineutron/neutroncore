import { describe, expect, it } from 'vitest'
import { modeEcran, texteMode } from './ecranTv'

describe('modeEcran : ce que fait la télé en ce moment', () => {
  it('panneau allumé : mode écran', () => {
    expect(modeEcran({ power: 'On', screen: 'on' })).toBe('ecran')
  })
  it('panneau éteint, télé allumée : sound only', () => {
    expect(modeEcran({ power: 'On', screen: 'off' })).toBe('son')
  })
  it('la casse de l’API n’y change rien', () => {
    expect(modeEcran({ power: 'On', screen: 'Off' })).toBe('son')
    expect(modeEcran({ power: 'On', screen: 'ON' })).toBe('ecran')
  })
  it('télé en veille ou injoignable : pas de mode à afficher', () => {
    expect(modeEcran({ power: 'Standby', screen: 'off' })).toBe('indisponible')
    expect(modeEcran({ power: 'unreachable', screen: 'unknown' })).toBe('indisponible')
  })
  it('télé allumée, état du panneau inconnu : inconnu (on ne devine pas)', () => {
    expect(modeEcran({ power: 'On', screen: 'unknown' })).toBe('inconnu')
    expect(modeEcran({ power: 'On' })).toBe('inconnu')
    expect(modeEcran(undefined)).toBe('indisponible')
  })
})

describe('texteMode', () => {
  it('dit en clair ce qui se passe', () => {
    expect(texteMode('ecran')).toMatch(/image/i)
    expect(texteMode('son')).toMatch(/son/i)
    expect(texteMode('indisponible')).toMatch(/veille|injoignable/i)
  })
})
