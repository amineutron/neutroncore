import { describe, expect, it } from 'vitest'
import { COMMUN_DEFAUT, evaluer, paramsDeScene, rangs, type Dims, type Fixture, type FxParams, type RGB, type Scene } from './spatialFx'
import {
  MAX_COUCHES, ajouterCouche, basculerGroupe, canalLePlusProche, deplacerCouche, groupesDeLampes, lampesDeLaCouche, membres, mixPourApi,
  rangsCouche, resoudre, resume, retirerCouche, sortieMix, superposer, type Mix,
} from './spatialMix'

const DIMS: Dims = { w: 500, h: 600, d: 230 }
const scene = (id: string, over: Partial<Scene> = {}): Scene => ({ id, nom: id, effets: ['onde'], palette: 'neon', axe: 'x', source: { x: 50, y: 30, z: 35 }, intensite: 100, ...over })
const lampe = (id: string, pos: [number, number, number]): Fixture => ({ id, kind: 'lampe', pos })

describe('superposer (mêmes cas que test_spatial_mix.py)', () => {
  it('une couche seule est rendue telle quelle ; rien donne noir', () => {
    expect(superposer([[0.2, 0.4, 0.6]])).toEqual([0.2, 0.4, 0.6])
    expect(superposer([])).toEqual([0, 0, 0])
  })
  it('la prioritaire pleine masque les autres ; éteinte, elle laisse voir l’autre', () => {
    expect(superposer([[1, 0, 0], [0, 0, 1]])).toEqual([1, 0, 0])
    expect(superposer([[0, 0, 0], [0, 0.3, 0.9]])).toEqual([0, 0.3, 0.9])
  })
  it('la prioritaire faible laisse passer ce qu’elle ne couvre pas', () => {
    const [r, , b] = superposer([[0.5, 0, 0], [0, 0, 1]])
    expect(r).toBeCloseTo(0.5)
    expect(b).toBeCloseTo(0.5)
  })
  it('jamais au-delà de un, et l’ordre est la priorité', () => {
    for (const haut of [[1, 1, 1], [0.9, 0.2, 0.4], [0.3, 0.3, 0.3]] as RGB[]) {
      for (const bas of [[1, 1, 1], [0, 1, 0.5]] as RGB[]) expect(superposer([haut, bas]).every((v) => v >= 0 && v <= 1 + 1e-9)).toBe(true)
    }
    expect(superposer([[0.6, 0, 0], [0, 0.8, 0]])).not.toEqual(superposer([[0, 0.8, 0], [0.6, 0, 0]]))
  })
  it('trois couches : du bas vers le haut, chacune voilée par celle du dessus', () => {
    const [r, g, b] = superposer([[0.5, 0, 0], [0, 0, 0.5], [0, 1, 0]])
    expect(r).toBeCloseTo(0.5)
    expect(b).toBeCloseTo(0.25)
    expect(g).toBeCloseTo(0.25)
  })
})

describe('sortieMix', () => {
  const f = lampe('a', [150, 100, 60])
  const p3d: FxParams = paramsDeScene(scene('x'), DIMS, COMMUN_DEFAUT)
  const p2d: FxParams = paramsDeScene(scene('y', { mode: '2d', groupe: 'tous', palette: 'fire' }), DIMS, COMMUN_DEFAUT)

  it('une couche seule se voit exactement comme la même scène seule, en 3d comme en 2d (pas de saut de luminosité)', () => {
    for (const [p, beat] of [[p3d, 0.1], [p3d, 0.4], [p2d, 0.05], [p2d, 0.3]] as const) {
      const seul = evaluer(['onde'], f, DIMS, p, beat)
      expect(seul.niveau).toBeGreaterThan(0)
      const m = sortieMix([{ effets: ['onde'], params: p, rang: 0 }], f, DIMS, beat)
      // même lumière (couleur x niveau) : c'est ce que l'écran affiche
      m.rgb.forEach((c, i) => expect(c * m.niveau).toBeCloseTo(seul.rgb[i] * seul.niveau, 9))
    }
  })
  it('un mix de deux couches identiques ne rend pas plus fort que la couche seule au maximum de couverture', () => {
    const seul = sortieMix([{ effets: ['onde'], params: p3d, rang: 0 }], f, DIMS, 0.1)
    const deux = sortieMix([{ effets: ['onde'], params: p3d, rang: 0 }, { effets: ['onde'], params: p3d, rang: 0 }], f, DIMS, 0.1)
    expect(deux.niveau).toBeGreaterThanOrEqual(seul.niveau - 1e-9)
    expect(deux.niveau).toBeLessThanOrEqual(1 + 1e-9)
  })
  it('aucune couche : lampe éteinte', () => {
    expect(sortieMix([], f, DIMS, 0.3).niveau).toBe(0)
  })
  it('la couche du dessus masque celle du dessous là où elle éclaire', () => {
    const rouge = paramsDeScene(scene('r', { mode: '2d', groupe: 'tous', palette: 'libre', couleurs: ['#ff0000'] }), DIMS, COMMUN_DEFAUT)
    const bleu = paramsDeScene(scene('b', { mode: '2d', groupe: 'tous', palette: 'libre', couleurs: ['#0000ff'] }), DIMS, COMMUN_DEFAUT)
    const m = sortieMix([{ effets: [], params: rouge, rang: 0 }, { effets: [], params: bleu, rang: 0 }], f, DIMS, 0)
    expect(m.rgb[0]).toBeGreaterThan(0.99)
    expect(m.rgb[2]).toBeLessThan(0.01)
  })
})

describe('lampes visées par une couche', () => {
  const canaux = { '0': [0, 0, 100], '1': [150, 100, 60], '2': [-200, 50, 80] }
  const fixtures = [lampe('a', [3, 2, 90]), lampe('b', [160, 90, 50]), lampe('c', [-190, 60, 70]), lampe('d', [140, 120, 55])]

  it('chaque appareil se rattache au canal le plus proche (plan, hors hauteur)', () => {
    expect(canalLePlusProche(fixtures.map((x) => x.pos), canaux)).toEqual(['0', '1', '2', '1'])
  })
  it('sans canaux (club, autre lieu), aucun appareil n’est rattaché', () => {
    expect(canalLePlusProche(fixtures.map((x) => x.pos), {})).toEqual([null, null, null, null])
  })
  it('membres : toutes les lampes sans ciblage, sinon celles des canaux visés ; un appareil sans canal suit la couche entière', () => {
    const canalDe = ['0', '1', '2', '1']
    expect(membres(canalDe, null)).toEqual([true, true, true, true])
    expect(membres(canalDe, ['1'])).toEqual([false, true, false, true])
    expect(membres([null, null], ['1'])).toEqual([true, true])
  })
  it('l’alternance 2d se compte dans le groupe visé', () => {
    const pos = fixtures.map((x) => x.pos)
    const dansLeGroupe = rangsCouche(pos, [false, true, true, true])
    expect(dansLeGroupe[0]).toBe(0)                                  // hors groupe : sans effet
    expect([dansLeGroupe[1], dansLeGroupe[2], dansLeGroupe[3]].sort()).toEqual([0, 1, 2])
    expect(rangsCouche(pos, [true, true, true, true])).toEqual(rangs(pos))
  })
})

describe('groupes de lampes pour l’éditeur', () => {
  const noms = { '0': 'Hue', '1': 'gradient lightstrip', '2': 'gradient lightstrip', '3': 'gradient lightstrip', '4': 'Hue 2' }
  const canaux = { '0': [0, 0, 0], '1': [0, 0, 0], '2': [0, 0, 0], '3': [0, 0, 0], '4': [0, 0, 0] }

  it('les canaux d’une même lampe forment un groupe (le ruban a plusieurs segments)', () => {
    const g = groupesDeLampes(canaux, noms)
    expect(g.map((x) => [x.nom, x.canaux])).toEqual([['Hue', ['0']], ['gradient lightstrip', ['1', '2', '3']], ['Hue 2', ['4']]])
  })
  it('un canal sans nom garde un libellé lisible', () => {
    expect(groupesDeLampes({ '7': [0, 0, 0] }, {})[0].nom).toBe('canal 7')
  })
  it('basculer un groupe : le coche, le décoche ; tout coché ou rien coché = toutes les lampes (undefined)', () => {
    const tous = ['0', '1', '2', '3', '4']
    expect(basculerGroupe(undefined, ['1', '2', '3'], tous)).toEqual(['1', '2', '3'])
    expect(basculerGroupe(['1', '2', '3'], ['0'], tous)).toEqual(['0', '1', '2', '3'])
    expect(basculerGroupe(['1', '2', '3'], ['1', '2', '3'], tous)).toBeUndefined()
    expect(basculerGroupe(['0', '1', '2', '3'], ['4'], tous)).toBeUndefined()
  })
  it('libellé d’une couche : toutes les lampes, ou les groupes visés', () => {
    const g = groupesDeLampes(canaux, noms)
    expect(lampesDeLaCouche(undefined, g)).toBe('toutes les lampes')
    expect(lampesDeLaCouche(['1', '2', '3'], g)).toBe('gradient lightstrip')
    expect(lampesDeLaCouche(['0', '4'], g)).toBe('Hue, Hue 2')
    expect(lampesDeLaCouche(['1'], g)).toBe('1 canal sur 3 de gradient lightstrip')
  })
})

describe('édition d’un mix', () => {
  const m: Mix = { id: 'm', nom: 'salon', couches: [{ scene: 'a' }, { scene: 'b', canaux: ['1'] }, { scene: 'c' }] }

  it('déplacer une couche change sa priorité ; aux extrémités rien ne bouge', () => {
    expect(deplacerCouche(m.couches, 1, -1).map((c) => c.scene)).toEqual(['b', 'a', 'c'])
    expect(deplacerCouche(m.couches, 1, 1).map((c) => c.scene)).toEqual(['a', 'c', 'b'])
    expect(deplacerCouche(m.couches, 0, -1)).toBe(m.couches)
    expect(deplacerCouche(m.couches, 2, 1)).toBe(m.couches)
  })
  it('ajouter et retirer ne modifient pas l’original, et le plafond est tenu', () => {
    const plus = ajouterCouche(m.couches, 'd')
    expect(plus.map((c) => c.scene)).toEqual(['a', 'b', 'c', 'd'])
    expect(m.couches).toHaveLength(3)
    expect(retirerCouche(m.couches, 1).map((c) => c.scene)).toEqual(['a', 'c'])
    let c = m.couches
    for (let i = 0; i < 10; i++) c = ajouterCouche(c, 'x')
    expect(c).toHaveLength(MAX_COUCHES)
  })
  it('résoudre : une scène retirée du pad sort du mix ; on garde l’ordre', () => {
    const scenes = [scene('a'), scene('c', { mode: '2d' })]
    expect(resoudre(m, scenes).map((c) => c.scene.id)).toEqual(['a', 'c'])
  })
  it('résumé : les modes présents et le nombre de couches', () => {
    const scenes = [scene('a'), scene('b', { mode: '2d' }), scene('c')]
    expect(resume(m, scenes)).toBe('3d + 2d · 3 couches')
    expect(resume({ ...m, couches: [{ scene: 'b' }] }, scenes)).toBe('2d · 1 couche')
  })
  it('à envoyer à l’API : les scènes en entier, sans identifiant, avec leurs lampes', () => {
    const scenes = [scene('a', { nom: 'kick' }), scene('b', { nom: 'neutron', mode: '2d' }), scene('c')]
    const api = mixPourApi(m, scenes)
    expect(api.nom).toBe('salon')
    expect(api.couches[0]).toEqual({ scene: expect.objectContaining({ nom: 'kick', effets: ['onde'] }) })
    expect(api.couches[0].scene).not.toHaveProperty('id')
    expect(api.couches[1]).toEqual({ scene: expect.objectContaining({ nom: 'neutron', mode: '2d' }), canaux: ['1'] })
    expect(api.couches).toHaveLength(3)
  })
})
