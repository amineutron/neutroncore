// Studio caméra : types et logique pure (filtres de la galerie, noms lisibles, scènes). Les prises, le
// quota et les scènes vivent côté API (lib/camera_studio.py) ; l'écran ne fait que les montrer.
import type { Reglages } from './camera'

export type Prise = { nom: string; genre: 'image' | 'video'; taille: number; date: number; duree: number | null }
export type Quota = { utilise: number; max: number; n: number; max_n: number }
export type ReglagesStudio = { quota_mo: number; max_prises: number; fps: number; duree: number }
export type ReglagesScene = Pick<Reglages, 'fond' | 'detourage' | 'cadence'>
export type Scene = { id: string; nom: string; reglages: ReglagesScene }
export type Studio = {
  pret: boolean; message: string; moteur_actif: boolean
  enregistrement: { debut: number; duree: number; ecoule: number } | null
  dernier: { ok: boolean; fin: number; nom?: string; erreur?: string; note?: string; avertissement?: string } | null
  prises: Prise[]; quota: Quota; reglages: ReglagesStudio; scenes: Scene[]; scene_active: string
  limites: { duree_max: number; fps: number[]; bornes: Record<string, [number, number]>; scenes_max: number; taille_clip: number }
}
export type Filtre = 'tout' | 'photos' | 'clips'
export const FILTRES: { id: Filtre; label: string }[] = [{ id: 'tout', label: 'tout' }, { id: 'photos', label: 'photos' }, { id: 'clips', label: 'clips' }]
export const DUREES = [5, 10, 20, 30, 60]

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const NOM = /^(prise|clip)-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-(\d{1,3})s)?\.(?:jpg|mp4)$/

/** « prise-20261020-090507.jpg » -> « 20 oct. 09:05:07 » ; un nom inattendu est rendu tel quel. */
export function nomLisible(nom: string): string {
  const m = NOM.exec(nom)
  if (!m) return nom
  return `${Number(m[4])} ${MOIS[Number(m[3]) - 1] ?? m[3]} ${m[5]}:${m[6]}:${m[7]}`
}

export function filtrer(prises: Prise[], filtre: Filtre): Prise[] {
  if (filtre === 'photos') return prises.filter((p) => p.genre === 'image')
  if (filtre === 'clips') return prises.filter((p) => p.genre === 'video')
  return prises
}

export function comptes(prises: Prise[]): Record<Filtre, number> {
  return { tout: prises.length, photos: prises.filter((p) => p.genre === 'image').length, clips: prises.filter((p) => p.genre === 'video').length }
}

/** Part du quota utilisée (0 à 1), sur la contrainte la plus serrée entre la taille et le nombre. */
export function remplissage(q: Quota): number {
  if (!q.max || !q.max_n) return 0
  return Math.min(1, Math.max(q.utilise / q.max, q.n / q.max_n))
}

export function dureeLisible(s: number | null | undefined): string {
  if (s == null) return ''
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
}

/** Ce que PUT /camera/reglages reçoit pour appliquer une scène : ni veille, ni modèle, ni caméra virtuelle. */
export function patchDeScene(s: Scene): ReglagesScene {
  return { fond: { ...s.reglages.fond }, detourage: { ...s.reglages.detourage }, cadence: s.reglages.cadence }
}

/** Phrase d'une scène : « flou 55 %, bord 60, 30 images/s ». */
export function resumeScene(s: Scene): string {
  const { fond, detourage, cadence } = s.reglages
  const f = fond.mode === 'aucun' ? 'sans détourage' : fond.mode === 'flou' ? `flou ${fond.flou} %` : fond.mode === 'prefait' ? `fond ${fond.nom}` : `fond ${fond.nom}`
  return `${f}, durcissement ${detourage.durete}, marge ${detourage.marge}, stabilité ${detourage.stabilite}, ${cadence} images/s`
}

/** Pourquoi on ne peut pas prendre de prise maintenant ('' si on peut). */
export function raisonBloquee(s: Pick<Studio, 'pret' | 'message' | 'enregistrement'>): string {
  if (s.enregistrement) return 'enregistrement en cours'
  return s.pret ? '' : s.message
}

export function enregistrementEnCours(e: Studio['enregistrement']): { reste: number; part: number } | null {
  if (!e) return null
  const reste = Math.max(0, Math.ceil(e.duree - e.ecoule))
  return { reste, part: e.duree > 0 ? Math.min(1, e.ecoule / e.duree) : 0 }
}

// Filtre retenu d'une visite à l'autre : l'accès au stockage peut échouer (navigation privée), l'écran marche sans.
const CLE_FILTRE = 'neutroncore_camera_studio_filtre'
export function lireFiltre(): Filtre {
  try {
    const v = localStorage.getItem(CLE_FILTRE)
    return v === 'photos' || v === 'clips' ? v : 'tout'
  } catch { return 'tout' }
}
export function ecrireFiltre(f: Filtre): void {
  try { localStorage.setItem(CLE_FILTRE, f) } catch { /* sans stockage, le filtre n'est pas retenu */ }
}
