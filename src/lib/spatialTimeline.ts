// Ligne de temps d'un set : logique pure (placement, redimensionnement, réordonnancement, tête de lecture).
// Un set est une suite de scènes qui se jouent l'une après l'autre : les blocs ne se chevauchent donc jamais,
// la « collision » se règle en les réordonnant. Les bornes recopient lib/spatial.py `valider_set`.
import { TEMPS_PAR_MESURE, type PasDeSet } from './spatialFx'

export const MAX_PAS = 64
export const MESURES_MIN = 1
export const MESURES_MAX = 64
export const MESURES_DEFAUT = 4

export type Bloc = { index: number; scene: string; mesures: number; debut: number }

const borne = (m: number) => Math.min(MESURES_MAX, Math.max(MESURES_MIN, Math.round(Number.isFinite(m) ? m : MESURES_DEFAUT)))

/** Pas du set -> blocs placés bout à bout (début en mesures). */
export function versBlocs(pas: PasDeSet[]): Bloc[] {
  let debut = 0
  return pas.map((p, index) => {
    const mesures = borne(p.mesures)
    const b = { index, scene: p.scene, mesures, debut }
    debut += mesures
    return b
  })
}

/** Blocs -> pas, dans l'ordre du début (les chevauchements ne survivent pas : seul l'ordre compte). */
export function versPas(blocs: Bloc[]): PasDeSet[] {
  return [...blocs].sort((a, b) => a.debut - b.debut || a.index - b.index).map((b) => ({ scene: b.scene, mesures: borne(b.mesures) }))
}

export const dureeTotale = (pas: PasDeSet[]): number => pas.reduce((t, p) => t + borne(p.mesures), 0)

export function ajouter(pas: PasDeSet[], scene: string, position?: number, mesures = MESURES_DEFAUT): PasDeSet[] {
  if (pas.length >= MAX_PAS) return pas
  const i = position === undefined ? pas.length : Math.min(pas.length, Math.max(0, position))
  return [...pas.slice(0, i), { scene, mesures: borne(mesures) }, ...pas.slice(i)]
}

export function supprimer(pas: PasDeSet[], i: number): PasDeSet[] {
  return i < 0 || i >= pas.length ? pas : pas.filter((_, k) => k !== i)
}

export function redimensionner(pas: PasDeSet[], i: number, mesures: number): PasDeSet[] {
  if (i < 0 || i >= pas.length) return pas
  return pas.map((p, k) => (k === i ? { ...p, mesures: borne(mesures) } : p))
}

/** Change la durée d'un bloc d'un nombre de mesures (touches fléchées). */
export const elargir = (pas: PasDeSet[], i: number, delta: number): PasDeSet[] => (i < 0 || i >= pas.length ? pas : redimensionner(pas, i, pas[i].mesures + delta))

/** Déplace le bloc `de` vers la place `vers` (`vers` borné). */
export function deplacer(pas: PasDeSet[], de: number, vers: number): PasDeSet[] {
  if (de < 0 || de >= pas.length) return pas
  const cible = Math.min(pas.length - 1, Math.max(0, vers))
  if (cible === de) return pas
  const reste = pas.filter((_, k) => k !== de)
  return [...reste.slice(0, cible), pas[de], ...reste.slice(cible)]
}

/** Place d'insertion pour une mesure survolée : avant le premier bloc dont le milieu est après la mesure. */
export function placeAuMesure(pas: PasDeSet[], mesure: number): number {
  const i = versBlocs(pas).findIndex((b) => b.debut + b.mesures / 2 > mesure)
  return i < 0 ? pas.length : i
}

/** Glisser le bloc `de` jusqu'à la mesure `mesure` (bord gauche du bloc) : sa nouvelle place parmi les autres. */
export function deplacerAuMesure(pas: PasDeSet[], de: number, mesure: number): PasDeSet[] {
  if (de < 0 || de >= pas.length) return pas
  const reste = pas.filter((_, k) => k !== de)
  return deplacer(pas, de, placeAuMesure(reste, mesure))
}

/** Pixels -> mesures (arrondi à la mesure entière, jamais négatif). */
export const mesureDepuisPx = (px: number, pxParMesure: number): number => Math.max(0, Math.round(px / pxParMesure))

/** Tête de lecture : position en mesures (décimale) pour un compteur de temps ; en boucle, elle revient au début. */
export function positionTete(pas: PasDeSet[], beat: number, boucle = true): number {
  const total = dureeTotale(pas)
  if (total <= 0 || !Number.isFinite(beat)) return 0
  const mesures = Math.max(0, beat) / TEMPS_PAR_MESURE
  return boucle ? mesures % total : Math.min(mesures, total)
}

/** Bloc sous la tête de lecture (le dernier si le set n'est pas en boucle et qu'il est fini). */
export function blocSousTete(pas: PasDeSet[], beat: number, boucle = true): Bloc | null {
  const blocs = versBlocs(pas)
  if (blocs.length === 0) return null
  const pos = positionTete(pas, beat, boucle)
  return [...blocs].reverse().find((b) => b.debut <= pos) ?? blocs[0]
}

/** Mêmes règles que le serveur : de 1 à 64 scènes connues, de 1 à 64 mesures entières. Rend la raison du refus, ou null. */
export function refus(pas: PasDeSet[], scenesConnues: ReadonlySet<string>): string | null {
  if (pas.length < 1 || pas.length > MAX_PAS) return `un set a de 1 à ${MAX_PAS} scènes`
  for (let i = 0; i < pas.length; i++) {
    const p = pas[i]
    if (!scenesConnues.has(p.scene)) return `étape ${i + 1} : scène inconnue`
    if (!Number.isInteger(p.mesures) || p.mesures < MESURES_MIN || p.mesures > MESURES_MAX) return `étape ${i + 1} : de ${MESURES_MIN} à ${MESURES_MAX} mesures`
  }
  return null
}

/** Retire les pas dont la scène n'existe plus (scène supprimée du pad). */
export const sansScenesInconnues = (pas: PasDeSet[], connues: ReadonlySet<string>): PasDeSet[] => pas.filter((p) => connues.has(p.scene))
