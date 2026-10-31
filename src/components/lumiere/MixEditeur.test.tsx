import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Scene } from '../../lib/spatialFx'
import type { Mix } from '../../lib/spatialMix'
import { MixEditeur } from './MixEditeur'

const scene = (id: string, nom: string, mode?: '2d' | '3d'): Scene => ({ id, nom, effets: ['onde'], palette: 'neon', axe: 'x', source: { x: 50, y: 30, z: 35 }, intensite: 100, mode })
const scenes = [scene('a', 'kick', '3d'), scene('b', 'neutron', '2d'), scene('c', 'marée', '3d')]
const canaux = { '0': [0, 0, 0], '1': [0, 0, 0], '2': [0, 0, 0], '3': [0, 0, 0] }
const noms = { '0': 'Hue', '1': 'gradient lightstrip', '2': 'gradient lightstrip', '3': 'gradient lightstrip' }
const mix: Mix = { id: 'm1', nom: 'salon', couches: [{ scene: 'b', canaux: ['1', '2', '3'] }, { scene: 'a' }] }
const rien = () => {}

const rendre = (over: Partial<Parameters<typeof MixEditeur>[0]> = {}) =>
  renderToStaticMarkup(<MixEditeur scenes={scenes} mixes={[mix]} canaux={canaux} noms={noms} actif={null} brouillon={null} onBrouillon={rien} onJouer={rien} onArreter={rien} onChange={rien} {...over} />)

describe('éditeur de mix', () => {
  it('la liste dit ce que chaque mix mélange et propose de le jouer', () => {
    const out = rendre()
    expect(out).toContain('salon')
    expect(out).toContain('2d + 3d · 2 couches')
    expect(out).toContain('>jouer<')
    expect(out).not.toContain('quitter le mix')
  })
  it('le mix joué propose d’en sortir', () => {
    expect(rendre({ actif: 'm1' })).toContain('quitter le mix')
  })
  it('sans mix, un message guide', () => {
    expect(rendre({ mixes: [] })).toContain('Aucun mix')
  })
  it('sans scène au pad, on ne peut pas en créer un', () => {
    expect(rendre({ scenes: [], mixes: [] })).toMatch(/<button[^>]*disabled[^>]*>nouveau mix</)
  })

  it('en édition : une ligne par couche, la première est la plus prioritaire', () => {
    const out = rendre({ brouillon: mix })
    expect((out.match(/class="lu-mx-couche"/g) ?? []).length).toBe(2)
    expect(out).toContain('La plus prioritaire')
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Plus prioritaire"/)          // la première ne peut pas monter
    expect(out).toContain('kick · 3d')
    expect(out).toContain('neutron · 2d')
  })
  it('les lampes visées s’affichent en puces : le groupe coché, « toutes » pour l’autre couche', () => {
    const out = rendre({ brouillon: mix })
    expect(out).toContain('gradient lightstrip (3)')
    expect(out).toMatch(/aria-pressed="true"[^>]*>gradient lightstrip \(3\)/)                  // couche 1 : le ruban seul
    expect(out).toContain('gradient lightstrip · 2d')                                          // phrase de la couche 1
    expect(out).toContain('toutes les lampes · 3d')                                            // phrase de la couche 2
  })
  it('un groupe à moitié visé est dit en mots', () => {
    const out = rendre({ brouillon: { ...mix, couches: [{ scene: 'a', canaux: ['1'] }, { scene: 'b' }] } })
    expect(out).toContain('1 canal sur 3 de gradient lightstrip')
  })
  it('une seule couche ne peut pas être retirée ; six couches : plus d’ajout', () => {
    const une = rendre({ brouillon: { id: 'new', nom: 'x', couches: [{ scene: 'a' }] } })
    expect(une).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Retirer la couche 1"/)
    const six = rendre({ brouillon: { id: 'new', nom: 'x', couches: Array.from({ length: 6 }, () => ({ scene: 'a' })) } })
    expect(six).toMatch(/<button[^>]*disabled=""[^>]*>\+ couche</)
  })
  it('« enregistrer » exige un nom', () => {
    expect(rendre({ brouillon: { id: 'new', nom: '', couches: [{ scene: 'a' }] } })).toMatch(/<button[^>]*disabled=""[^>]*>enregistrer le mix</)
    expect(rendre({ brouillon: { id: 'new', nom: 'ok', couches: [{ scene: 'a' }] } })).not.toMatch(/<button[^>]*disabled=""[^>]*>enregistrer le mix</)
  })
  it('une scène retirée du pad est signalée dans la couche', () => {
    expect(rendre({ brouillon: { id: 'm1', nom: 'x', couches: [{ scene: 'disparue' }] } })).toContain('scène retirée du pad')
  })
  it('sans lampes connues (huebeat ou plan absent), la couche joue sur toutes', () => {
    expect(rendre({ brouillon: mix, canaux: {}, noms: {} })).toContain('les lampes du plan ne sont pas connues')
  })
})
