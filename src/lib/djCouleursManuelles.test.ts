import { describe, expect, it } from 'vitest'
import { appliquer, nouvelleCouche, phrase, type Couche, type Profil } from './djCouches'
import { COMMUN_DEFAUT, LIBRE, couleursDe, type Scene } from './spatialFx'

const SCENE: Scene = { id: 'sc000001', nom: 'balayage', effets: ['onde'], palette: 'neon', axe: 'x', source: { x: 50, y: 30, z: 35 }, intensite: 80 }
const FLASH: Scene = { id: 'sc000002', nom: 'kick', effets: ['onde', 'phare'], palette: 'fire', axe: 'x', source: { x: 20, y: 60, z: 70 }, intensite: 100 }
const BASE = (): Couche[] => [nouvelleCouche('couleurs', { id: 'couleurs0' }), nouvelleCouche('scene', { id: 'scene000' })]
const profil = (couches: Couche[]): Profil => ({ id: 'profil01', nom: 'test', couches })
const jouer = (couches: Couche[], declenches: Record<string, string> = {}) =>
  appliquer({ profil: profil(couches), valeurs: {}, scene: SCENE, scenes: [SCENE, FLASH], commun: COMMUN_DEFAUT, declenches })
const jouees = (r: ReturnType<typeof jouer>) => couleursDe({ palette: r.etat.palette, couleurs: r.etat.couleurs })

const ROUGE_VERT_JAUNE = ['#ff0000', '#00ff00', '#ffff00']
const kick = (p: Partial<Couche> = {}) => nouvelleCouche('declencheur', { id: 'kick', signal: 'kick', scene: FLASH.id, ...p })

describe('couleurs choisies à la main', () => {
  it('un déclencheur joue sa scène avec les couleurs imposées au lieu de sa palette', () => {
    const r = jouer([kick({ couleurs: ROUGE_VERT_JAUNE }), ...BASE()], { kick: FLASH.id })
    expect(r.etat.scene.effets).toEqual(['onde', 'phare'])
    expect(r.etat.palette).toBe(LIBRE)
    expect(jouees(r)).toEqual(ROUGE_VERT_JAUNE)
  })
  it('sans couleurs imposées, le déclencheur garde la palette de sa scène (comportement d’avant)', () => {
    expect(jouer([kick({ couleurs: [] }), ...BASE()], { kick: FLASH.id }).etat.palette).toBe('fire')
    expect(jouer([kick()], { kick: FLASH.id }).etat.palette).toBe('fire')
  })
  it('la rangée « couleurs de la scène » peut imposer les siennes à la scène jouée', () => {
    const [couleurs, scene] = BASE()
    const r = jouer([{ ...couleurs, couleurs: ROUGE_VERT_JAUNE }, scene])
    expect(jouees(r)).toEqual(ROUGE_VERT_JAUNE)
    expect(r.etat.scene.id).toBe(SCENE.id)
  })
  it('tant que le déclencheur ne joue pas, la scène garde ses couleurs', () => {
    expect(jouer([kick({ couleurs: ROUGE_VERT_JAUNE }), ...BASE()]).etat.palette).toBe('neon')
  })
  it('écarte les couleurs invalides plutôt que de les envoyer aux lampes', () => {
    const r = jouer([kick({ couleurs: ['rouge', '#00FF00', ''] }), ...BASE()], { kick: FLASH.id })
    expect(jouees(r)).toEqual(['#00ff00'])
  })
  it('si aucune couleur imposée n’est valide, la palette de la scène reste', () => {
    expect(jouer([kick({ couleurs: ['rouge'] }), ...BASE()], { kick: FLASH.id }).etat.palette).toBe('fire')
  })
  it('la phrase de la rangée annonce ses couleurs', () => {
    expect(phrase(kick({ couleurs: ROUGE_VERT_JAUNE }), [FLASH])).toContain('3 couleurs choisies')
    expect(phrase(nouvelleCouche('couleurs', { couleurs: ROUGE_VERT_JAUNE }))).toContain('3 couleurs choisies')
    expect(phrase(nouvelleCouche('couleurs'))).toBe('la palette de la scène')
  })
})
