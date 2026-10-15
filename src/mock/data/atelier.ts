// Démo de l'atelier 3D : un petit boîtier fictif, ses pièces fabriquées ici en STL binaire
// (des pavés), ses contrôles et ses itérations. Aucune donnée réelle.

type Box = { nom: string; groupe: 'pieces' | 'composants' | 'gabarits'; min: [number, number, number]; max: [number, number, number] }
const BOXES: Box[] = [
  { nom: 'corps', groupe: 'pieces', min: [-40, -60, 0], max: [40, 60, 6] },
  { nom: 'couvercle', groupe: 'pieces', min: [-40, -60, 16], max: [40, 60, 19] },
  { nom: 'bequille', groupe: 'pieces', min: [-30, -58, -4], max: [30, -20, -1] },
  { nom: 'cellule', groupe: 'composants', min: [-32, -20, 6], max: [32, 50, 15] },
  { nom: 'module', groupe: 'composants', min: [-30, -52, 6], max: [10, -26, 10] },
  { nom: 'vis_hg', groupe: 'composants', min: [-38, 54, 6], max: [-35, 57, 19] },
  { nom: 'vis_hd', groupe: 'composants', min: [35, 54, 6], max: [38, 57, 19] },
  { nom: 'vis_bg', groupe: 'composants', min: [-38, -57, 6], max: [-35, -54, 19] },
  { nom: 'vis_bd', groupe: 'composants', min: [35, -57, 6], max: [38, -54, 19] },
  { nom: 'cale_cellule_+x', groupe: 'composants', min: [32, 0, 6], max: [33, 8, 14] },
  { nom: 'cale_cellule_+y', groupe: 'composants', min: [-4, 50, 6], max: [4, 51, 14] },
  { nom: 'telephone', groupe: 'gabarits', min: [-38, -78, 19], max: [38, 78, 27] },
]

function boxStl({ min, max }: Box): ArrayBuffer {
  const [x0, y0, z0] = min, [x1, y1, z1] = max
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [3, 0, 4], [3, 4, 7]]
  const buffer = new ArrayBuffer(84 + faces.length * 50)
  const view = new DataView(buffer)
  view.setUint32(80, faces.length, true)
  faces.forEach((f, i) => {
    const at = 84 + i * 50
    f.forEach((vi, k) => v[vi].forEach((c, j) => view.setFloat32(at + 12 + k * 12 + j * 4, c, true)))
  })
  return buffer
}

export function demoStl(path: string): ArrayBuffer {
  const chemin = decodeURIComponent(new URLSearchParams(path.split('?')[1] ?? '').get('chemin') ?? '')
  const nom = chemin.split('/').pop()?.replace(/\.stl$/, '') ?? ''
  const box = BOXES.find((b) => b.nom === nom)
  if (!box) throw new Error(`mode démo : pièce ${nom} sans géométrie`)
  return boxStl(box)
}

const C = (nom: string, ok: boolean, nature: string, mesure: number, limite: number, detail = '') => ({ nom, ok, mesure, limite, detail, nature })
const controles = [
  C('solide:corps', true, 'geometrie', 1, 1), C('solide:couvercle', true, 'geometrie', 1, 1), C('interference:corps:couvercle', true, 'geometrie', 0, 0),
  C('interference:corps:cellule', true, 'geometrie', 0, 0), C('retenue_cellule:+x', true, 'geometrie', 1.2, 0.5), C('paroi:corps:flanc', true, 'geometrie', 1.6, 1.2),
  C('enveloppe:hauteur', true, 'spec', 120, 125), C('jeu:couvercle', true, 'spec', 0.3, 0.2),
  C('resistance:bequille_flexion', false, 'calcul', 2.1, 3, '22.8 pour 48 admissible, coefficient 2.10 ; MPa ; au pied de la béquille, téléphone de 240 g en appui'),
  C('cisaillement:vis', true, 'calcul', 4.1, 18), C('bascule:portrait', true, 'indicateur', 38, 0, 'angle de bascule avec un téléphone de 240 g'),
]
const decompte = { geometrie: { ok: 6, total: 6 }, spec: { ok: 2, total: 2 }, calcul: { ok: 1, total: 2 }, indicateur: { ok: 1, total: 1 } }
const pieces = BOXES.map((b) => ({ nom: b.nom, groupe: b.groupe, chemin: b.groupe === 'pieces' ? `${b.nom}.stl` : `${b.groupe}/${b.nom}.stl` }))
const iterations = [
  { numero: 1, verdict: 'Reboucler : béquille non porteuse' },
  { numero: 2, verdict: 'Reboucler : jeu du couvercle trop serré' },
  { numero: 3, verdict: 'Présenter : 10 contrôles sur 11, un calcul à arbitrer' },
]
const resume = {
  pieces_imprimees: [
    { nom: 'corps', designation: 'corps (dos, flancs, logements)', quantite: 1, volume_cm3: 41.2, masse_g: 51.1 },
    { nom: 'couvercle', designation: 'couvercle', quantite: 1, volume_cm3: 22.6, masse_g: 28 },
    { nom: 'bequille', designation: 'béquille', quantite: 1, volume_cm3: 6.1, masse_g: 7.6 },
  ],
  nomenclature: [
    { cle: 'vis', quantite: 4, designation: 'vis M2x6 tête cylindrique, inox' },
    { cle: 'cale', quantite: 2, designation: 'cale de mousse adhésive ép. 1.0' },
    { cle: 'cellule', quantite: 1, designation: 'cellule lithium-polymère 5 000 mAh' },
    { cle: 'module', quantite: 1, designation: 'carte de gestion USB-C' },
  ],
  montage: ['1. Coller les cales dans le corps, puis poser la cellule (étiquette vers le haut).', '2. Brancher puis glisser le module : le port vers le bas.', '3. Fermer le couvercle et serrer les 4 vis.', '4. Clipser la béquille au dos.'],
  prix: {
    releve_le: '2026-10-11', devise: 'EUR', note: 'Prix fictifs de démonstration.',
    articles: {
      vis: { nom_recherche: 'vis M2x6 inox tête cylindrique', conditionnement: 'lot de 25', prix_lot_min: 4.5, prix_lot_max: 6, plateformes: ['boutique a', 'boutique b'], confiance: 'haute' },
      cale: { nom_recherche: 'mousse EVA autocollante 1 mm', conditionnement: 'lot de 8 plaques', prix_lot_min: 8, prix_lot_max: 14, plateformes: ['boutique a'], confiance: 'moyenne' },
      cellule: { nom_recherche: '3.7V 5000mAh lipo', conditionnement: "à l'unité", prix_lot_min: 9, prix_lot_max: 15, plateformes: ['boutique c'], confiance: 'basse', remarque: 'cotes à vérifier avant achat' },
    },
  },
}
const jeu = (iteration: string) => ({
  nom: 'boitier_demo', courant: { numero: 4, etape: 'Terminée, en attente de tes décisions' }, iterations, iteration,
  pieces: iteration === '1' ? pieces.filter((p) => p.nom !== 'bequille') : pieces, images: [], documents: [], impression: [], decoupes: [],
  controles: iteration === '2' ? controles.map((c) => (c.nom === 'jeu:couvercle' ? { ...c, ok: false, mesure: 0.1 } : c)) : controles,
  decompte, resume, maj: 1,
})
let demandes: { id: string; le: string; numero: number; texte: string; pieces: string[]; refs: number[] }[] = [
  { id: '20261010-101500', le: '2026-10-10T10:15:00', numero: 3, texte: 'desserrer le jeu du couvercle, il force à la fermeture', pieces: ['couvercle', 'corps'], refs: [2] },
  { id: '20261009-183000', le: '2026-10-09T18:30:00', numero: 2, texte: 'la béquille plie sous le téléphone : la rendre porteuse', pieces: ['bequille'], refs: [] },
]

let projets = ['boitier_demo']
let masques: string[] = []

type Ctx = { params: Record<string, string>; query: URLSearchParams; body: unknown }
export const ATELIER_ROUTES: [string, string, (ctx: Ctx) => unknown][] = [
  ['GET', '/modelisation', () => ({ modeles: projets.filter((p) => !masques.includes(p)).map((nom) => ({ nom, courant: nom === 'boitier_demo' ? jeu('courant').courant : {}, iterations: nom === 'boitier_demo' ? iterations : [] })), masques })],
  ['POST', '/modelisation/projets', ({ body }) => {
    const { nom } = body as { nom: string }
    if (projets.includes(nom)) throw new Error(`un projet ${nom} existe deja`)
    projets = [...projets, nom]
    return { success: true, nom }
  }],
  ['POST', '/modelisation/projets/:modele/retirer', ({ params, body }) => {
    const mode = (body as { mode: string }).mode
    if (mode === 'complet') projets = projets.filter((p) => p !== params.modele); else masques = [...masques, params.modele]
    return { success: true, mode }
  }],
  ['POST', '/modelisation/projets/:modele/remettre', ({ params }) => { masques = masques.filter((m) => m !== params.modele); return { success: true } }],
  ['GET', '/modelisation/tache', () => ({ etat: 'repos' })],
  ['GET', '/modelisation/sessions', () => ({ cwd: '', vivantes: {}, recentes: [], courants: {} })],
  ['GET', '/modelisation/:modele/demandes', () => ({
    iterations: iterations.map((it) => ({ ...it, demandes: demandes.filter((d) => d.numero === it.numero) })),
    en_cours: demandes.filter((d) => d.numero > 3), suivant: 5,
  })],
  ['POST', '/modelisation/:modele/boucle', ({ body }) => {
    const d = (body as { demande: { texte: string; pieces: string[]; refs: number[] } }).demande
    const id = `demo-${demandes.length}`
    demandes = [{ id, le: '2026-10-11T18:00:00', numero: 5, texte: d.texte, pieces: d.pieces, refs: d.refs }, ...demandes]
    return { success: true, id, numero: 5, started: 0, cwd: '', demo: true }
  }],
  ['GET', '/modelisation/:modele', ({ params, query }) => (params.modele === 'boitier_demo' ? jeu(query.get('iteration') ?? 'courant')
    : { nom: params.modele, courant: {}, iterations: [], iteration: 'courant', pieces: [], images: [], documents: [], impression: [], decoupes: [], controles: [], decompte: {}, resume: null, maj: 0 })],
]
