// Lumière 3d de démonstration : huebeat arrêté (pas de vraies lampes), mais le pad, les sets et
// les réglages communs se modifient comme sur la vraie app et sont retenus jusqu'au rechargement.
// Les scènes de départ sont celles de l'API (lib/spatial.scenes_de_depart), mêmes identifiants.
import type { MockHandler } from '../router'

type Scene = Record<string, unknown> & { id: string; nom: string }
type Jeu = { id: string; nom: string; pas: { scene: string; mesures: number }[]; boucle: boolean }

const scene = (i: number, nom: string, effets: string[], palette: string, axe: string, src: [number, number, number], extra: Record<string, unknown> = {}): Scene => ({
  id: `depart${String(i).padStart(2, '0')}`, nom, effets, palette, axe, source: { x: src[0], y: src[1], z: src[2] },
  intensite: 100, depart: 'bas', mode: '3d', groupe: 'tous', ...extra,
})

let scenes: Scene[] = [
  scene(1, 'kick', ['onde'], 'neon', 'x', [50, 30, 35]),
  scene(2, 'balayage', ['mur'], 'cool', 'x', [50, 30, 35]),
  scene(3, 'montée', ['mur'], 'sunset', 'z', [50, 30, 35]),
  scene(4, 'tournoi', ['orbite'], 'maison', 'x', [50, 30, 35]),
  scene(5, 'marée', ['maree'], 'arctic', 'x', [50, 30, 35]),
  scene(6, 'phare', ['phare'], 'fire', 'x', [50, 50, 40]),
  scene(7, 'tempête', ['onde', 'phare'], 'neon', 'x', [50, 30, 35]),
  // exemple de réglages propres à chaque effet : une marée lente sous une source mobile qui respire
  scene(8, 'vague de fond', ['maree', 'orbite'], 'sunset', 'x', [50, 30, 35], {
    reglages: { maree: { tempo: 0.5, palette: 'arctic' }, orbite: { respiration: { profondeur: 70, attaque: 40, retombee: 70, vie: 34 }, source: { x: 30, y: 60, z: 50 } } },
  }),
  scene(9, 'raz de marée', ['raz'], 'cool', 'x', [50, 20, 35]),
  scene(10, 'arc-en-ciel', ['raz'], 'arcenciel', 'x', [50, 50, 50]),
  scene(11, 'neutron', ['onde', 'phare'], 'neutron', 'x', [73, 3, 50], { mode: '2d', groupe: 'alterne' }),
]
let sets: Jeu[] = [{ id: 'demoset1', nom: 'montée en puissance', boucle: true, pas: [{ scene: 'depart05', mesures: 4 }, { scene: 'depart08', mesures: 4 }, { scene: 'depart07', mesures: 2 }] }]
type MixDemo = { id: string; nom: string; couches: { scene: string; canaux?: string[] }[] }
let mixes: MixDemo[] = []
let commun: Record<string, unknown> = { intensite: 100, sensibilite: 68, attaque: 0, retombee: 60, profondeur: 0, plancher: 0, vie: 0 }
let peripherique = ''
let n = 0
const nouvelId = () => `demo${Date.now().toString(36)}${n++}`

export const lumiere: [string, string, MockHandler][] = [
  ['GET', '/spatial/ecoute', () => ({ actif: false, pas_ms: 30, plancher: 0, niveaux: [], seuils: [], pris: [] })],
  ['GET', '/spatial', () => ({
    huebeat: { actif: false }, reel: null, sets, scenes, mixes, commun, peripherique,
    peripheriques: [{ nom: 'tele.monitor', label: 'Philips TV', genre: 'sortie', actif: true }, { nom: 'micro.interne', label: 'carte son interne', genre: 'micro', actif: false }],
    canaux: { canaux: {}, noms: {}, manquants: [] },
  })],
  ['PUT', '/spatial/commun', ({ body }) => { commun = { ...commun, ...(body as { commun?: object })?.commun }; return { success: true } }],
  ['PUT', '/spatial/peripherique', ({ body }) => { peripherique = String((body as { nom?: unknown })?.nom ?? ''); return { success: true } }],
  ['PUT', '/spatial/scenes/ordre', ({ body }) => {
    const ordre = (body as { ordre?: string[] })?.ordre ?? []
    const rang = (id: string) => { const i = ordre.indexOf(id); return i < 0 ? ordre.length : i }
    scenes = [...scenes].sort((a, b) => rang(a.id) - rang(b.id))
    return { success: true }
  }],
  ['PUT', '/spatial/scenes/:id', ({ params, body }) => {
    const s = (body as { scene: Scene }).scene
    if (params.id === 'new') { const id = nouvelId(); scenes = [...scenes, { ...s, id }]; return { success: true, id } }
    scenes = scenes.map((x) => (x.id === params.id ? { ...s, id: x.id } : x))
    return { success: true, id: params.id }
  }],
  ['PUT', '/spatial/sets/:id', ({ params, body }) => {
    const j = (body as { jeu: Omit<Jeu, 'id'> }).jeu
    if (params.id === 'new') { const id = nouvelId(); sets = [...sets, { ...j, id }]; return { success: true, id } }
    sets = sets.map((x) => (x.id === params.id ? { ...j, id: x.id } : x))
    return { success: true, id: params.id }
  }],
  ['PUT', '/spatial/mixes/:id', ({ params, body }) => {
    const m = (body as { mix: Omit<MixDemo, 'id'> }).mix
    if (!m?.nom?.trim() || !Array.isArray(m.couches) || m.couches.length === 0) return { success: false, error: 'un mix a un nom et de 1 à 6 couches' }
    if (m.couches.some((c) => !scenes.some((s) => s.id === c.scene))) return { success: false, error: 'couche : scène inconnue' }
    if (params.id === 'new') { const id = nouvelId(); mixes = [...mixes, { ...m, id }]; return { success: true, id } }
    mixes = mixes.map((x) => (x.id === params.id ? { ...m, id: x.id } : x))
    return { success: true, id: params.id }
  }],
  ['DELETE', '/spatial/:quoi/:id', ({ params }) => {
    if (params.quoi === 'scenes') scenes = scenes.filter((x) => x.id !== params.id)
    if (params.quoi === 'sets') { sets = sets.filter((x) => x.id !== params.id) }
    if (params.quoi === 'mixes') mixes = mixes.filter((x) => x.id !== params.id)
    sets = sets.map((j) => ({ ...j, pas: j.pas.filter((p) => scenes.some((s) => s.id === p.scene)) }))
    // une scène retirée sort des mix ; un mix sans couche disparaît (comme l'API)
    mixes = mixes.map((m) => ({ ...m, couches: m.couches.filter((c) => scenes.some((s) => s.id === c.scene)) })).filter((m) => m.couches.length > 0)
    return { success: true }
  }],
  // sans vraies lampes : le grand bouton répond comme l'API quand huebeat ne peut pas démarrer
  ['POST', '/spatial/direct', () => ({ success: false, error: 'mode démo : pas de vraies lampes, l’aperçu de la pièce 3d reste disponible' })],
  ['POST', '/spatial/reel', () => ({ success: false, error: 'mode démo : pas de vraies lampes' })],
  ['POST', '/spatial/pause', () => ({ success: false, error: 'rien ne joue sur les vraies lampes' })],
]
