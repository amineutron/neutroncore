// Résumé matinal : types de l'API /resume et édition des réglages (logique pure, testée).
// Le rendu est dans components/resume/ ; le briefing est fabriqué par l'API (gabarits).
import type { ScreenId } from '../App'

export type Niveau = 'ok' | 'info' | 'warn' | 'crit'
export type Solution = { texte: string; ecran: string; bouton: string }
export type Ligne = { text: string; level: Niveau; detail?: string; depuis?: string; solution?: Solution | null }
export type SectionBriefing = {
  id: string; titre: string; niveau: Niveau; lignes: Ligne[]; cachees: number; total: number
  tous?: Ligne[]; solution?: Solution | null
}
export type Briefing = {
  date: string; genere_a: string; intro: string; sections: SectionBriefing[]
  court: string; niveau: Niveau; texte: string; ia?: string; ia_erreur?: string
}

export type SectionReglage = { id: string; enabled: boolean; max: number }
export type Reglages = {
  heure: string
  intro: string
  sections: SectionReglage[]
  meteo: { ville: string; lat: number | null; lon: number | null }
  envoi: { actif: boolean; telephone: boolean; centre: boolean }
  accueil: boolean
  ia: { actif: boolean; modele: string }
}
export type CatalogueSection = { id: string; label: string; max: number; reglable: boolean }
export type ReglagesReponse = { reglages: Reglages; defaut: Reglages; sections: CatalogueSection[]; intro_max: number }
export type Ville = { nom: string; zone: string; lat: number; lon: number }

export const MAX_ITEMS = 20

// Écran du résumé. Le type ScreenId ne le contient qu'après l'intégration (INTEGRATION.md) ;
// une fois 'resume' ajouté à ScreenId, remplacer par `'resume'`.
export const ECRAN_RESUME: ScreenId = 'resume'

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/
export const heureValide = (h: string): boolean => HEURE.test(h)

/** Déplace la section `id` d'un cran (-1 vers le haut, 1 vers le bas). Liste neuve ; inchangée aux bords. */
export function deplacer(list: SectionReglage[], id: string, dir: -1 | 1): SectionReglage[] {
  const i = list.findIndex((s) => s.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return list
  const out = [...list]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/** Glisser-déposer : `from` prend la place de `to` (les autres se décalent). */
export function deplacerVers(list: SectionReglage[], from: string, to: string): SectionReglage[] {
  const a = list.findIndex((s) => s.id === from)
  const b = list.findIndex((s) => s.id === to)
  if (a < 0 || b < 0 || a === b) return list
  const out = list.filter((s) => s.id !== from)
  out.splice(b, 0, list[a])
  return out
}

export function basculer(list: SectionReglage[], id: string): SectionReglage[] {
  return list.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
}

export function fixerMax(list: SectionReglage[], id: string, n: number): SectionReglage[] {
  const v = Math.min(MAX_ITEMS, Math.max(1, Math.round(n)))
  return list.map((s) => (s.id === id ? { ...s, max: v } : s))
}

export function memesReglages(a: Reglages, b: Reglages): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Le niveau de l'API en pastille de l'interface (`info` = tout va bien). */
export function pastille(n: Niveau): 'ok' | 'warn' | 'crit' {
  return n === 'crit' ? 'crit' : n === 'warn' ? 'warn' : 'ok'
}

/** Nombre d'éléments à signaler dans un briefing (sections au-dessus de « ok »). */
export function aSignaler(sections: SectionBriefing[]): number {
  return sections.filter((s) => s.niveau === 'warn' || s.niveau === 'crit').length
}

/** Ajoute ou remplace la ville choisie (la météo ne marche qu'avec des coordonnées). */
export function avecVille(r: Reglages, v: Ville): Reglages {
  return { ...r, meteo: { ville: v.nom, lat: v.lat, lon: v.lon } }
}

export function sansVille(r: Reglages): Reglages {
  return { ...r, meteo: { ville: '', lat: null, lon: null } }
}

export type Cible = { kind: 'notifs' } | { kind: 'ecran'; id: ScreenId }

/** Où mène le bouton d'une solution : le centre de notifications, un écran connu de l'application, ou nulle part. */
export function cibleSolution(sol: Solution | null | undefined, ecransConnus: readonly string[]): Cible | null {
  if (!sol || typeof sol.ecran !== 'string') return null
  if (sol.ecran === 'notifications') return { kind: 'notifs' }
  return ecransConnus.includes(sol.ecran) ? { kind: 'ecran', id: sol.ecran as ScreenId } : null
}

/** Éléments à montrer dans le détail d'une section : tous si l'API les donne, sinon les lignes affichées. */
export function elementsDetail(s: SectionBriefing): Ligne[] {
  return s.tous && s.tous.length ? s.tous : s.lignes
}

/** Une section se déplie s'il y a quelque chose à dire de plus qu'une ligne d'information. */
export function aDetail(s: SectionBriefing): boolean {
  return elementsDetail(s).some((l) => l.detail || l.depuis || l.solution) || Boolean(s.solution)
}

/** Écrans où une solution peut mener (même liste que `ECRANS_SOLUTION` de l'API, hors notifications). */
export const ECRANS_SOLUTION: readonly ScreenId[] = ['agenda', 'films', 'menage', 'mises', 'outils', 'ressources', 'sauvegardes', 'taches']

/** Demande à l'application d'ouvrir le centre de notifications (App.tsx écoute cet événement). */
export const EVENT_OUVRIR_NOTIFS = 'nc:ouvrir-notifications'
export function ouvrirNotifications(): boolean {
  window.dispatchEvent(new CustomEvent(EVENT_OUVRIR_NOTIFS))
  return true
}
