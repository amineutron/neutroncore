// DJ Light sur l'Ambilight : lecture sûre des réglages et quatre sauvegardes nommables (logique pure, testée dans
// djAmbilightSaves.test.ts). Gardés dans le navigateur, comme les autres réglages d'écran de DJ Light.
import {
  CADENCE_MAX, CADENCE_MIN, REGLAGES_AMBILIGHT, SIGNAUX_AMBILIGHT, VOIES_AMBILIGHT, type ReglagesAmbilight,
} from './djAmbilight'
import { lireStocke, ecrireStocke as ecrireStockeBrut } from './ciDeps'

export const NB_SAUVEGARDES = 4
export const NOM_SAUVEGARDE_MAX = 24
export const CLE_AMBILIGHT = 'neutroncore_dj_ambilight'

export type SauvegardeAmbilight = { nom: string; reglages: ReglagesAmbilight }
export type StockageAmbilight = { reglages: ReglagesAmbilight; sauvegardes: SauvegardeAmbilight[]; courante: number | null }

const nombre = (v: unknown, lo: number, hi: number, defaut: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : defaut
const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Réglages lus d'où qu'ils viennent : ce qui manque ou déraille reprend la valeur par défaut. */
export function lireReglagesAmbilight(brut: unknown): ReglagesAmbilight {
  const o = estObjet(brut) ? brut : {}
  const d = REGLAGES_AMBILIGHT
  let min = nombre(o.min, 0, 100, d.min), max = nombre(o.max, 0, 100, d.max)
  if (min > max) [min, max] = [max, min]
  return {
    voie: VOIES_AMBILIGHT.find((v) => v === o.voie) ?? d.voie,
    signal: SIGNAUX_AMBILIGHT.find((s) => s === o.signal) ?? d.signal,
    min, max,
    lissage: nombre(o.lissage, 0, 100, d.lissage),
    cadence: nombre(o.cadence, CADENCE_MIN, CADENCE_MAX, d.cadence),
    couleur: typeof o.couleur === 'string' && /^#[0-9a-f]{6}$/i.test(o.couleur.trim()) ? o.couleur.trim().toLowerCase() : d.couleur,
  }
}

// Les quatre cases de départ : de quoi essayer tout de suite, à renommer et à écraser.
export const SAUVEGARDES_DEPART: SauvegardeAmbilight[] = [
  { nom: 'douce', reglages: { voie: 'lounge', signal: 'volume_court', min: 5, max: 55, lissage: 75, cadence: 4, couleur: '#ff8c28' } },
  { nom: 'soirée', reglages: { voie: 'cached', signal: 'volume', min: 10, max: 100, lissage: 40, cadence: 10, couleur: '#ff8c28' } },
  { nom: 'punchy', reglages: { voie: 'cached', signal: 'basses', min: 0, max: 100, lissage: 15, cadence: 12, couleur: '#ff2bd6' } },
  { nom: 'libre', reglages: { ...REGLAGES_AMBILIGHT } },
]

const dansLesCases = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < NB_SAUVEGARDES
const nettoyerNom = (nom: string): string => nom.trim().slice(0, NOM_SAUVEGARDE_MAX).trim()

/** Les sauvegardes avec les réglages de la case `i` remplacés (le nom reste). Hors des quatre cases : inchangées. N'altère pas `saves`. */
export function enregistrerDans(saves: readonly SauvegardeAmbilight[], i: number, reglages: ReglagesAmbilight): SauvegardeAmbilight[] {
  if (!dansLesCases(i)) return [...saves]
  return saves.map((s, k) => (k === i ? { nom: s.nom, reglages: { ...reglages } } : s))
}

/** Les sauvegardes avec la case `i` renommée ; un nom vide est refusé (l'ancien reste). N'altère pas `saves`. */
export function nommer(saves: readonly SauvegardeAmbilight[], i: number, nom: string): SauvegardeAmbilight[] {
  const propre = nettoyerNom(nom)
  if (!dansLesCases(i) || !propre) return [...saves]
  return saves.map((s, k) => (k === i ? { ...s, nom: propre } : s))
}

/** Une copie des réglages de la case, ou null hors des quatre cases. */
export function charger(saves: readonly SauvegardeAmbilight[], i: number): ReglagesAmbilight | null {
  return dansLesCases(i) && saves[i] ? { ...saves[i].reglages } : null
}

// ---- stockage -------------------------------------------------------------------------------------------------------

/** Relit tout : réglages en cours, quatre cases (complétées ou rognées si besoin) et case courante. Jamais d'exception. */
export function lireStockage(cle: string = CLE_AMBILIGHT, stockage?: Pick<Storage, 'getItem'> | null): StockageAmbilight {
  const lu = lireStocke(cle, { reglages: {} as unknown, sauvegardes: [] as unknown[], courante: -1 }, stockage)
  const cases = Array.isArray(lu.sauvegardes) ? lu.sauvegardes : []
  const sauvegardes = SAUVEGARDES_DEPART.map((depart, i): SauvegardeAmbilight => {
    const c = cases[i]
    if (!estObjet(c)) return depart
    const nom = typeof c.nom === 'string' ? nettoyerNom(c.nom) : ''
    return { nom: nom || depart.nom, reglages: lireReglagesAmbilight(c.reglages) }
  })
  return {
    reglages: lireReglagesAmbilight(lu.reglages),
    sauvegardes,
    courante: dansLesCases(lu.courante) ? lu.courante : null,
  }
}

export function ecrireStockage(cle: string, valeur: StockageAmbilight, stockage?: Pick<Storage, 'setItem'> | null): void {
  ecrireStockeBrut(cle, { reglages: valeur.reglages, sauvegardes: valeur.sauvegardes, courante: valeur.courante ?? -1 }, stockage)
}
