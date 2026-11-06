// Réveil progressif : logique pure côté écran (testée dans reveil.test.ts). Même forme que lib/reveil.py de l'API.
import { BRI_MAX, courbeGamma, mettreALechelle, type Point, type Rampe } from './rampes'

export type Tele = { actif: boolean; ecran: string; source: string; moment: 'fin' | 'debut'; avant_fin_min: number }
export type Reveil = {
  id: string; nom: string; enabled: boolean; duree_min: number; lampes: string[]; plafond_bri: number
  courbe: { bri: Point[]; kelvin: Point[] }; tele: Tele; resume?: string
}
export type ReveilListe = {
  reveils: Reveil[]; ecartes: string[]; modele: Reveil; ecrans: string[]; sources: string[]; moments: string[]
  worldmonitor_branche: boolean; lecture: Lecture | null
  limites: { duree_min: number; duree_max: number; essai_min_s: number; essai_max_s: number }
}
export type Lecture = {
  genre: 'rampe' | 'reveil'; id: string; nom: string; t: number; duree: number; en_cours: boolean
  etat?: Record<string, { on: boolean; bri: number | null; kelvin: number | null }>
  bilan: { fini?: boolean; interrompue?: boolean; erreur?: string | null; envoyees?: number; echecs?: number
    evenements?: { t: number; success: boolean; error?: string | null }[] } | null
}

/** Le réveil comme rampe, plafond de luminosité appliqué (comme `en_rampe` côté API) : c'est ce que l'écran prévisualise. */
export function versRampe(r: Reveil): Rampe {
  const bri = r.courbe.bri.map((p) => ({ ...p, v: Math.min(p.v, r.plafond_bri) }))
  return { id: r.id, nom: r.nom, duree_s: r.duree_min * 60, pas_s: 10, boucle: false, pistes: [{ lampes: r.lampes, bri, kelvin: r.courbe.kelvin }] }
}

/** Change la durée en gardant la forme des deux courbes. */
export function changerDuree(r: Reveil, minutes: number): Reveil {
  const de = r.duree_min * 60, vers = minutes * 60
  return { ...r, duree_min: minutes, courbe: { bri: mettreALechelle(r.courbe.bri, de, vers), kelvin: mettreALechelle(r.courbe.kelvin, de, vers) },
    tele: { ...r.tele, avant_fin_min: Math.min(r.tele.avant_fin_min, minutes) } }
}

/** Réveil de départ tiré du modèle de l'API (qui a sa propre durée, 30 min) : les deux courbes suivent la durée voulue.
 *  Sans cette remise à l'échelle, un gabarit de 20 min gardait des points à 1800 s et l'API refusait l'enregistrement. */
export function reveilDepuisModele(modele: Reveil, id: string, nom: string, minutes: number): Reveil {
  const base: Reveil = { ...modele, id, nom }
  return minutes === base.duree_min ? base : changerDuree(base, minutes)
}

/** Remet la luminosité sur la montée percue régulière (gamma 2,2) du début au plafond. */
export function monteeReguliere(r: Reveil): Reveil {
  return { ...r, courbe: { ...r.courbe, bri: courbeGamma(r.duree_min * 60, 1, Math.min(r.plafond_bri, BRI_MAX)) } }
}

/** Identifiant sûr tiré d'un nom (a-z, 0-9, tirets), unique parmi `existants`. */
export function identifiant(nom: string, existants: string[]): string {
  const base = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'reveil'
  let id = base, n = 2
  while (existants.includes(id)) id = `${base}-${n++}`
  return id
}

/** Instant (s) où la télé s'allume, ou null. Miroir de `instant_tele`. */
export function instantTele(r: Reveil): number | null {
  if (!r.tele.actif) return null
  return r.tele.moment === 'debut' ? 0 : Math.max(0, r.duree_min * 60 - r.tele.avant_fin_min * 60)
}

/** Heure d'arrivée à pleine lumière si le réveil démarre à `hhmm` ("06:30") : "07:00". */
export function heureDeFin(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (h * 60 + m + minutes) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
