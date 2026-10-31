import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { courbeGamma, courbeLineaire, type Rampe } from '../../lib/rampes'
import { Apercu } from './Apercu'
import { CourbeEditeur } from './CourbeEditeur'

const rampe: Rampe = {
  id: 'r', nom: 'r', duree_s: 600, pas_s: 5, boucle: false,
  pistes: [{ lampes: ['3', '4'], bri: courbeGamma(600, 1, 254), kelvin: courbeLineaire(600, 2200, 5000) }],
}

// Rendu réel : l'éditeur et l'aperçu doivent produire leur HTML sans planter, avec des courbes complètes et vides.
describe('éditeur de courbe et aperçu', () => {
  it('l’éditeur dessine un point par repère et la courbe', () => {
    const out = renderToStaticMarkup(<CourbeEditeur titre="luminosité" points={rampe.pistes[0].bri} duree={600} lo={0} hi={254} max={24} couleur="var(--gold)" pas={5} formatV={(v) => `${v}`} onChange={() => {}} />)
    expect((out.match(/class="ce-pt"/g) ?? []).length).toBe(9)
    expect(out).toContain('9 points sur 24')
    expect(out).toContain('choisis un point')
  })

  it('courbe vide : aucun point, pas d’erreur', () => {
    const out = renderToStaticMarkup(<CourbeEditeur titre="x" points={[]} duree={600} lo={0} hi={254} max={24} couleur="red" pas={5} formatV={String} onChange={() => {}} />)
    expect(out).toContain('0 point sur 24')
  })

  it('l’aperçu montre une pastille par lampe, nommée, éteinte au départ', () => {
    const out = renderToStaticMarkup(<Apercu rampe={rampe} noms={{ '3': 'bureau', '4': 'lit' }} lecture={null} />)
    expect(out).toContain('bureau')
    expect(out).toContain('lit')
    expect(out).toContain('aperçu')
    expect(out).toContain('0 s / 10 min')
  })

  it('en direct, la lecture du serveur prend la main et bloque l’aperçu local', () => {
    const lecture = { genre: 'reveil' as const, id: 'r', nom: 'r', t: 120, duree: 600, en_cours: true, bilan: null }
    const out = renderToStaticMarkup(<Apercu rampe={rampe} noms={{}} lecture={lecture} />)
    expect(out).toContain('en direct sur les lampes')
    expect(out).toContain('disabled')
  })
})
