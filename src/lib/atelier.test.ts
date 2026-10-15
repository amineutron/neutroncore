import { describe, expect, it } from 'vitest'
import {
  buildDemande, centroid, controlsDiff, controlsSummary, defaultEtats, demandeError, etapeIndex, lireAttente, piecesCitees, piecesDuPoint, piecesEnAvant, etatCommun, explodeOffsets, familyOf,
  filterControls, focusEtats, groupPieces, isolerEtats, materialRows, materialTotal, mergeEtats, mesureLabel, nextEtat, piecesOfControl, rangeSelection, slugProjet, axeHaut,
  priceRange, setEtat, toggleSelection, verdictTone, type Controle, type Piece, type Vec3,
} from './atelier'

const P = (nom: string, groupe: Piece['groupe'] = 'composants'): Piece => ({ nom, groupe, chemin: `${nom}.stl` })
const PIECES = [P('corps', 'pieces'), P('couvercle', 'pieces'), P('vis_bcd'), P('vis_hg'), P('cale_cellule_+x'), P('cellule'), P('port_recharge'), P('zone_libre', 'gabarits')]
const CLES = ['vis', 'insert', 'cale', 'cellule', 'module']

describe('états des pièces', () => {
  it('trois états en boucle', () => {
    expect(['shown', 'ghost', 'hidden'].map((e) => nextEtat(e as 'shown'))).toEqual(['ghost', 'hidden', 'shown'])
  })
  it('au départ tout est affiché sauf les gabarits', () => {
    const e = defaultEtats(PIECES)
    expect(e.corps).toBe('shown')
    expect(e.zone_libre).toBe('hidden')
  })
  it('changer d’itération garde les réglages des pièces qui existent encore', () => {
    const e = mergeEtats({ corps: 'ghost', disparue: 'hidden' }, [P('corps', 'pieces'), P('neuve')])
    expect(e).toEqual({ corps: 'ghost', neuve: 'shown' })
  })
  it('un nom inconnu n’est pas ajouté', () => {
    expect(setEtat({ a: 'shown' }, ['a', 'fantome'], 'hidden')).toEqual({ a: 'hidden' })
  })
  it('état commun d’une famille', () => {
    expect(etatCommun({ a: 'ghost', b: 'ghost' }, ['a', 'b'])).toBe('ghost')
    expect(etatCommun({ a: 'ghost', b: 'shown' }, ['a', 'b'])).toBe('mixed')
  })
  it('focus : sélection affichée, reste en fantôme, caché reste caché', () => {
    expect(focusEtats({ a: 'ghost', b: 'shown', c: 'hidden' }, ['a'])).toEqual({ a: 'shown', b: 'ghost', c: 'hidden' })
    expect(focusEtats({ a: 'ghost' }, [])).toEqual({ a: 'ghost' })
  })
  it('isoler : seule la sélection reste', () => {
    expect(isolerEtats({ a: 'ghost', b: 'shown' }, ['a'])).toEqual({ a: 'shown', b: 'hidden' })
  })
  it('sélection simple et multiple', () => {
    expect(toggleSelection(['a'], 'b', false)).toEqual(['b'])
    expect(toggleSelection(['a'], 'a', false)).toEqual([])
    expect(toggleSelection(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleSelection(['a', 'b'], 'a', true)).toEqual(['b'])
    expect(toggleSelection(['a', 'b'], 'a', false)).toEqual(['a'])
  })
})

describe('familles', () => {
  it.each([
    ['vis_bcd', 'vis'], ['cale_cellule_+x', 'cale'], ['cellule', 'cellule'], ['port_recharge', 'port_recharge'], ['visiere', 'visiere'],
  ])('%s → %s', (nom, famille) => {
    expect(familyOf(nom, CLES)).toBe(famille)
  })
  it('regroupe les composants, pas les pièces imprimées', () => {
    const g = groupPieces(PIECES, CLES)
    expect(g.map((x) => x.groupe)).toEqual(['pieces', 'composants', 'gabarits'])
    expect(g[0].familles.map((f) => f.cle)).toEqual(['corps', 'couvercle'])
    expect(g[1].familles.find((f) => f.cle === 'vis')?.pieces).toHaveLength(2)
  })
})

describe('éclaté', () => {
  const centers: Record<string, Vec3> = { a: [10, 0, 0], b: [0, 20, 0], c: [0, 0, 0] }
  it('chaque pièce s’éloigne de l’origine, proportionnellement', () => {
    const o = explodeOffsets(centers, [0, 0, 0], 0.5)
    expect(o.a).toEqual([5, 0, 0])
    expect(o.b).toEqual([0, 10, 0])
  })
  it('une pièce posée sur l’origine part quand même', () => {
    expect(explodeOffsets(centers, [0, 0, 0], 1).c).not.toEqual([0, 0, 0])
  })
  it('un écart commun sépare aussi deux pièces empilées près du centre', () => {
    const pile = { bac: [0, -1, 0] as Vec3, couvercle: [0, 1, 0] as Vec3 }
    expect(explodeOffsets(pile, [0, 0, 0], 1).couvercle).toEqual([0, 1, 0])
    expect(explodeOffsets(pile, [0, 0, 0], 1, [], 40).couvercle).toEqual([0, 41, 0])
    expect(explodeOffsets(pile, [0, 0, 0], 0.5, [], 40).bac).toEqual([0, -20.5, 0])
  })
  it('la sélection autour de laquelle on éclate ne bouge pas', () => {
    expect(explodeOffsets(centers, [10, 0, 0], 1, ['a']).a).toEqual([0, 0, 0])
  })
  it('facteur nul : rien ne bouge', () => {
    expect(Object.values(explodeOffsets(centers, [1, 1, 1], 0))).toEqual([[0, 0, 0], [0, 0, 0], [0, 0, 0]])
  })
  it('centre de plusieurs pièces', () => {
    expect(centroid(centers, ['a', 'b'])).toEqual([5, 10, 0])
    expect(centroid(centers, ['inconnue'])).toBeNull()
  })
  it('mesure entre deux points', () => {
    expect(mesureLabel([0, 0, 0], [3, 4, 0])).toEqual({ total: '5,0 mm', axes: 'x 3,0 · y 4,0 · z 0,0' })
  })
})

const C = (nom: string, ok: boolean, nature = 'geometrie', detail = ''): Controle => ({ nom, ok, mesure: 1, limite: 2, detail, nature })

describe('contrôles', () => {
  it('décompte par nature, dans l’ordre', () => {
    const s = controlsSummary({ calcul: { ok: 32, total: 35 }, geometrie: { ok: 446, total: 446 }, inconnue: { ok: 1, total: 1 } })
    expect(s.parNature.map((n) => n.cle)).toEqual(['geometrie', 'calcul'])
    expect(s).toMatchObject({ ok: 478, total: 481, echecs: 3 })
  })
  it('échecs d’abord, filtre par texte, nature et échec', () => {
    const list = [C('b:ok', true), C('a:ko', false, 'calcul', 'paroi fine'), C('c:ok', true, 'spec')]
    expect(filterControls(list, { q: '', nature: '', echecs: false }).map((c) => c.nom)).toEqual(['a:ko', 'b:ok', 'c:ok'])
    expect(filterControls(list, { q: 'PAROI', nature: '', echecs: false }).map((c) => c.nom)).toEqual(['a:ko'])
    expect(filterControls(list, { q: '', nature: 'spec', echecs: false }).map((c) => c.nom)).toEqual(['c:ok'])
    expect(filterControls(list, { q: '', nature: '', echecs: true })).toHaveLength(1)
  })
  it('retrouve les pièces nommées dans un contrôle', () => {
    const noms = PIECES.map((p) => p.nom)
    expect(piecesOfControl('interference:corps:couvercle', noms)).toEqual(['corps', 'couvercle'])
    expect(piecesOfControl('retenue_cellule:+x', noms)).toEqual(['cellule'])
    expect(piecesOfControl('assemblage:composants_presents', noms)).toEqual([])
    // mots entiers : pas de pièce trouvée dans un morceau de mot
    expect(piecesOfControl('surface_min', ['face'])).toEqual([])
    expect(piecesOfControl('interface:x', ['face'])).toEqual([])
    expect(piecesOfControl('jeu:cale_cellule_+x', noms)).toEqual(['cale_cellule_+x', 'cellule'])
  })
  it('compare deux itérations', () => {
    const d = controlsDiff([C('a', false), C('b', true), C('vieux', true)], [C('a', true), C('b', false), C('neuf', true)])
    expect(d).toEqual({ repares: ['a'], casses: ['b'], nouveaux: ['neuf'], disparus: ['vieux'] })
  })
})

describe('matériaux', () => {
  const resume = {
    nomenclature: [{ cle: 'vis', quantite: 6, designation: 'vis M2x6' }, { cle: 'cellule', quantite: 1, designation: 'LP9065113' }, { cle: 'patin', quantite: 4, designation: 'patin' }],
    prix: { articles: { vis: { nom_recherche: 'vis M2x6 inox', prix_lot_min: 3, prix_lot_max: 6, plateformes: ['a'] }, cellule: { prix_lot_min: 12 }, patin: { prix_lot_min: -1, prix_lot_max: Number.NaN } } },
  }
  it('le nom à copier est celui du relevé, sinon la désignation', () => {
    const rows = materialRows(resume)
    expect(materialRows({ nomenclature: [{ cle: 'cellule', quantite: 1, designation: 'LP9065113' }], prix: { articles: { cellule: { nature: ' batterie ' } } } })[0].nature).toBe('batterie')
    expect(rows.every((r) => r.nature === '')).toBe(true)
    expect(rows.map((r) => r.recherche)).toEqual(['vis M2x6 inox', 'LP9065113', 'patin'])
  })
  it('total en fourchette, les prix absurdes ou absents sont comptés comme manquants', () => {
    expect(materialTotal(materialRows(resume))).toEqual({ min: 15, max: 18, manquants: 1 })
  })
  it('sans relevé : rien n’est inventé', () => {
    const rows = materialRows({ nomenclature: resume.nomenclature, prix: null })
    expect(materialTotal(rows)).toEqual({ min: 0, max: 0, manquants: 3 })
    expect(priceRange(rows[0].min, rows[0].max)).toBe('prix non relevé')
  })
  it('un article livré avec un autre n’est pas compté comme manquant', () => {
    const rows = materialRows({ nomenclature: [{ cle: 'fiche', quantite: 2, designation: 'fiche' }], prix: { articles: { fiche: { inclus: true } } } })
    expect(materialTotal(rows).manquants).toBe(0)
    expect(priceRange(rows[0].min, rows[0].max, rows[0].inclus)).toBe('inclus')
  })
  it('fourchette lisible', () => {
    expect(priceRange(3, 6)).toBe('3,00 € – 6,00 €')
    expect(priceRange(12, null)).toBe('12,00 €')
  })
})

describe('pipeline et demande', () => {
  it.each([
    ['recherche-3d', 0], ['concept-3d', 1], ['test-3d', 2], ['contrôle-3d', 3], ['Terminée, en attente de tes décisions', 4], ['', -1], ['autre chose', -1],
  ])('étape « %s » → %i', (etape, i) => {
    expect(etapeIndex(etape)).toBe(i)
  })
  it('ton du verdict', () => {
    expect(['Présenter : ok', 'Reboucler : x', 'Escalader : y', 'autre'].map(verdictTone)).toEqual(['ok', 'warn', 'crit', ''])
  })
  it('la demande nomme les pièces et les itérations de référence', () => {
    const d = { modele: 'batterie_support', texte: '  la jonction baille  ', pieces: ['corps', 'couvercle'], refs: [3, 1] }
    expect(buildDemande(d)).toBe('la jonction baille\nPièces concernées : corps, couvercle.\nItérations de référence : 1, 3 (sorties/batterie_support/iterations/<n>/).')
    expect(demandeError(d)).toBe('')
    expect(demandeError({ ...d, texte: ' ' })).toContain('écris')
    expect(demandeError({ ...d, texte: 'x'.repeat(2100) })).toContain('trop longue')
  })
})

describe('sélection par plage dans la liste', () => {
  const ordre = ['corps', 'couvercle', 'vis_a', 'vis_b', 'cellule']
  it('Maj + clic prend tout ce qui est entre la dernière pièce touchée et celle-ci', () => {
    expect(rangeSelection(ordre, 'couvercle', 'vis_b', [])).toEqual(['couvercle', 'vis_a', 'vis_b'])
    expect(rangeSelection(ordre, 'vis_b', 'corps', ['cellule'])).toEqual(['cellule', 'corps', 'couvercle', 'vis_a', 'vis_b'])
  })
  it('sans ancre, la pièce seule ; une pièce déjà prise ne se double pas', () => {
    expect(rangeSelection(ordre, null, 'vis_a', ['corps'])).toEqual(['corps', 'vis_a'])
    expect(rangeSelection(ordre, 'disparue', 'vis_a', [])).toEqual(['vis_a'])
    expect(rangeSelection(ordre, 'corps', 'couvercle', ['corps'])).toEqual(['corps', 'couvercle'])
    expect(rangeSelection(ordre, 'corps', 'inconnue', ['corps'])).toEqual(['corps'])
  })
})

describe('axe vertical du modèle', () => {
  it('le choix de l’utilisateur passe avant ce que dit le modèle, y par défaut', () => {
    expect(axeHaut(null, null)).toBe('y')
    expect(axeHaut(null, { haut: 'Z' })).toBe('z')
    expect(axeHaut('y', { haut: 'z' })).toBe('y')
    expect(axeHaut('z', null)).toBe('z')
    expect(axeHaut('x', { haut: 'n’importe quoi' })).toBe('y')
  })
})

describe('nom de projet', () => {
  it('fait un nom de dossier d’un titre libre', () => {
    expect(slugProjet('Support de casque')).toBe('support_de_casque')
    expect(slugProjet('  Étui — téléphone n°2 ! ')).toBe('etui_telephone_n_2')
    expect(slugProjet('3 petits clips')).toBe('petits_clips')
  })
  it('rien d’utilisable : vide ; trop long : coupé sans tiret final', () => {
    expect(slugProjet('  !!! 123 ')).toBe('')
    expect(slugProjet(`${'a'.repeat(63)} b`)).toBe('a'.repeat(63))
    expect(slugProjet('x'.repeat(90))).toHaveLength(64)
  })
})

describe('attente de la boucle', () => {
  it.each([
    [{ motif: 'probleme', texte: 'le build casse', points: ['a', '', 3] }, { motif: 'probleme', texte: 'le build casse', points: [{ texte: 'a', pieces: [], image: '', detail: '', recommande: '', options: [] }] }],
    [{ texte: ' trancher la batterie ' }, { motif: 'decision', texte: 'trancher la batterie', points: [] }],
    [{ motif: 'inconnu', texte: 'x', points: 'non' }, { motif: 'decision', texte: 'x', points: [] }],
    [{ motif: 'decision', texte: '  ' }, null],
    [undefined, null],
    ['attente', null],
  ])('lit %j', (brut, attendu) => {
    expect(lireAttente(brut)).toEqual(attendu)
  })
})

describe('questions illustrées de la boucle', () => {
  const NOMS = ['bequille', 'corps', 'couvercle', 'etrier', 'tourillon_droit', 'tourillon_gauche', 'cellule', 'led', 'patin_1']

  it('une question garde ses pièces, son mini-plan et ses options ; le reste est écarté', () => {
    const a = lireAttente({ texte: 'à trancher', points: [{ texte: ' Béquille : un cran ? ', pieces: ['bequille', 3, ''], image: 'questions/q1.png', detail: 'questions/q1_plan.png', recommande: 'a',
      options: [{ nom: 'a', texte: 'un cran', image: 'questions/q1_a.gif' }, { nom: 'b' }, { nom: 'c', texte: 'deux', image: '../secret.png' }, 'x'] }, { pieces: ['corps'] }, 7] })
    expect(a?.points).toEqual([{ texte: 'Béquille : un cran ?', pieces: ['bequille'], image: 'questions/q1.png', detail: 'questions/q1_plan.png', recommande: 'a',
      options: [{ nom: 'a', texte: 'un cran', image: 'questions/q1_a.gif' }, { nom: 'c', texte: 'deux', image: '' }] }])
  })

  it.each(['/etc/x.png', 'questions/q.svg', 'http://x/y.png', 'questions/../../a.png', 12])('refuse l’image %j', (image) => {
    expect(lireAttente({ texte: 'x', points: [{ texte: 'q', image }] })?.points[0].image).toBe('')
  })

  it('retrouve les pièces nommées dans une phrase, accents et pluriels compris', () => {
    expect(piecesCitees('Béquille : un seul cran, étrier a pincer', NOMS)).toEqual(['bequille', 'etrier'])
    expect(piecesCitees('Les tourillons et les clips du couvercle', NOMS)).toEqual(['couvercle', 'tourillon_droit', 'tourillon_gauche'])
    expect(piecesCitees('La led du corps', NOMS)).toEqual(['corps'])
    expect(piecesCitees('make test dure 19 minutes', NOMS)).toEqual([])
  })

  it('les pièces données par la boucle priment si elles existent', () => {
    expect(piecesDuPoint({ texte: 'Béquille trop souple', pieces: ['etrier', 'inconnue'] }, NOMS)).toEqual(['etrier'])
    expect(piecesDuPoint({ texte: 'Béquille trop souple', pieces: ['inconnue'] }, NOMS)).toEqual(['bequille'])
  })
})

describe('pièces mises en avant en mode fantôme', () => {
  const B = (min: Vec3, max: Vec3) => ({ min, max })
  const boites = { corps: B([-50, -80, -10], [50, 80, 10]), bequille: B([-20, -60, -8], [20, -20, -4]), etrier: B([-15, -30, -6], [15, -25, -2]), couvercle: B([-50, -80, 10], [50, 80, 12]) }

  it('le corps qui enveloppe la béquille devient le décor', () => {
    expect(piecesEnAvant(['bequille', 'etrier', 'corps'], boites)).toEqual(['bequille', 'etrier'])
  })

  it('une béquille dépliée qui sort du corps reste la pièce en avant', () => {
    expect(piecesEnAvant(['bequille', 'corps'], { ...boites, bequille: B([-20, -60, -60], [20, -20, -8]) })).toEqual(['bequille'])
  })

  it('un couvercle mince posé sur le corps ressort seul ; deux pièces de taille voisine restent en avant', () => {
    expect(piecesEnAvant(['couvercle', 'corps'], boites)).toEqual(['couvercle'])
    expect(piecesEnAvant(['bequille', 'jumelle'], { ...boites, jumelle: B([-20, -60, -4], [20, -20, 0]) })).toEqual(['bequille', 'jumelle'])
  })

  it('une pièce seule, ou sans boîte connue, reste en avant', () => {
    expect(piecesEnAvant(['corps'], boites)).toEqual(['corps'])
    expect(piecesEnAvant(['corps', 'inconnue'], boites)).toEqual(['corps', 'inconnue'])
  })
})
