// Studio caméra de démonstration : rien n'est filmé, mais la galerie, les scènes et les réglages se
// modifient comme sur la vraie app, en mémoire jusqu'au rechargement. Les images ne sont pas servies.
import type { MockHandler } from '../router'
import type { Prise, ReglagesScene, ReglagesStudio, Scene } from '../../lib/cameraStudio'

const BASE: ReglagesScene = { fond: { mode: 'flou', nom: '', flou: 55 }, detourage: { durete: 60, marge: 0, stabilite: 40 }, cadence: 30 }
let scenes: Scene[] = [
  { id: 'demo0001', nom: 'visio', reglages: BASE },
  { id: 'demo0002', nom: 'stream', reglages: { fond: { mode: 'prefait', nom: 'aubergine', flou: 55 }, detourage: { durete: 80, marge: 2, stabilite: 60 }, cadence: 60 } },
  { id: 'demo0003', nom: 'sans fond', reglages: { ...BASE, fond: { mode: 'aucun', nom: '', flou: 55 } } },
]
let prises: Prise[] = [
  { nom: 'clip-20261020-101500-12s.mp4', genre: 'video', taille: 1_900_000, date: 1792486500, duree: 12 },
  { nom: 'prise-20261020-092210.jpg', genre: 'image', taille: 48_000, date: 1792484530, duree: null },
  { nom: 'prise-20261019-181005.jpg', genre: 'image', taille: 51_000, date: 1792433405, duree: null },
]
let reglages: ReglagesStudio = { quota_mo: 500, max_prises: 150, fps: 15, duree: 10 }
let actuel: ReglagesScene = BASE
let n = 0

const egal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const etat = () => ({
  pret: true, message: '', moteur_actif: true, enregistrement: null, dernier: null, prises, reglages, scenes,
  scene_active: scenes.find((s) => egal(s.reglages, actuel))?.id ?? '',
  quota: { utilise: prises.reduce((t, p) => t + p.taille, 0), max: reglages.quota_mo * 1024 * 1024, n: prises.length, max_n: reglages.max_prises },
  limites: { duree_max: 120, fps: [10, 15, 24, 30], bornes: { quota_mo: [50, 5000], max_prises: [10, 1000], duree: [3, 120] }, scenes_max: 30, taille_clip: 80 * 1024 * 1024 },
})

export const cameraStudio: [string, string, MockHandler][] = [
  ['GET', '/camera/studio', () => etat()],
  ['POST', '/camera/studio/photo', () => {
    const nom = `prise-20261020-${String(120000 + n++)}.jpg`
    prises = [{ nom, genre: 'image', taille: 50_000, date: Date.now() / 1000, duree: null }, ...prises]
    return { success: true, nom, purgees: [] }
  }],
  ['PUT', '/camera/studio/reglages', ({ body }) => { reglages = { ...reglages, ...(body as { reglages?: Partial<ReglagesStudio> })?.reglages }; return { success: true, reglages } }],
  ['PUT', '/camera/reglages', ({ body }) => { actuel = { ...actuel, ...((body as { reglages?: Partial<ReglagesScene> })?.reglages ?? {}) } as ReglagesScene; return { success: true } }],
  ['POST', '/camera/studio/scenes', ({ body }) => {
    const nom = String((body as { nom?: unknown })?.nom ?? '').trim()
    if (!nom) return { success: false, error: 'nom de scène : 1 à 40 caractères' }
    if (scenes.some((s) => s.nom.toLowerCase() === nom.toLowerCase())) return { success: false, error: 'une scène porte déjà ce nom' }
    scenes = [...scenes, { id: `demo${String(100 + n++)}`, nom, reglages: actuel }]
    return { success: true, scenes }
  }],
  ['PUT', '/camera/studio/scenes/:id', ({ params }) => { scenes = scenes.map((s) => (s.id === params.id ? { ...s, reglages: actuel } : s)); return { success: true, scenes } }],
  ['DELETE', '/camera/studio/scenes/:id', ({ params }) => { scenes = scenes.filter((s) => s.id !== params.id); return { success: true, scenes } }],
  ['DELETE', '/camera/studio/prises/:nom', ({ params }) => { prises = prises.filter((p) => p.nom !== params.nom); return { success: true } }],
]
