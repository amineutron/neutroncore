import { describe, expect, it } from 'vitest'
import {
  CIBLES_COULEUR, CIBLES_MOD, appliquer, conflits, deplacer, nouvelleCouche, phrase, profilsDeDepart, sortieDe, transformerCouleurs, versParams,
  type Couche, type Profil,
} from './djCouches'
import { SIGNAUX } from './djSignaux'
import { COMMUN_DEFAUT, LIBRE, PALETTES, couleursDe, type Dims, type Scene } from './spatialFx'

const DIMS: Dims = { w: 400, h: 300, d: 250 }
const SCENE: Scene = { id: 'sc000001', nom: 'kick', effets: ['onde'], palette: 'neon', axe: 'x', source: { x: 50, y: 30, z: 35 }, intensite: 80 }
const FLASH: Scene = { id: 'sc000002', nom: 'tempête', effets: ['onde', 'phare'], palette: 'fire', axe: 'x', source: { x: 20, y: 60, z: 70 }, intensite: 100 }
const BASE = (): Couche[] => [nouvelleCouche('couleurs', { id: 'couleurs0' }), nouvelleCouche('scene', { id: 'scene000' })]
const mod = (id: string, p: Partial<Couche>): Couche => nouvelleCouche('modulation', { id, lissage: 0, ...p })
const profil = (couches: Couche[]): Profil => ({ id: 'profil01', nom: 'test', couches })
const jouer = (couches: Couche[], valeurs: Record<string, number>, declenches: Record<string, string> = {}) =>
  appliquer({ profil: profil(couches), valeurs, scene: SCENE, scenes: [SCENE, FLASH], commun: COMMUN_DEFAUT, declenches })

describe('sortie d’une rangée', () => {
  it('va de min à max', () => {
    const c = { min: 20, max: 80, inverse: false, seuil: 0 }
    expect(sortieDe(c, 0).sortie).toBe(20)
    expect(sortieDe(c, 1).sortie).toBe(80)
    expect(sortieDe(c, 0.5).sortie).toBe(50)
  })
  it('ne compte le signal qu’au-delà du seuil, puis étale le reste', () => {
    const c = { min: 0, max: 100, inverse: false, seuil: 50 }
    expect(sortieDe(c, 0.4).sortie).toBe(0)
    expect(sortieDe(c, 0.75).sortie).toBeCloseTo(50)
    expect(sortieDe(c, 1).sortie).toBe(100)
  })
  it('l’inversion renverse la sortie', () => {
    expect(sortieDe({ min: 0, max: 100, inverse: true, seuil: 0 }, 1).sortie).toBe(0)
    expect(sortieDe({ min: 0, max: 100, inverse: true, seuil: 0 }, 0).sortie).toBe(100)
  })
  it('un signal absurde vaut zéro', () => {
    expect(sortieDe({ min: 5, max: 9, inverse: false, seuil: 0 }, NaN).sortie).toBe(5)
  })
})

describe('la pile', () => {
  it('une pile vide de modulation rend la scène telle quelle', () => {
    const r = jouer(BASE(), {})
    expect(r.etat.intensite).toBe(80)
    expect(r.etat.source).toEqual({ x: 50, y: 30, z: 35 })
    expect(r.etat.general).toBe(100)
    expect(r.etat.palette).toBe('neon')
  })
  it('au-dessus de la scène, le son déplace le point source', () => {
    const pan = mod('pan', { signal: 'pan', cible: 'source_x', min: 10, max: 90 })
    const r = jouer([pan, ...BASE()], { pan: 1 })
    expect(r.etat.source.x).toBe(90)
    expect(r.acts.pan).toBe(1)
  })
  it('sous la scène, la même rangée est recouverte', () => {
    const pan = mod('pan', { signal: 'pan', cible: 'source_x', min: 10, max: 90 })
    const [couleurs, scene] = BASE()
    const r = jouer([couleurs, scene, pan], { pan: 1 })
    expect(r.etat.source.x).toBe(50)
  })
  it('la rangée du haut gagne quand deux règlent la même cible', () => {
    const haut = mod('haut', { signal: 'volume', cible: 'profondeur', min: 70, max: 70 })
    const bas = mod('bas', { signal: 'volume', cible: 'profondeur', min: 10, max: 10 })
    expect(jouer([haut, bas, ...BASE()], { haut: 1, bas: 1 }).etat.profondeur).toBe(70)
    expect(jouer([bas, haut, ...BASE()], { haut: 1, bas: 1 }).etat.profondeur).toBe(10)
  })
  it('multiplie baisse le niveau, ajoute le monte', () => {
    const m = mod('m', { signal: 'kick', cible: 'general', mode: 'multiplie', min: 50, max: 100 })
    expect(jouer([m, ...BASE()], { m: 0 }).etat.general).toBe(50)
    expect(jouer([m, ...BASE()], { m: 1 }).etat.general).toBe(100)
    const a = mod('a', { signal: 'volume', cible: 'plancher', mode: 'ajoute', min: 0, max: 30 })
    expect(jouer([a, ...BASE()], { a: 1 }).etat.plancher).toBe(30)
  })
  it('la force dose la rangée', () => {
    const m = mod('m', { signal: 'volume', cible: 'profondeur', min: 100, max: 100, force: 40 })
    expect(jouer([m, ...BASE()], { m: 1 }).etat.profondeur).toBeCloseTo(40)
    expect(jouer([{ ...m, force: 0 }, ...BASE()], { m: 1 }).etat.profondeur).toBe(0)
  })
  it('le résultat reste dans les bornes du réglage', () => {
    const m = mod('m', { signal: 'volume', cible: 'tempo', mode: 'remplace', min: 0, max: 900 })
    expect(jouer([m, ...BASE()], { m: 1 }).etat.tempo).toBe(200)
    expect(jouer([m, ...BASE()], { m: 0 }).etat.tempo).toBe(25)
  })
  it('une rangée éteinte n’agit pas', () => {
    const m = mod('m', { signal: 'volume', cible: 'profondeur', min: 90, max: 90, actif: false })
    expect(jouer([m, ...BASE()], { m: 1 }).etat.profondeur).toBe(0)
  })
  it('solo isole la rangée, mais la scène reste jouée', () => {
    const a = mod('a', { signal: 'volume', cible: 'profondeur', min: 60, max: 60, solo: true })
    const b = mod('b', { signal: 'volume', cible: 'plancher', min: 40, max: 40 })
    const r = jouer([a, b, ...BASE()], { a: 1, b: 1 })
    expect(r.etat.profondeur).toBe(60)
    expect(r.etat.plancher).toBe(0)
    expect(r.etat.intensite).toBe(80)
  })
  it('règle l’intensité d’un seul effet', () => {
    const m = mod('m', { signal: 'hat', cible: 'effet', fx: 'onde', mode: 'remplace', min: 100, max: 20 })
    const r = jouer([m, ...BASE()], { m: 1 })
    expect(r.etat.fx.onde).toBe(20)
    expect(versParams(r.etat, DIMS, COMMUN_DEFAUT).params.couches?.onde?.intensite).toBeCloseTo(0.8 * 0.2)
  })
})

describe('déclencheur', () => {
  const d = nouvelleCouche('declencheur', { id: 'drop', signal: 'drop', scene: FLASH.id })
  it('ne fait rien tant qu’il n’est pas déclenché', () => {
    expect(jouer([d, ...BASE()], {}).etat.scene.id).toBe(SCENE.id)
  })
  it('prend le relais avec sa scène et ses couleurs', () => {
    const r = jouer([d, ...BASE()], {}, { drop: FLASH.id })
    expect(r.etat.scene.effets).toEqual(['onde', 'phare'])
    expect(r.etat.palette).toBe('fire')
    expect(r.etat.source.x).toBe(20)
    expect(r.acts.drop).toBe(1)
  })
  it('est recouvert par la scène si on le place dessous', () => {
    const [couleurs, scene] = BASE()
    const r = jouer([couleurs, scene, d], {}, { drop: FLASH.id })
    expect(r.etat.scene.id).toBe(SCENE.id)
  })
  it('ignore une scène supprimée du pad', () => {
    expect(jouer([d, ...BASE()], {}, { drop: 'disparue1' }).etat.scene.id).toBe(SCENE.id)
  })
})

describe('couleurs', () => {
  const palette = nouvelleCouche('couleur', { id: 'pal', signal: 'mode', cible: 'palette', palettes: ['cool', 'sunset'] })
  it('choisit la palette selon le mode', () => {
    expect(jouer([palette, ...BASE()], { pal: 0 }).etat.palette).toBe('cool')
    expect(jouer([palette, ...BASE()], { pal: 1 }).etat.palette).toBe('sunset')
  })
  it('garde la palette de la scène tant que la tonalité n’est pas trouvée', () => {
    expect(jouer([palette, ...BASE()], { pal: 0.5 }).etat.palette).toBe('neon')
  })
  it('la palette de la scène, placée au-dessus, reprend la main', () => {
    const [couleurs, scene] = BASE()
    expect(jouer([couleurs, palette, scene], { pal: 1 }).etat.palette).toBe('neon')
  })
  it('la teinte tourne les couleurs', () => {
    const t = nouvelleCouche('couleur', { id: 't', signal: 'tonalite', cible: 'teinte', min: 0, max: 180 })
    const r = jouer([t, ...BASE()], { t: 1 })
    expect(r.etat.teinte).toBe(180)
    const p = versParams(r.etat, DIMS, COMMUN_DEFAUT).params
    expect(p.palette).toBe(LIBRE)
    expect(p.couleurs?.[0]).not.toBe(PALETTES.neon.couleurs[0])
  })
  it('sans transformation, la palette reste nommée', () => {
    const p = versParams(jouer(BASE(), {}).etat, DIMS, COMMUN_DEFAUT).params
    expect(p.palette).toBe('neon')
    expect(p.couleurs).toBeUndefined()
  })
  it('transformer sans rien changer rend les mêmes couleurs', () => {
    const l = ['#ff2bd6', '#22d3ee']
    expect(transformerCouleurs(l, 0, 100, 0)).toBe(l)
  })
  it('désature jusqu’au gris et chauffe vers l’orangé', () => {
    expect(transformerCouleurs(['#ff0000'], 0, 0, 0)[0]).toBe('#808080')
    const chaud = transformerCouleurs(['#0000ff'], 0, 100, 100)[0]
    expect(parseInt(chaud.slice(1, 3), 16)).toBeGreaterThan(100)
    expect(couleursDe({ palette: 'neon' })).toHaveLength(3)
  })
})

describe('paramètres de lumière', () => {
  it('la luminosité générale et la pulsation passent dans les réglages communs', () => {
    const m = mod('m', { signal: 'volume', cible: 'profondeur', min: 55, max: 55 })
    const g = mod('g', { signal: 'volume', cible: 'general', mode: 'multiplie', min: 50, max: 50 })
    const s = versParams(jouer([m, g, ...BASE()], { m: 1, g: 1 }).etat, DIMS, COMMUN_DEFAUT)
    expect(s.params.general).toBeCloseTo(0.5)
    expect(s.params.pulse?.profondeur).toBe(55)
    expect(s.effets).toEqual(['onde'])
  })
  it('la vitesse des effets sort en facteur', () => {
    const t = mod('t', { signal: 'montee', cible: 'tempo', min: 100, max: 200 })
    expect(versParams(jouer([t, ...BASE()], { t: 1 }).etat, DIMS, COMMUN_DEFAUT).tempoK).toBe(2)
    expect(versParams(jouer(BASE(), {}).etat, DIMS, COMMUN_DEFAUT).tempoK).toBe(1)
  })
})

describe('outils de la pile', () => {
  it('repère les rangées recouvertes par une rangée plus haute qui règle la même cible', () => {
    const a = mod('a', { cible: 'profondeur' }), b = mod('b', { cible: 'profondeur' }), c = mod('c', { cible: 'plancher' })
    expect(conflits([a, b, c])).toEqual({ b: 'a' })
    expect(conflits([a, { ...b, actif: false }, c])).toEqual({})
    expect(conflits([a, { ...b, mode: 'multiplie' }])).toEqual({})
  })
  it('déplace une rangée d’un cran, sans sortir de la pile', () => {
    const [a, b, c] = ['a', 'b', 'c'].map((id) => mod(id, {}))
    expect(deplacer([a, b, c], 'b', -1).map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(deplacer([a, b, c], 'a', -1).map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(deplacer([a, b, c], 'c', 1).map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(deplacer([a, b, c], 'zzz', 1)).toEqual([a, b, c])
  })
  it('dit chaque rangée en une phrase', () => {
    expect(phrase(mod('m', { signal: 'kick', cible: 'general', mode: 'multiplie', min: 60, max: 100 }))).toBe('à chaque grosse caisse : luminosité générale multipliée de 60 % à 100 %')
    expect(phrase(nouvelleCouche('declencheur', { signal: 'drop', scene: FLASH.id, mesures: 4 }), [FLASH])).toContain('« tempête » prend le relais 4 mesures')
    expect(phrase(nouvelleCouche('declencheur', { signal: 'drop', scene: 'x' }), [])).toContain('introuvable')
    expect(phrase(nouvelleCouche('scene'))).toContain('scène jouée')
  })
})

describe('profils de départ', () => {
  const profils = profilsDeDepart()
  it('sont valides pour l’API', () => {
    expect(new Set(profils.map((p) => p.id)).size).toBe(profils.length)
    for (const p of profils) {
      expect(p.id).toMatch(/^[a-z0-9]{6,16}$/)
      expect(p.couches.filter((c) => c.genre === 'scene')).toHaveLength(1)
      expect(p.couches.filter((c) => c.genre === 'couleurs')).toHaveLength(1)
      expect(new Set(p.couches.map((c) => c.id)).size).toBe(p.couches.length)
      for (const c of p.couches) {
        expect(c.id).toMatch(/^[a-z0-9]{6,16}$/)
        if (c.signal) expect(SIGNAUX).toContain(c.signal)
        if (c.cible) expect(c.cible in CIBLES_MOD || c.cible in CIBLES_COULEUR).toBe(true)
        for (const pal of c.palettes) expect(pal in PALETTES).toBe(true)
        expect(c.force).toBeGreaterThanOrEqual(0)
        expect(c.force).toBeLessThanOrEqual(100)
      }
    }
  })
  it('placent la scène et les couleurs sous les modulations', () => {
    for (const p of profils) {
      const i = p.couches.findIndex((c) => c.genre === 'scene')
      expect(p.couches.slice(0, i).every((c) => c.genre !== 'scene')).toBe(true)
      expect(i).toBe(p.couches.length - 1)
    }
  })
  it('jouent sans erreur sur du silence comme sur du plein volume', () => {
    for (const p of profils) {
      const zero = Object.fromEntries(p.couches.map((c) => [c.id, 0]))
      const un = Object.fromEntries(p.couches.map((c) => [c.id, 1]))
      for (const valeurs of [zero, un]) {
        const e = appliquer({ profil: p, valeurs, scene: SCENE, scenes: [SCENE, FLASH], commun: COMMUN_DEFAUT, declenches: {} }).etat
        const s = versParams(e, DIMS, COMMUN_DEFAUT)
        expect(Number.isFinite(s.params.general ?? 1)).toBe(true)
        expect(s.tempoK).toBeGreaterThan(0)
      }
    }
  })
})
