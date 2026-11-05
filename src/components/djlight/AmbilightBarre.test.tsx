import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AmbilightBarre } from './AmbilightBarre'
import { LIAISON_AMBILIGHT_ARRETEE, type EtatAmbilight } from '../../lib/djLiaisonAmbilight'

const rendu = (e: Partial<EtatAmbilight>) => renderToStaticMarkup(<AmbilightBarre etat={{ ...LIAISON_AMBILIGHT_ARRETEE, ...e }} onDemarrer={() => {}} onArreter={() => {}} />)

describe('bouton « suivi ambilight » de la barre du haut', () => {
  it('à l’arrêt : le bouton pour lancer le suivi, et la précision que la télé n’est pas touchée', () => {
    const h = rendu({})
    expect(h).toContain('suivi ambilight')
    expect(h).toContain('la télé n’est pas touchée')
  })
  it('pendant la mise en route : le message d’avancement et de quoi annuler', () => {
    const h = rendu({ phase: 'demarrage', message: 'mise en route de l’Ambilight…' })
    expect(h).toContain('mise en route de l’Ambilight…')
    expect(h).toContain('annuler')
  })
  it('en direct : la voie, la latence, l’arrêt', () => {
    const h = rendu({ phase: 'actif', voie: 'lounge', ms: 31.4 })
    expect(h).toContain('suivi ambilight en direct')
    expect(h).toContain('voie douce')
    expect(h).toContain('31 ms')
    expect(h).toContain('arrêter le suivi')
  })
  it('en erreur : la raison et de quoi réessayer', () => {
    const h = rendu({ phase: 'erreur', message: 'Ambilight éteint' })
    expect(h).toContain('Ambilight éteint')
    expect(h).toContain('réessayer')
  })
})
