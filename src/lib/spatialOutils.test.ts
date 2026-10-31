import { describe, expect, it } from 'vitest'
import type { Plan } from './plan'
import {
  basculer, deplacees, ecartCm, importPossible, lampesDuPlan, lireFichier, MAX_OCTETS_IMPORT, nomCanaux, nomFichierExport, phraseApercu,
  pointTouche, problemesTest, progressionTest, recaler, requeteExport, titreTest, type EtatTest, type LampeInfo,
} from './spatialOutils'

const plan: Plan = {
  roomDims: { w: 400, h: 300, d: 250 },
  configs: { '1': { pos: { x: -100, y: 50, z: 10 }, name: 'Salon' }, '2': { pos: { x: 0, y: 0, z: -20 }, name: 'Coin' } },
  rev: 'r1',
}
const lampes: LampeInfo[] = [
  { id: '1', nom: 'Salon', joignable: true, canaux: [0] }, { id: '2', nom: 'Coin', joignable: true, canaux: [] }, { id: '9', nom: 'Chambre', joignable: true, canaux: [] },
]

describe('calibrage', () => {
  it('sépare les lampes du plan de celles qu\'il ne connaît pas', () => {
    const r = lampesDuPlan(lampes, plan)
    expect(r.placables.map((l) => l.id)).toEqual(['1', '2'])
    expect(r.absentes.map((l) => l.id)).toEqual(['9'])
  })

  it('traduit un toucher en position de la pièce (centre = 0,0)', () => {
    const rect = { left: 10, top: 20, width: 200, height: 150 }
    expect(pointTouche(110, 95, rect, plan.roomDims)).toEqual({ x: 0, y: 0 })
    expect(pointTouche(10, 20, rect, plan.roomDims)).toEqual({ x: -195, y: -145 })       // coin : ramené entre les murs
    expect(pointTouche(60, 57.5, rect, plan.roomDims)).toEqual({ x: -100, y: -75 })
  })

  it('un toucher hors du dessin est ramené dans la pièce, un dessin sans taille est refusé', () => {
    const rect = { left: 0, top: 0, width: 100, height: 100 }
    expect(pointTouche(5000, -5000, rect, plan.roomDims)).toEqual({ x: 195, y: -145 })
    expect(pointTouche(1, 1, { ...rect, width: 0 }, plan.roomDims)).toBeNull()
    expect(pointTouche(NaN, 1, rect, plan.roomDims)).toBeNull()
  })

  it('recaler change x et y, garde la hauteur, ne modifie pas le plan d\'origine', () => {
    const avant = JSON.stringify(plan)
    const neuf = recaler(plan, '1', { x: 30, y: -40 })
    expect(neuf.configs['1'].pos).toEqual({ x: 30, y: -40, z: 10 })
    expect(neuf.rev).toBe('r1')
    expect(JSON.stringify(plan)).toBe(avant)
    expect(recaler(plan, 'inconnue', { x: 1, y: 1 })).toBe(plan)
  })

  it('liste les lampes déplacées, plus grand écart d\'abord', () => {
    const d = recaler(recaler(plan, '1', { x: -100, y: 60 }), '2', { x: 30, y: 40 })
    expect(deplacees(plan, d)).toEqual([{ id: '2', nom: 'Coin', ecart: 50 }, { id: '1', nom: 'Salon', ecart: 10 }])
    expect(deplacees(plan, plan)).toEqual([])
    expect(ecartCm({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('test des lampes', () => {
  const e = (p: Partial<EtatTest>): EtatTest => ({ etat: 'repos', total: 0, fait: 0, courant: null, rapport: [], resume: '', erreur: null, ...p })
  it('progression bornée', () => {
    expect(progressionTest({ fait: 1, total: 4 })).toBe(25)
    expect(progressionTest({ fait: 0, total: 0 })).toBe(0)
    expect(progressionTest({ fait: 9, total: 4 })).toBe(100)
  })
  it('titres', () => {
    expect(titreTest(e({ etat: 'en_cours', courant: 'Salon' }))).toBe('test en cours : Salon')
    expect(titreTest(e({ etat: 'termine', resume: '2 lampes sur 3 répondent' }))).toBe('2 lampes sur 3 répondent')
    expect(titreTest(e({ etat: 'erreur', erreur: 'panne' }))).toBe('panne')
    expect(titreTest(e({}))).toBe('')
  })
  it('noms de canaux et problèmes', () => {
    expect(nomCanaux([])).toBe('')
    expect(nomCanaux([3])).toBe('canal 3')
    expect(nomCanaux([0, 1])).toBe('canaux 0, 1')
    const l = (etat: 'repond' | 'ne_repond_pas', restauree: boolean | null) => ({ id: 'x', nom: 'x', canaux: [], etat, raison: '', restauree })
    expect(problemesTest([l('repond', true), l('ne_repond_pas', null), l('repond', false)])).toHaveLength(2)
  })
})

describe('partage', () => {
  it('nom du fichier daté', () => {
    expect(nomFichierExport(new Date(2026, 9, 5))).toBe('lumiere-20261005.json')
  })

  it('lit un fichier valide, ajoute les listes absentes', () => {
    const r = lireFichier('{"version":1,"scenes":[{"nom":"a"}]}')
    expect(r.ok && r.fichier.sets).toEqual([])
    expect(r.ok && r.fichier.scenes).toHaveLength(1)
  })

  it.each([
    ['', 'JSON'], ['pas du json', 'JSON'], ['[]', 'export'], ['null', 'export'], ['"x"', 'export'], ['{}', 'version'], ['{"version":"1"}', 'version'],
    ['{"version":1.5}', 'version'], ['{"version":0}', 'version'], ['{"version":1,"scenes":{}}', 'scènes'], ['{"version":1,"sets":"x"}', 'sets'],
  ])('refuse %s', (texte, mot) => {
    const r = lireFichier(texte)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erreur).toContain(mot)
  })

  it('refuse un fichier trop gros avant de le lire', () => {
    const r = lireFichier('{"version":1,"x":"' + 'a'.repeat(MAX_OCTETS_IMPORT) + '"}')
    expect(!r.ok && r.erreur).toContain('trop gros')
  })

  it('phrase d\'aperçu', () => {
    const vide = { scenes: [], sets: [], refus: [] }
    expect(phraseApercu(vide)).toBe('ce fichier ne contient rien')
    expect(importPossible(vide)).toBe(false)
    const a = { scenes: [{ nom: 'kick (2)', renomme_de: 'kick' }, { nom: 'x', renomme_de: null }], sets: [{ nom: 's', renomme_de: null, etapes: 2 }], refus: [{ type: 'scene' as const, nom: 'y', raison: 'palette inconnue' }] }
    expect(phraseApercu(a)).toBe('sera ajouté : 2 scènes et 1 set (1 nom déjà pris, renommé) ; 1 élément refusé')
    expect(importPossible(a)).toBe(true)
    expect(phraseApercu({ scenes: [], sets: [], refus: a.refus })).toContain('tout ce qui est dans le fichier est refusé')
  })

  it('cocher sans toucher à la liste d\'origine', () => {
    const l = ['a', 'b']
    expect(basculer(l, 'c')).toEqual(['a', 'b', 'c'])
    expect(basculer(l, 'a')).toEqual(['b'])
    expect(l).toEqual(['a', 'b'])
  })

  it('requête d\'export : tout coché = pas de filtre', () => {
    expect(requeteExport(['a', 'b'], ['a', 'b'], ['s'], ['s'])).toBe('')
    expect(requeteExport(['a'], ['a', 'b'], ['s'], ['s'])).toBe('?scenes=a')
    expect(requeteExport(['a', 'b'], ['a', 'b'], [], ['s'])).toBe('?sets=')
    expect(requeteExport([], [], [], [])).toBe('?scenes=&sets=')
  })
})
