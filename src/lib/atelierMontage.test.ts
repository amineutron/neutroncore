import { describe, expect, it } from 'vitest'
import type { Article, Piece, Vec3 } from './atelier'
import { boiteDeBase, compterFamilles, piecesProduit, dirDuGeste, insertionDir, montageEtats, montageSteps, slideOffsets, splitEtape, type Boite, type Boites } from './atelierMontage'

const P = (nom: string, groupe: Piece['groupe'] = 'composants'): Piece => ({ nom, groupe, chemin: `${nom}.stl` })
const B = (min: Vec3, max: Vec3): Boite => ({ min, max })

// la fiche réelle du support de batterie : c'est elle que l'écran doit savoir lire
const FICHE = [
  '1. Poser les 6 inserts a chaud dans les bossages du corps, boitier vide.',
  "2. Plier l'etrier a la pince ou a l'etau, verifier qu'il se couche dans la gorge du gabarit (calibre), puis le pincer de 6 mm par bras, le descendre dans la poche par le dos et relacher : ses deux bouts entrent dans les trous des flancs.",
  '3. Presenter la bequille dans la poche par le dos, soulever la lame de la baie du module, enfiler les deux tourillons depuis la baie, relacher la lame.',
  "4. Coller les cales de mousse des flancs, poser les enrouleurs par le dessus en couchant chaque cable dans la fente ouverte de son angle du haut ; ranger les fiches sur les flancs (inclinees, le haut sous l'auvent, puis redressees).",
  "5. Poser par le dessus l'afficheur, puis le bouton, l'embase et la LED, le nez dans leur fente de pose de la tranche du haut ; coller leurs cales derriere eux.",
  '6. Poser la carte puis la cellule, brancher (schema de cablage dans la fiche), poser les cales du dessus.',
  '7. Fermer le couvercle (levre dans le corps, languettes dans les fentes de pose) et serrer les 6 vis M2.',
  '8. Degraisser puis coller les 4 patins dans leurs lamages : 2 sous la tranche du bas, 2 au dos du pied de bequille.',
]
const NOMENCLATURE: Article[] = [
  { cle: 'vis', quantite: 6, designation: 'vis M2x6 tete cylindrique, inox' },
  { cle: 'insert', quantite: 6, designation: 'insert a chaud M2x4' },
  { cle: 'axe', quantite: 2, designation: 'tige acier diam. 2.0 (tourillons)' },
  { cle: 'etrier', quantite: 1, designation: 'corde a piano diam. 2.5 pliee en U' },
  { cle: 'cale', quantite: 20, designation: 'cale de mousse adhesive' },
  { cle: 'cellule', quantite: 1, designation: 'LP9065113 10 000 mAh' },
  { cle: 'module', quantite: 1, designation: 'carte de gestion a afficheur, bouton, port et LED deportes' },
  { cle: 'enrouleur', quantite: 2, designation: 'enrouleur de cable a ressort diam. 45' },
  { cle: 'fiche', quantite: 2, designation: 'cable plat 1.5 x 5.6 et sa fiche' },
  { cle: 'patin', quantite: 4, designation: 'patin antiderapant adhesif' },
]
const PIECES = [
  P('corps', 'pieces'), P('couvercle', 'pieces'), P('bequille', 'pieces'), P('gabarit_pliage', 'pieces'),
  P('insert_a'), P('insert_b'), P('vis_a'), P('vis_b'), P('axe_g'), P('etrier'), P('cellule'), P('module'), P('afficheur'), P('bouton'), P('led'), P('port'),
  P('enrouleur_gauche'), P('fiche_gauche'), P('cale_enrouleur_gauche_1'), P('cale_afficheur_1'), P('cale_cellule_1'), P('cale_module_1'),
  P('patin_dos_1'), P('patin_pied_1'), P('telephone', 'gabarits'),
]
// boîtier de 100 x 180 x 20 : dos en z = 0, téléphone côté z+
const BOITES: Boites = {
  corps: B([0, 0, 0], [100, 180, 16]), couvercle: B([0, 0, 16], [100, 180, 20]), bequille: B([20, 10, -4], [80, 80, 0]), gabarit_pliage: B([120, 0, 0], [160, 40, 10]),
  insert_a: B([2, 2, 10], [5, 5, 14]), insert_b: B([95, 175, 10], [98, 178, 14]), vis_a: B([2, 2, 14], [5, 5, 20]), vis_b: B([95, 175, 14], [98, 178, 20]),
  axe_g: B([20, 76, -3], [22, 80, -1]), etrier: B([30, 40, -3], [70, 44, -1]), cellule: B([20, 20, 3], [80, 110, 12]), module: B([20, 112, 3], [80, 125, 6]),
  afficheur: B([40, 170, 6], [60, 176, 12]), bouton: B([65, 172, 6], [70, 176, 10]), led: B([75, 172, 6], [78, 176, 9]), port: B([82, 172, 6], [92, 176, 10]),
  enrouleur_gauche: B([5, 130, 3], [45, 168, 13]), fiche_gauche: B([3, 100, 3], [8, 128, 9]),
  cale_enrouleur_gauche_1: B([3, 140, 5], [4, 148, 11]), cale_afficheur_1: B([44, 166, 6], [52, 167, 10]), cale_cellule_1: B([18, 60, 5], [19, 68, 11]), cale_module_1: B([40, 126, 3], [48, 127, 6]),
  patin_dos_1: B([10, -0.5, 4], [18, 1, 12]), patin_pied_1: B([30, 12, -5.5], [38, 20, -4]),
}

describe('une phrase de la fiche devient des gestes courts', () => {
  it('coupe sur « puis », « ; » et les verbes qui s’enchaînent', () => {
    expect(splitEtape(FICHE[2]).map((g) => g.titre)).toEqual([
      'Presenter la bequille dans la poche par le dos', 'Soulever la lame de la baie du module', 'Enfiler les deux tourillons depuis la baie', 'Relacher la lame'])
  })
  it('les parenthèses et la suite de « : » passent en astuce', () => {
    expect(splitEtape(FICHE[1])).toEqual([
      { titre: "Plier l'etrier a la pince ou a l'etau", astuce: '' },
      { titre: "Verifier qu'il se couche dans la gorge du gabarit", astuce: 'Calibre' },
      { titre: 'Le pincer de 6 mm par bras, le descendre dans la poche par le dos et relacher', astuce: 'Ses deux bouts entrent dans les trous des flancs' },
    ])
  })
  it('un fragment sans verbe reprend celui d’avant, un fragment trop court rejoint son voisin', () => {
    expect(splitEtape(FICHE[5])).toEqual([
      { titre: 'Poser la carte', astuce: '' },
      { titre: 'Poser la cellule, brancher', astuce: 'Schema de cablage dans la fiche' },
      { titre: 'Poser les cales du dessus', astuce: '' },
    ])
    expect(splitEtape(FICHE[4]).map((g) => g.titre)).toEqual([
      "Poser par le dessus l'afficheur", "Poser le bouton, l'embase et la LED, le nez dans leur fente de pose de la tranche du haut", 'Coller leurs cales derriere eux'])
    expect(splitEtape(FICHE[7])).toEqual([{ titre: 'Degraisser puis coller les 4 patins dans leurs lamages', astuce: '2 sous la tranche du bas, 2 au dos du pied de bequille' }])
  })
  it('une phrase simple reste entière', () => {
    expect(splitEtape('1. Poser les 6 inserts a chaud dans les bossages du corps, boitier vide.')).toEqual([{ titre: 'Poser les 6 inserts a chaud dans les bossages du corps, boitier vide', astuce: '' }])
    expect(splitEtape('')).toEqual([])
  })
})

describe('quelle pièce à quel geste', () => {
  const steps = montageSteps(FICHE, PIECES, NOMENCLATURE, BOITES)
  const ou = (nom: string) => steps.find((s) => s.nouvelles.includes(nom))?.titre
  it('fait plus de gestes que la fiche n’a de phrases, plus la vue d’ensemble', () => {
    expect(steps.length).toBe(20)
    expect(steps[steps.length - 1].titre).toBe('Vue d’ensemble')
    expect(steps.map((s) => s.n).slice(0, 5)).toEqual([1, 2, 2, 2, 3])
  })
  it('une pièce va au geste qui la nomme', () => {
    expect(ou('insert_a')).toMatch(/^Poser les 6 inserts/)
    expect(ou('etrier')).toMatch(/^Plier l'etrier/)
    expect(ou('bequille')).toMatch(/^Presenter la bequille/)
    expect(ou('cellule')).toBe('Poser la cellule, brancher')
    expect(ou('vis_a')).toMatch(/^Fermer le couvercle/)
    expect(ou('patin_dos_1')).toMatch(/patins/)
    expect(ou('fiche_gauche')).toMatch(/^Ranger les fiches/)
  })
  it('« carte » désigne le module (premier mot de sa désignation), pas la phrase qui cite sa baie', () => {
    expect(ou('module')).toBe('Poser la carte')
  })
  it('une pièce imprimée arrive à sa première mention', () => {
    expect(ou('corps')).toMatch(/^Poser les 6 inserts/)
    expect(ou('couvercle')).toMatch(/^Fermer le couvercle/)
  })
  it('des cales citées dans trois gestes vont chacune près de ses voisines', () => {
    expect(ou('cale_enrouleur_gauche_1')).toBe('Coller les cales de mousse des flancs')
    expect(ou('cale_afficheur_1')).toBe('Coller leurs cales derriere eux')
    expect(ou('cale_cellule_1')).toBe('Poser les cales du dessus')
    expect(ou('cale_module_1')).toBe('Poser les cales du dessus')
  })
  it('une pièce que rien ne nomme rejoint sa voisine et est signalée déduite', () => {
    const port = steps.find((s) => s.nouvelles.includes('port'))!
    expect(port.titre).toMatch(/bouton/)
    expect(port.deduites).toContain('port')
    expect(steps.find((s) => s.nouvelles.includes('axe_g'))!.deduites).toEqual(['axe_g'])
  })
  it('chaque pièce est posée une seule fois, les gabarits jamais', () => {
    const toutes = steps.flatMap((s) => s.nouvelles)
    expect(new Set(toutes).size).toBe(toutes.length)
    expect(toutes).toHaveLength(PIECES.length - 1)
    expect(toutes).not.toContain('telephone')
    expect(steps[steps.length - 1].visibles).toHaveLength(PIECES.length - 1)
  })
  it('sans géométrie : égalité au premier geste, pièce non nommée à la vue d’ensemble', () => {
    const sans = montageSteps(FICHE, PIECES, NOMENCLATURE)
    expect(sans.find((s) => s.nouvelles.includes('cale_cellule_1'))!.titre).toBe('Coller les cales de mousse des flancs')
    expect(sans[sans.length - 1].nouvelles).toEqual(expect.arrayContaining(['port', 'axe_g']))
    expect(sans.flatMap((s) => s.deduites)).toEqual([])
  })
  it('une étape structurée nomme ses pièces elle-même (nom ou famille)', () => {
    const s = montageSteps([{ titre: 'Visser le couvercle', astuce: 'sans forcer', pieces: ['couvercle', 'vis'] }, 'Poser la cellule.'], PIECES, NOMENCLATURE)
    expect(s[0]).toMatchObject({ titre: 'Visser le couvercle', astuce: 'sans forcer', nouvelles: ['couvercle', 'vis_a', 'vis_b'] })
    expect(s[1].nouvelles).toEqual(['cellule', 'cale_cellule_1'])
    expect(s[0].reprises).toEqual([])
  })
  it('une étape structurée qui renomme une pièce déjà posée la manipule sans la reposer', () => {
    const s = montageSteps([{ titre: 'Imprimer le couvercle', pieces: ['couvercle'] }, { titre: 'Engager les tenons', pieces: ['couvercle'] }, { titre: 'Empiler', pieces: ['corps', 'couvercle'] }], PIECES, NOMENCLATURE)
    expect([s[0].nouvelles, s[0].reprises]).toEqual([['couvercle'], []])
    expect([s[1].nouvelles, s[1].reprises]).toEqual([[], ['couvercle']])
    expect([s[2].nouvelles, s[2].reprises]).toEqual([['corps'], ['couvercle']])
  })
  it('une fiche mal formée ne casse rien : seules les étapes de la bonne forme comptent', () => {
    const sale = ['Poser la cellule.', null, 3, { astuce: 'sans titre' }, { titre: 'Visser', pieces: 'vis' }] as unknown as string[]
    const s = montageSteps(sale, PIECES, NOMENCLATURE)
    expect(s.map((x) => x.titre)).toEqual(['Poser la cellule', 'Visser', 'Vue d’ensemble'])
    expect(montageSteps('une phrase' as unknown as string[], PIECES, NOMENCLATURE)).toEqual([])
    expect(montageSteps(undefined as unknown as string[], PIECES, NOMENCLATURE)).toEqual([])
  })
  it('pas de fiche, pas de montage', () => {
    expect(montageSteps([], PIECES, NOMENCLATURE, BOITES)).toEqual([])
  })
})

describe('états et libellés d’un geste', () => {
  const steps = montageSteps(['Poser les inserts dans le corps.', 'Glisser la cellule.'], PIECES, NOMENCLATURE)
  it('pièces du geste et déjà posées affichées, les suivantes cachées', () => {
    const e = montageEtats(PIECES, steps[1])
    expect([e.cellule, e.corps, e.couvercle, e.telephone]).toEqual(['shown', 'shown', 'hidden', 'hidden'])
  })
  it('option fantôme : ce qui est déjà posé laisse voir à travers', () => {
    expect(montageEtats(PIECES, steps[1], true).corps).toBe('ghost')
  })
  it('regroupe par famille', () => {
    expect(compterFamilles(['insert_a', 'insert_b', 'corps', 'cale_cellule_1'], NOMENCLATURE.map((a) => a.cle))).toEqual(['2 × insert', 'corps', 'cale cellule 1'])
  })
})

describe('d’où arrive une pièce', () => {
  const base = boiteDeBase(PIECES, BOITES)!
  it('la base est la plus grosse pièce imprimée', () => {
    expect(base).toEqual(BOITES.corps)
    expect(boiteDeBase([], {})).toBeNull()
  })
  it('l’objet fini ne compte ni les gabarits ni l’outil imprimé posé à côté', () => {
    const produit = piecesProduit(PIECES, BOITES)
    expect(produit).not.toContain('gabarit_pliage')
    expect(produit).not.toContain('telephone')
    expect(produit).toEqual(expect.arrayContaining(['corps', 'couvercle', 'bequille', 'cellule', 'patin_dos_1']))
    expect(piecesProduit(PIECES, {})).toHaveLength(PIECES.length - 1)
  })
  it('par la grande face ouverte pour ce qui est dedans, par le dos pour ce qui est au dos', () => {
    expect(insertionDir(BOITES.cellule, base)).toEqual([0, 0, 1])
    expect(insertionDir(BOITES.vis_a, base)).toEqual([0, 0, 1])
    expect(insertionDir(BOITES.bequille, base)).toEqual([0, 0, -1])
    expect(insertionDir(BOITES.cale_enrouleur_gauche_1, base)).toEqual([0, 0, 1])
  })
  it('par la face contre laquelle elle est posée dehors', () => {
    expect(insertionDir(BOITES.patin_dos_1, base)).toEqual([0, -1, 0])
    expect(insertionDir(BOITES.gabarit_pliage, base)).toEqual([1, 0, 0])
  })
  it('le décalage de départ suit cette direction, la vue aussi', () => {
    const o = slideOffsets(['cellule', 'bequille', 'absente'], BOITES, base)
    expect(o.cellule[2]).toBeCloseTo(99)
    expect(o.bequille[2]).toBeCloseTo(-99)
    expect([o.cellule[0], o.cellule[1]]).toEqual([0, 0])
    expect(o.absente).toBeUndefined()
    expect(dirDuGeste(['vis_a', 'vis_b', 'patin_dos_1'], BOITES, base)).toEqual([0, 0, 1])
    expect(slideOffsets(['cellule'], BOITES, null)).toEqual({})
  })
})
