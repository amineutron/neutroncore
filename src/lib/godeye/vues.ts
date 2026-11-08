// God Eye : vues enregistrées (filtres + cadrage de la carte). Stockées côté API ($NEUTRONCORE_STATE/godeye.json).
import { lireFiltres, VUES_INTEGREES, type Filtres, type VueEnregistree } from './filtres'
import type { Vue } from '../vueMonde'
import { PICTOS, type PictoId } from './pictos'

export const CLE_FILTRES_COURANTS = 'neutroncore_godeye_filtres'
export const NOM_VUE_MAX = 40
export const NB_PROFILS = 3
/** Icônes proposées pour un profil personnel (le choix est libre dans cette liste). */
export const ICONES_PROFIL: PictoId[] = [
  'monde', 'avion', 'avion-mil', 'helico', 'navire', 'satellite', 'station', 'seisme', 'incendie', 'volcan', 'tempete',
  'guerre', 'diplomatie', 'economie', 'cyber', 'securite', 'alerte', 'inondation',
]
const ICONE_RE = /^[a-z0-9-]{1,20}$/

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
    .map((v) => ({
      id: v.id as string, nom: (v.nom as string).slice(0, NOM_VUE_MAX), filtres: lireFiltres(v.filtres), camera: cameraValide(v.camera),
      slot: typeof v.slot === 'number' && Number.isInteger(v.slot) && v.slot >= 1 && v.slot <= NB_PROFILS ? v.slot : null,
      icone: typeof v.icone === 'string' && ICONE_RE.test(v.icone) ? v.icone : null,
    }))
}

export type OptionsProfil = { slot?: number; icone?: string }
type CorpsVue = { id?: string; nom: string; filtres: Filtres; camera: Vue | null; slot?: number; icone?: string }

/**
 * Corps de PUT /godeye/vues. Passer `id` remplace la vue existante (sinon c'est le nom qui décide) ;
 * `slot` (1 à 3) fait de la vue un profil personnel, `icone` doit être un pictogramme connu.
 */
export function corpsVue(nom: string, filtres: Filtres, camera: Vue | null, id?: string, profil?: OptionsProfil): CorpsVue {
  const slot = profil?.slot !== undefined && Number.isInteger(profil.slot) && profil.slot >= 1 && profil.slot <= NB_PROFILS ? profil.slot : undefined
  const icone = profil?.icone !== undefined && profil.icone in PICTOS ? profil.icone : undefined
  return { ...(id ? { id } : {}), nom: nom.trim().slice(0, NOM_VUE_MAX), filtres, camera, ...(slot ? { slot } : {}), ...(icone ? { icone } : {}) }
}

/** Les trois emplacements de profils personnels, dans l'ordre ; `null` = emplacement libre. */
export const profilsPersonnels = (perso: readonly VueEnregistree[]): (VueEnregistree | null)[] =>
  Array.from({ length: NB_PROFILS }, (_, i) => perso.find((v) => v.slot === i + 1) ?? null)

/** Vues enregistrées hors profils, dans l'ordre alphabétique. */
export const vuesLibres = (perso: readonly VueEnregistree[]): VueEnregistree[] =>
  perso.filter((v) => !v.slot).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

/** Intégrées d'abord, puis les vues de l'utilisateur dans l'ordre alphabétique. */
export const toutesLesVues = (perso: readonly VueEnregistree[]): VueEnregistree[] =>
  [...VUES_INTEGREES, ...[...perso].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))]

/** Filtres de départ : ceux de la dernière visite si lisibles, sinon le réglage d'origine. */
export function filtresCourants(brut: string | null): Filtres {
  try { return lireFiltres(brut ? JSON.parse(brut) : null) } catch { return lireFiltres(null) }
}
