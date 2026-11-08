// God Eye : réglages gardés côté serveur (GET/PUT /godeye/reglages). Logique pure, testée dans reglagesServeur.test.ts.
// Le navigateur garde une copie (repli hors ligne) ; à l'ouverture le serveur gagne, ensuite chaque changement est envoyé.
import { lireElements, type Elements } from './elements'
import { lireFiltres, type Filtres } from './filtres'
import { lireRotation, ROTATION_DEFAUT, type Rotation } from './rotation'

export const CLE_AVANCE = 'neutroncore_godeye_avance'
export const HISTORIQUE_MIN = 1
export const HISTORIQUE_MAX = 48
export const HISTORIQUE_DEFAUT = 24

/** Réglages qui n'existaient pas avant ce lot : durée de l'historique et rotation automatique. */
export type Avance = { historique_heures: number; rotation: Rotation }
export const AVANCE_DEFAUT: Avance = { historique_heures: HISTORIQUE_DEFAUT, rotation: ROTATION_DEFAUT }

export function borneHistorique(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(HISTORIQUE_MAX, Math.max(HISTORIQUE_MIN, Math.round(v))) : HISTORIQUE_DEFAUT
}

export function lireAvance(brut: unknown): Avance {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>
  return { historique_heures: borneHistorique(o.historique_heures), rotation: lireRotation(o.rotation) }
}

/** Lit la copie du navigateur (chaîne JSON). */
export function lireAvanceStockee(brut: string | null): Avance {
  try { return lireAvance(JSON.parse(brut ?? 'null')) } catch { return AVANCE_DEFAUT }
}

export type ReglagesServeur = { elements: Elements | null; filtres: Filtres | null; avance: Avance | null }

const plein = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0

/**
 * Relit GET /godeye/reglages. Une partie absente ou vide vaut `null` : on garde alors la version locale et on l'enverra au serveur.
 * Réponse inutilisable (pas un objet) : `null` entier.
 */
export function lireReglagesServeur(brut: unknown): ReglagesServeur | null {
  if (!brut || typeof brut !== 'object') return null
  const o = brut as Record<string, unknown>
  const aAvance = o.historique_heures !== undefined || plein(o.rotation)
  return {
    elements: plein(o.elements) ? lireElements(JSON.stringify(o.elements)) : null,
    filtres: plein(o.filtres) ? lireFiltres(o.filtres) : null,
    avance: aAvance ? lireAvance(o) : null,
  }
}

/** Corps de PUT /godeye/reglages. */
export function corpsReglages(elements: Elements, filtres: Filtres, avance: Avance): Record<string, unknown> {
  return { elements, filtres, historique_heures: avance.historique_heures, rotation: avance.rotation }
}

/** Empreinte stable pour savoir si un envoi est utile. */
export const empreinte = (c: Record<string, unknown>): string => JSON.stringify(c)
