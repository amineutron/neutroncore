import { describe, expect, it } from 'vitest'
import { resterEnFond } from './djFond'

describe('resterEnFond : DJ Light continue de piloter les lampes quand on change de page', () => {
  it('oui tant que les vraies lampes sont prises ou en train de l’être', () => {
    expect(resterEnFond('actif')).toBe(true)
    expect(resterEnFond('demarrage')).toBe(true)
  })
  it('non quand les lampes sont arrêtées ou en erreur : l’écran se démonte comme avant', () => {
    expect(resterEnFond('arret')).toBe(false)
    expect(resterEnFond('erreur')).toBe(false)
  })
})
