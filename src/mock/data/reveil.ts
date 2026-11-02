// Réveil, rampes de lumière et sono multi-pièces de démonstration : aucune vraie lampe ni enceinte.
// Les modifications sont retenues en mémoire jusqu'au rechargement. À enregistrer dans src/mock/routes.ts
// (voir INTEGRATION.md) ; rien ici ne touche le reste du mock.
import type { MockHandler } from '../router'
import { courbeGamma, courbeLineaire, type Rampe } from '../../lib/rampes'
import type { Reveil } from '../../lib/reveil'
import type { Scene, Zone } from '../../lib/zonesAudio'

const resume = (r: Reveil) => `aube de ${r.duree_min} min sur ${r.lampes.length} lampe${r.lampes.length > 1 ? 's' : ''}${r.tele.actif ? `, télé (${r.tele.ecran}) à la fin` : ''}`
const modele = (): Reveil => ({
  id: 'reveil', nom: 'reveil', enabled: true, duree_min: 30, lampes: [], plafond_bri: 254,
  courbe: { bri: courbeGamma(1800, 1, 254), kelvin: courbeLineaire(1800, 2200, 5000, 'doux') },
  tele: { actif: false, ecran: 'tele', source: 'hdmi1', moment: 'fin', avant_fin_min: 0 },
})

let reveils: Reveil[] = [{ ...modele(), id: 'semaine', nom: 'semaine', lampes: ['1', '2', '3'], tele: { actif: true, ecran: 'tele', source: 'hdmi1', moment: 'fin', avant_fin_min: 5 } }]
let rampes: Rampe[] = [{
  id: 'respiration', nom: 'respiration', duree_s: 60, pas_s: 3, boucle: true,
  pistes: [{ lampes: ['1', '2'], bri: [{ t: 0, v: 40, forme: 'doux' }, { t: 30, v: 180, forme: 'doux' }, { t: 60, v: 40, forme: 'lineaire' }], kelvin: [] }],
}]
let zones: Zone[] = [
  { id: 'salon', nom: 'salon', appareil: '', groupe: false, volume_max: 40, volume: 20 },
  { id: 'chambre', nom: 'chambre', appareil: 'Groupe Chambre', groupe: true, volume_max: 25, volume: 10 },
]
let scenes: Scene[] = [{ id: 'soiree', nom: 'soirée', volumes: { salon: 25, chambre: 10 } }]
let multi = false

const vide = { success: true, demo: true }
const refus = { success: false, error: 'mode démo : pas de vraies lampes ni enceintes' }

export const reveilDemo: [string, string, MockHandler][] = [
  ['GET', '/reveil', () => ({
    reveils: reveils.map((r) => ({ ...r, resume: resume(r) })), ecartes: [], lecture: null, modele: modele(),
    ecrans: ['tele', 'accueil', 'atelier', 'taches', 'lanceur', 'agenda'], sources: ['hdmi1', 'hdmi2', 'hdmi3', 'hdmi4'], moments: ['fin', 'debut'],
    worldmonitor_branche: false, limites: { duree_min: 5, duree_max: 90, essai_min_s: 20, essai_max_s: 600 },
  })],
  ['PUT', '/reveil/:id', ({ params, body }) => {
    const r = { ...(body as Reveil), id: params.id }
    reveils = reveils.some((x) => x.id === r.id) ? reveils.map((x) => (x.id === r.id ? r : x)) : [...reveils, r]
    return { success: true, reveil: r }
  }],
  ['DELETE', '/reveil/:id', ({ params }) => { reveils = reveils.filter((x) => x.id !== params.id); return vide }],
  ['POST', '/reveil/:id/lancer', () => refus],
  ['POST', '/reveil/arret', () => ({ success: false, error: 'rien ne joue' })],

  ['GET', '/rampes', () => ({
    rampes, ecartes: [], lecture: null,
    limites: { duree_min_s: 30, duree_max_s: 43200, pistes: 8, points: 24, lampes_par_piste: 8, pas_min_s: 2, pas_max_s: 60, bri_max: 254, kelvin_min: 2000, kelvin_max: 6500, formes: ['lineaire', 'doux', 'palier'] },
  })],
  ['PUT', '/rampes/:id', ({ params, body }) => {
    const r = { ...(body as Rampe), id: params.id }
    rampes = rampes.some((x) => x.id === r.id) ? rampes.map((x) => (x.id === r.id ? r : x)) : [...rampes, r]
    return { success: true, rampe: r }
  }],
  ['DELETE', '/rampes/:id', ({ params }) => { rampes = rampes.filter((x) => x.id !== params.id); return vide }],
  ['POST', '/rampes/:id/jouer', () => refus],
  ['POST', '/rampes/arret', () => ({ success: false, error: 'rien ne joue' })],

  ['GET', '/zones-audio', () => ({
    zones, scenes, multi_appareil: multi, plafond: 60, ecartes: [], pilotables: zones.filter((z) => !z.appareil || multi).map((z) => z.id),
  })],
  ['GET', '/zones-audio/statut', () => ({ success: true, texte: 'mode démo : rien ne joue', error: null })],
  ['PUT', '/zones-audio/reglages', ({ body }) => { multi = Boolean((body as { multi_appareil?: boolean })?.multi_appareil); return { success: true, multi_appareil: multi } }],
  ['PUT', '/zones-audio/zones/:id', ({ params, body }) => {
    const z = { ...(body as Zone), id: params.id }
    zones = zones.some((x) => x.id === z.id) ? zones.map((x) => (x.id === z.id ? z : x)) : [...zones, z]
    return { success: true, zone: z }
  }],
  ['DELETE', '/zones-audio/zones/:id', ({ params }) => { zones = zones.filter((x) => x.id !== params.id); return vide }],
  ['PUT', '/zones-audio/scenes/:id', ({ params, body }) => {
    const s = { ...(body as Scene), id: params.id }
    scenes = scenes.some((x) => x.id === s.id) ? scenes.map((x) => (x.id === s.id ? s : x)) : [...scenes, s]
    return { success: true, scene: s }
  }],
  ['DELETE', '/zones-audio/scenes/:id', ({ params }) => { scenes = scenes.filter((x) => x.id !== params.id); return vide }],
  ['POST', '/zones-audio/volume', () => refus],
  ['POST', '/zones-audio/controle', () => refus],
  ['POST', '/zones-audio/scenes/:id/appliquer', () => refus],
]
