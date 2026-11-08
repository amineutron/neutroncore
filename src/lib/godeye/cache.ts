// God Eye : dernier état connu des flux, gardé dans le navigateur pour repartir sans écran vide (hors ligne, source tombée).
// Logique pure : le stockage et l'horloge sont injectés. Jamais bloquant : toute erreur de stockage est avalée.
import type { CoucheId, Donnees } from './modele'

export const CLE_CACHE = 'neutroncore_godeye_cache'
export const TTL_CACHE_MS = 48 * 3_600_000
const MAX_CARACTERES = 700_000

/** Couches dont la liste est gardée (les satellites se recalculent depuis leurs orbites, le cyber a son propre cache). */
export type CoucheCachee = 'seismes' | 'evenements' | 'infos' | 'avions' | 'navires'
export const COUCHES_CACHEES: readonly CoucheCachee[] = ['seismes', 'evenements', 'infos', 'avions', 'navires']
const PLAFOND: Record<CoucheCachee, number> = { seismes: 400, evenements: 250, infos: 200, avions: 500, navires: 300 }

export type StockageMin = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type Cache = { t: Partial<Record<CoucheCachee, number>>; d: Partial<Pick<Donnees, CoucheCachee>> }
export const CACHE_VIDE: Cache = { t: {}, d: {} }

/** Relit le cache ; une entrée trop vieille, illisible ou mal formée est ignorée couche par couche. */
export function lireCache(stockage: StockageMin | null, maintenant: number): Cache {
  let brut: unknown = null
  try { brut = JSON.parse(stockage?.getItem(CLE_CACHE) ?? 'null') } catch { return CACHE_VIDE }
  if (!brut || typeof brut !== 'object') return CACHE_VIDE
  const o = brut as { t?: Record<string, unknown>; d?: Record<string, unknown> }
  const t: Cache['t'] = {}
  const d: Record<string, unknown> = {}
  for (const c of COUCHES_CACHEES) {
    const ts = o.t?.[c]
    const liste = o.d?.[c]
    if (typeof ts !== 'number' || !Array.isArray(liste) || maintenant - ts > TTL_CACHE_MS || ts > maintenant + 60_000) continue
    t[c] = ts
    d[c] = liste.slice(0, PLAFOND[c])
  }
  return { t, d: d as Cache['d'] }
}

/**
 * Fusionne ce qui vient d'être chargé dans le cache existant (`frais` : couches réellement lues, avec l'heure de lecture) et
 * borne la taille : si le total dépasse le plafond, on abandonne d'abord les avions puis les navires (les plus lourds, les plus périmés).
 */
export function fusionnerCache(ancien: Cache, frais: Partial<Record<CoucheCachee, { t: number; liste: readonly unknown[] }>>): Cache {
  const t: Cache['t'] = { ...ancien.t }
  const d: Record<string, unknown> = { ...ancien.d }
  for (const c of COUCHES_CACHEES) {
    const f = frais[c]
    if (!f) continue
    t[c] = f.t
    d[c] = f.liste.slice(0, PLAFOND[c])
  }
  let sortie: Cache = { t, d: d as Cache['d'] }
  for (const sacrifie of ['avions', 'navires', 'infos'] as const) {
    if (JSON.stringify(sortie).length <= MAX_CARACTERES) break
    const { [sacrifie]: _a, ...resteD } = sortie.d
    const { [sacrifie]: _b, ...resteT } = sortie.t
    sortie = { t: resteT, d: resteD }
  }
  return sortie
}

export function ecrireCache(stockage: StockageMin | null, cache: Cache): boolean {
  try { stockage?.setItem(CLE_CACHE, JSON.stringify(cache)); return stockage != null } catch { return false }
}

/**
 * Remplace par la copie gardée toute couche jamais chargée pour de vrai (`maj` nul) dont la liste est vide.
 * Une couche chargée (même vide) ou coupée garde ses données ; une erreur sans rien de mieux laisse la copie en place.
 */
export function avecRepli(donnees: Donnees, cache: Cache, majs: Record<CoucheId, number | null>, actives: Record<CoucheId, boolean>): Donnees {
  const sortie: Donnees = { ...donnees }
  for (const c of COUCHES_CACHEES) {
    const copie = cache.d[c]
    if (!copie || !actives[c] || majs[c] !== null || (donnees[c] as readonly unknown[]).length > 0) continue
    ;(sortie as unknown as Record<string, unknown>)[c] = copie
  }
  return sortie
}

/** Heure de la copie utilisée pour chaque couche restaurée (pour la pastille « copie gardée, il y a 3 h »). */
export function restaures(cache: Cache, majs: Record<CoucheId, number | null>, actives: Record<CoucheId, boolean>): Partial<Record<CoucheId, number>> {
  const r: Partial<Record<CoucheId, number>> = {}
  for (const c of COUCHES_CACHEES) { const t = cache.t[c]; if (t !== undefined && actives[c] && majs[c] === null) r[c] = t }
  return r
}
