// God Eye : fraîcheur des couches (« il y a 12 s »), logique pure testée dans fraicheur.test.ts.
// Orange = en retard ou périmé (dernier état connu), rouge = la source a échoué, gris = couche coupée.
import type { CoucheId } from './modele'

export type Tonalite = 'ok' | 'warn' | 'crit' | 'off'
export type Pastille = { couche: CoucheId; ton: Tonalite; texte: string; ageS: number | null; perime: boolean }

/** État d'un flux tel que le voit l'écran (`maj` = dernier chargement réussi, jamais effacé par une erreur). */
export type EtatBrut = { charge: boolean; erreur: string; maj: number | null }
export type FraicheurServeur = { maj: string | null; age_s: number | null; ok: boolean; perime: boolean; erreur?: string }

/** Cadence normale de chaque couche : au-delà de 2,5 fois cette durée sans mise à jour, la pastille passe à l'orange. */
export const PERIODE_MS: Record<CoucheId, number> = {
  seismes: 5 * 60_000, infos: 5 * 60_000, evenements: 15 * 60_000, avions: 10_000, navires: 60_000, satellites: 30 * 60_000, cyber: 60_000,
}
const MARGE_RETARD = 2.5

/** « il y a 12 s », « il y a 3 min », « il y a 2 h », « il y a 4 j ». */
export function libelleAge(ageS: number): string {
  const s = Math.max(0, Math.round(ageS))
  if (s < 60) return `il y a ${s} s`
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86_400) return `il y a ${Math.floor(s / 3600)} h`
  return `il y a ${Math.floor(s / 86_400)} j`
}

/** Relit GET /godeye/fraicheur : tout ce qui est inattendu est ignoré (la couche garde sa pastille locale). */
export function lireFraicheur(brut: unknown): Partial<Record<CoucheId, FraicheurServeur>> {
  const couches = (brut as { couches?: unknown } | null)?.couches
  if (!couches || typeof couches !== 'object') return {}
  const sortie: Partial<Record<CoucheId, FraicheurServeur>> = {}
  for (const id of Object.keys(PERIODE_MS) as CoucheId[]) {
    const c = (couches as Record<string, unknown>)[id]
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    sortie[id] = {
      maj: typeof o.maj === 'string' ? o.maj : null,
      age_s: typeof o.age_s === 'number' && Number.isFinite(o.age_s) ? o.age_s : null,
      ok: o.ok !== false, perime: o.perime === true, erreur: typeof o.erreur === 'string' ? o.erreur : undefined,
    }
  }
  return sortie
}

type Entree = { couche: CoucheId; actif: boolean; etat: EtatBrut; maintenant: number; restaureA?: number | null; serveur?: FraicheurServeur }

/** Pastille d'une couche. Couche coupée : `off`. Jamais d'exception : une donnée manquante donne « en attente ». */
export function pastille(e: Entree): Pastille {
  const base = { couche: e.couche }
  if (!e.actif) return { ...base, ton: 'off', texte: 'coupée', ageS: null, perime: false }
  const dernier = e.etat.maj ?? e.restaureA ?? null
  const ageLocal = dernier === null ? null : Math.max(0, (e.maintenant - dernier) / 1000)
  const ageS = ageLocal ?? e.serveur?.age_s ?? null
  const depuisCache = e.etat.maj === null && e.restaureA != null
  if (e.etat.erreur) {
    return { ...base, ton: 'crit', ageS, perime: dernier !== null, texte: dernier !== null ? `source en panne, dernier état ${libelleAge(ageS ?? 0)}` : 'source injoignable' }
  }
  if (e.serveur && (!e.serveur.ok || e.serveur.perime) && e.etat.maj === null) {
    const age = e.serveur.age_s ?? ageS
    const t = e.serveur.ok ? 'données périmées' : 'source en panne côté serveur'
    return { ...base, ton: e.serveur.ok ? 'warn' : 'crit', ageS: age, perime: true, texte: age !== null ? `${t}, ${libelleAge(age)}` : t }
  }
  if (ageS === null) return { ...base, ton: 'warn', ageS: null, perime: false, texte: e.etat.charge ? 'chargement' : 'en attente' }
  if (depuisCache) return { ...base, ton: 'warn', ageS, perime: true, texte: `copie gardée, ${libelleAge(ageS)}` }
  const retard = ageS * 1000 > PERIODE_MS[e.couche] * MARGE_RETARD
  return { ...base, ton: retard ? 'warn' : 'ok', ageS, perime: retard, texte: retard ? `en retard, ${libelleAge(ageS)}` : libelleAge(ageS) }
}

export type Entrees = {
  filtresCouches: Record<CoucheId, boolean>
  etats: Record<CoucheId, EtatBrut>
  maintenant: number
  restaures?: Partial<Record<CoucheId, number>>
  serveur?: Partial<Record<CoucheId, FraicheurServeur>>
}

/** Une pastille par couche, dans l'ordre de PERIODE_MS (le cyber n'a pas de flux suivi ici : toujours « coupée »). */
export function pastilles(e: Entrees): Pastille[] {
  return (Object.keys(PERIODE_MS) as CoucheId[]).map((couche) => pastille({
    couche, actif: couche !== 'cyber' && e.filtresCouches[couche], etat: e.etats[couche], maintenant: e.maintenant, restaureA: e.restaures?.[couche], serveur: e.serveur?.[couche],
  }))
}

/** Couches allumées dont la pastille n'est pas verte : ce qu'il faut signaler d'un coup d'oeil. */
export const aSignaler = (p: readonly Pastille[]): Pastille[] => p.filter((x) => x.ton === 'warn' || x.ton === 'crit')
