// Minuteurs et notes de démonstration : en mémoire, retenus jusqu'au rechargement. Rien de réel.
import { lireDuree } from '../../lib/minuteurs'
import type { Minuteur, Reglages } from '../../lib/minuteurs'
import type { Note } from '../../lib/notes'
import type { MockHandler } from '../router'

const notif = { centre: true, navigateur: true, ntfy: false, sonnerie: true }
const t0 = Date.now() / 1000
let reglages: Reglages = {
  notif, sonnerie: 'classique', sortie: 'defaut', duree_sonnerie_s: 30,
  pomodoro: { travail_min: 25, pause_min: 5, longue_min: 15, cycles: 4 },
}
let minuteurs: Minuteur[] = [
  { id: 'demo1', nom: 'pâtes', type: 'minuteur', etat: 'actif', duree_s: 600, fin: t0 + 372, restant_s: 372, progression: 0.38, cree: t0 - 228, notif, sonnerie: 'classique', pomodoro: null },
  { id: 'demo2', nom: 'rédaction', type: 'pomodoro', etat: 'actif', duree_s: 1500, fin: t0 + 1100, restant_s: 1100, progression: 0.27, cree: t0 - 400, notif, sonnerie: 'classique',
    pomodoro: { travail_min: 25, pause_min: 5, longue_min: 15, cycles: 4, cycle: 2, phase: 'travail' } },
]
let notes: Note[] = [
  { id: 'n1', texte: 'racheter des vis M3 pour le boîtier', projet: 'atelier', epingle: true, cree: t0 - 90000, modifie: t0 - 90000, source: 'hub' },
  { id: 'n2', texte: 'revoir la sensibilité automatique sur de la vraie musique', projet: 'lumiere', epingle: false, cree: t0 - 7200, modifie: t0 - 7200, source: 'hub' },
  { id: 'n3', texte: 'idée : un minuteur lié aux scènes Hue', projet: '', epingle: false, cree: t0 - 600, modifie: t0 - 600, source: 'api' },
]
let n = 0
const id = () => `demo${Date.now().toString(36)}${n++}`
const vue = (t: Minuteur): Minuteur => {
  const reste = t.etat === 'actif' ? Math.max(0, t.fin - Date.now() / 1000) : t.etat === 'pause' ? t.restant_s : 0
  return { ...t, restant_s: reste, progression: t.duree_s ? 1 - reste / t.duree_s : 1 }
}
const creer = (corps: Record<string, unknown>): Minuteur => {
  const now = Date.now() / 1000
  const pomodoro = corps.type === 'pomodoro'
  const duree = pomodoro ? reglages.pomodoro.travail_min * 60 : Number(corps.duree_s ?? 60)
  const t: Minuteur = {
    id: id(), nom: String(corps.nom ?? '') || (pomodoro ? 'pomodoro' : `${Math.round(duree / 60)} min`), type: pomodoro ? 'pomodoro' : 'minuteur',
    etat: 'actif', duree_s: duree, fin: now + duree, restant_s: duree, progression: 0, cree: now, notif, sonnerie: reglages.sonnerie,
    pomodoro: pomodoro ? { ...reglages.pomodoro, cycle: 1, phase: 'travail' } : null,
  }
  minuteurs = [...minuteurs, t]
  return t
}
const maj = (ident: string, fn: (t: Minuteur) => Minuteur) => {
  minuteurs = minuteurs.map((t) => (t.id === ident ? fn(vue(t)) : t))
  return { success: true, minuteur: vue(minuteurs.find((t) => t.id === ident) as Minuteur) }
}

export const minuteursDemo: [string, string, MockHandler][] = [
  ['GET', '/minuteurs', () => ({ maintenant: Date.now() / 1000, minuteurs: minuteurs.map(vue), evenements: [], seq: 0, reglages, sonnerie_en_cours: null })],
  ['POST', '/minuteurs', ({ body }) => ({ success: true, minuteur: vue(creer(body as Record<string, unknown>)) })],
  ['POST', '/minuteurs/phrase', ({ body }) => {
    const texte = String((body as { texte?: string }).texte ?? '')
    if (/^\s*pomodoro/i.test(texte)) return { success: true, minuteur: vue(creer({ type: 'pomodoro' })) }
    const duree = lireDuree(texte.replace(/^\s*minuteur\s*/i, ''))
    if (!duree) throw new Error('combien de temps ? ex. « minuteur 10 min »')
    return { success: true, minuteur: vue(creer({ duree_s: duree })) }
  }],
  ['POST', '/minuteurs/arreter-sonnerie', () => ({ success: true, arrete: false })],
  ['PUT', '/minuteurs/reglages', ({ body }) => {
    const b = body as Partial<Reglages>
    reglages = { ...reglages, ...b, notif: { ...reglages.notif, ...b.notif }, pomodoro: { ...reglages.pomodoro, ...b.pomodoro } }
    return { success: true, reglages }
  }],
  ['POST', '/minuteurs/:id/pause', ({ params }) => maj(params.id, (t) => ({ ...t, etat: 'pause' }))],
  ['POST', '/minuteurs/:id/reprendre', ({ params }) => maj(params.id, (t) => ({ ...t, etat: 'actif', fin: Date.now() / 1000 + t.restant_s }))],
  ['POST', '/minuteurs/:id/relancer', ({ params }) => maj(params.id, (t) => ({ ...t, etat: 'actif', fin: Date.now() / 1000 + t.duree_s }))],
  ['POST', '/minuteurs/:id/ajouter', ({ params, body }) => maj(params.id, (t) => ({ ...t, fin: t.fin + Number((body as { secondes?: number }).secondes ?? 0), restant_s: t.restant_s + Number((body as { secondes?: number }).secondes ?? 0) }))],
  ['DELETE', '/minuteurs/:id', ({ params }) => { minuteurs = minuteurs.filter((t) => t.id !== params.id); return { success: true } }],

  ['GET', '/notes', ({ query }) => {
    const q = (query.get('q') ?? '').toLowerCase()
    const projet = query.get('projet')
    const liste = notes
      .filter((x) => (projet === null || x.projet === projet) && (query.get('epingle') !== 'true' || x.epingle) && `${x.texte} ${x.projet}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.epingle) - Number(a.epingle) || b.modifie - a.modifie)
    const comptes = new Map<string, number>()
    notes.forEach((x) => x.projet && comptes.set(x.projet, (comptes.get(x.projet) ?? 0) + 1))
    return { notes: liste, total: notes.length, epinglees: notes.filter((x) => x.epingle).length, corbeille: 0,
      projets: [...comptes].map(([p, c]) => ({ projet: p, notes: c })) }
  }],
  ['POST', '/notes', ({ body }) => {
    const b = body as { texte: string; projet?: string; source?: string }
    const note: Note = { id: id(), texte: b.texte, projet: b.projet ?? '', epingle: false, cree: Date.now() / 1000, modifie: Date.now() / 1000, source: b.source ?? 'hub' }
    notes = [note, ...notes]
    return { success: true, note }
  }],
  ['GET', '/notes/corbeille', () => ({ notes: [] })],
  ['PUT', '/notes/:id', ({ params, body }) => {
    notes = notes.map((x) => (x.id === params.id ? { ...x, ...(body as Partial<Note>), modifie: Date.now() / 1000 } : x))
    return { success: true, note: notes.find((x) => x.id === params.id) }
  }],
  ['DELETE', '/notes/:id', ({ params }) => { notes = notes.filter((x) => x.id !== params.id); return { success: true } }],
]
