// Démo : moments de la lumière 3d et source de palette. Aucun lecteur de musique en démonstration ;
// les moments se modifient comme sur la vraie app et sont retenus jusqu'au rechargement.
// Les moments de départ recopient lib/spatial_moments.moments_de_depart (API), mêmes identifiants.
import type { MockHandler } from '../router'

type Moment = { id: string; nom: string; scene: string; intensite: number }

// scènes de départ du pad (mêmes identifiants et noms que lib/spatial.scenes_de_depart)
const SCENES = ['kick', 'balayage', 'montée', 'tournoi', 'marée', 'phare', 'tempête', 'vague de fond', 'raz de marée', 'arc-en-ciel', 'neutron']
  .map((nom, i) => ({ id: `depart${String(i + 1).padStart(2, '0')}`, nom }))

let moments: Moment[] = [
  { id: 'moment01', nom: 'soirée film', scene: 'depart04', intensite: 35 },
  { id: 'moment02', nom: 'repas', scene: 'depart08', intensite: 55 },
  { id: 'moment03', nom: 'réveil', scene: 'depart03', intensite: 60 },
  { id: 'moment04', nom: 'nuit', scene: 'depart05', intensite: 15 },
]
let n = 0

export const lumiereSource: [string, string, MockHandler][] = [
  ['GET', '/spatial/source/lecture', () => ({ disponible: false, pochette: false, raison: 'mode démo : aucun lecteur de musique relié' })],
  ['GET', '/moments-lumiere', () => ({
    moments: moments.map((m) => ({ ...m, scene_ok: SCENES.some((s) => s.id === m.scene) })), scenes: SCENES, max: 24,
  })],
  ['PUT', '/moments-lumiere/:id', ({ params, body }) => {
    const m = (body as { moment: Omit<Moment, 'id'> }).moment
    if (!m?.nom?.trim()) return { success: false, error: 'moment : un nom de 1 à 40 caractères' }
    if (params.id === 'new') { const id = `mdemo${n++}`; moments = [...moments, { ...m, id }]; return { success: true, id } }
    moments = moments.map((x) => (x.id === params.id ? { ...m, id: x.id } : x))
    return { success: true, id: params.id }
  }],
  ['DELETE', '/moments-lumiere/:id', ({ params }) => {
    moments = moments.filter((x) => x.id !== params.id)
    return { success: true }
  }],
  ['POST', '/moments-lumiere/:id/jouer', () => ({ success: false, error: 'mode démo : pas de vraies lampes' })],
]
