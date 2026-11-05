import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LampesReelles } from './LampesReelles'
import { LIAISON_ARRETEE, type EtatLiaison } from '../../lib/djLiaison'

const rendu = (e: Partial<EtatLiaison>, avance = 60) => renderToStaticMarkup(<LampesReelles etat={{ ...LIAISON_ARRETEE, ...e }} avanceMs={avance} onDemarrer={() => {}} onArreter={() => {}} />)

describe('bouton des vraies lampes', () => {
  it('à l’arrêt : le bouton pour lancer, et la précision que rien n’est touché', () => {
    const h = rendu({})
    expect(h).toContain('lancer sur les vraies lampes')
    expect(h).toContain('tes lampes ne sont pas touchées')
  })
  it('pendant la mise en route : le message d’avancement et de quoi annuler', () => {
    const h = rendu({ phase: 'demarrage', message: 'mise en route de huebeat…' })
    expect(h).toContain('mise en route de huebeat…')
    expect(h).toContain('annuler')
    expect(h).not.toContain('lancer sur les vraies lampes')
  })
  it('en direct : nombre de canaux, avance, consigne de garder l’écran, et l’arrêt', () => {
    const h = rendu({ phase: 'actif', canaux: [{ id: 0, pos: [0, 0, 0] }, { id: 1, pos: [1, 1, 1] }] }, 90)
    expect(h).toContain('lampes en direct')
    expect(h).toContain('2 canaux')
    expect(h).toContain('avance 90 ms')
    expect(h).toContain('garde cet écran ouvert')
    expect(h).toContain('arrêter et rendre les lampes')
  })
  it('en direct, un problème de huebeat est dit à côté', () => {
    expect(rendu({ phase: 'actif', message: 'huebeat n’écoute pas le flux de DJ Light' })).toContain('huebeat n’écoute pas')
  })
  it('en erreur : la raison, réessayer et arrêter', () => {
    const h = rendu({ phase: 'erreur', message: 'le pont refuse' })
    expect(h).toContain('lampes : le pont refuse')
    expect(h).toContain('réessayer')
    expect(h).toContain('arrêter')
  })
})
