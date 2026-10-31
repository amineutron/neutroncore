// God Eye : vues enregistrées (filtres + cadrage de la carte). Stockées côté API ($NEUTRONCORE_STATE/godeye.json).
import { lireFiltres, VUES_INTEGREES, type Filtres, type VueEnregistree } from './filtres'
import type { Vue } from '../vueMonde'

export const CLE_FILTRES_COURANTS = 'neutroncore_godeye_filtres'
export const NOM_VUE_MAX = 40

function cameraValide(c: unknown): Vue | null {
  const o = (c ?? {}) as Record<string, unknown>
  const { cx, cy, zoom } = o
  return typeof cx === 'number' && typeof cy === 'number' && typeof zoom === 'number'
    && Number.isFinite(cx + cy + zoom) && Math.abs(cx) <= 180 && Math.abs(cy) <= 90 && zoom >= 1 && zoom <= 40
    ? { cx, cy, zoom } : null
}

/** Réponse de GET /godeye/vues : les filtres sont relus (un fichier édité à la main ne casse rien). */
export function lireVues(brut: unknown): VueEnregistree[] {
  const l = (brut as { vues?: unknown } | null)?.vues
  if (!Array.isArray(l)) return []
  return (l as Record<string, unknown>[])
    .filter((v) => typeof v?.id === 'string' && typeof v.nom === 'string' && v.nom.trim() !== '')
    .map((v) => ({ id: v.id as string, nom: (v.nom as string).slice(0, NOM_VUE_MAX), filtres: lireFiltres(v.filtres), camera: cameraValide(v.camera) }))
}

/** Corps de PUT /godeye/vues. Passer `id` remplace la vue existante (sinon c'est le nom qui décide). */
export function corpsVue(nom: string, filtres: Filtres, camera: Vue | null, id?: string): { id?: string; nom: string; filtres: Filtres; camera: Vue | null } {
  return { ...(id ? { id } : {}), nom: nom.trim().slice(0, NOM_VUE_MAX), filtres, camera }
}

/** Intégrées d'abord, puis les vues de l'utilisateur dans l'ordre alphabétique. */
export const toutesLesVues = (perso: readonly VueEnregistree[]): VueEnregistree[] =>
  [...VUES_INTEGREES, ...[...perso].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))]

/** Filtres de départ : ceux de la dernière visite si lisibles, sinon le réglage d'origine. */
export function filtresCourants(brut: string | null): Filtres {
  try { return lireFiltres(brut ? JSON.parse(brut) : null) } catch { return lireFiltres(null) }
}
