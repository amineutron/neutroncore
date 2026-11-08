// God Eye : objets marqués pour enregistrer leur position (logique pure, testée dans suivi.test.ts).
import type { Objet } from './modele'

export type TypeSuivi = 'avion' | 'navire' | 'satellite'
export type PointSuivi = { t: number; lon: number; lat: number; alt?: number }
export type Suivi = { id: string; type: TypeSuivi; nom: string; depuis: number; points: PointSuivi[] }
export const MAX_SUIVIS = 20
const PREFIXE: Record<TypeSuivi, string> = { avion: 'avi', navire: 'nav', satellite: 'sat' }
const TYPES: readonly TypeSuivi[] = ['avion', 'navire', 'satellite']

const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const temps = (v: unknown): number | null => { const t = typeof v === 'string' ? Date.parse(v) : nombre(v); return t !== null && Number.isFinite(t) ? t : null }

/** Relit GET /godeye/suivis ; tout ce qui est mal formé est écarté. */
export function lireSuivis(brut: unknown): Suivi[] {
  const liste = (brut as { suivis?: unknown } | null)?.suivis
  if (!Array.isArray(liste)) return []
  const sortie: Suivi[] = []
  for (const s of liste) {
    if (!s || typeof s !== 'object') continue
    const o = s as Record<string, unknown>
    const type = TYPES.find((t) => t === o.type)
    const depuis = temps(o.depuis)
    if (!type || typeof o.id !== 'string' || !o.id || depuis === null) continue
    const points: PointSuivi[] = []
    for (const p of Array.isArray(o.points) ? o.points : []) {
      const q = (p ?? {}) as Record<string, unknown>
      const t = temps(q.t), lat = nombre(q.lat), lon = nombre(q.lon)
      if (t === null || lat === null || lon === null) continue
      const alt = nombre(q.alt)
      points.push(alt === null ? { t, lon, lat } : { t, lon, lat, alt })
    }
    sortie.push({ id: o.id, type, nom: typeof o.nom === 'string' && o.nom ? o.nom : o.id, depuis, points })
  }
  return sortie
}

/** Type de suivi d'un objet de la carte, ou null s'il ne peut pas être marqué (séisme, actualité...). */
export function typeSuivi(o: Pick<Objet, 'couche'>): TypeSuivi | null {
  return o.couche === 'avions' ? 'avion' : o.couche === 'navires' ? 'navire' : o.couche === 'satellites' ? 'satellite' : null
}
/** Identifiant serveur d'un objet (l'identifiant de carte sans son préfixe). */
export const idSuivi = (o: Pick<Objet, 'id'>): string => o.id.slice(o.id.indexOf(':') + 1)
/** Identifiant de carte correspondant à un suivi. */
export const objetIdDeSuivi = (s: Pick<Suivi, 'id' | 'type'>): string => `${PREFIXE[s.type]}:${s.id}`

export function suiviDe(suivis: readonly Suivi[], o: Pick<Objet, 'id' | 'couche'>): Suivi | null {
  const t = typeSuivi(o)
  return t ? suivis.find((s) => s.type === t && s.id === idSuivi(o)) ?? null : null
}

export type Possibilite = { ok: true; corps: { id: string; type: TypeSuivi; nom: string } } | { ok: false; raison: string }
/** Peut-on marquer cet objet ? Corps du POST /godeye/suivis, ou la raison du refus. */
export function peutMarquer(suivis: readonly Suivi[], o: Pick<Objet, 'id' | 'couche' | 'titre'>): Possibilite {
  const type = typeSuivi(o)
  if (!type) return { ok: false, raison: 'seuls un avion, un navire ou un satellite peuvent être marqués' }
  if (suiviDe(suivis, o)) return { ok: false, raison: 'déjà marqué' }
  if (suivis.length >= MAX_SUIVIS) return { ok: false, raison: `${MAX_SUIVIS} objets marqués au plus : en retirer un d'abord` }
  return { ok: true, corps: { id: idSuivi(o), type, nom: o.titre } }
}

/** « depuis 12 min », « depuis 3 h », « depuis 2 j ». */
export function depuisTexte(depuis: number, maintenant: number): string {
  const min = Math.max(0, Math.round((maintenant - depuis) / 60_000))
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `depuis ${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `depuis ${h} h` : `depuis ${Math.round(h / 24)} j`
}

/** Distance parcourue le long des points (km, grand cercle entre points voisins), 0 sans deux points. */
export function distanceParcourueKm(points: readonly Pick<PointSuivi, 'lon' | 'lat'>[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLon = ((b.lon - a.lon) * Math.PI) / 180
    const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
    total += 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
  }
  return total
}

/** Liste après ajout / retrait d'un suivi (sans modifier l'ancienne). */
export const avecSuivi = (suivis: readonly Suivi[], s: Suivi): Suivi[] => [...suivis.filter((x) => !(x.id === s.id && x.type === s.type)), s]
export const sansSuivi = (suivis: readonly Suivi[], s: Pick<Suivi, 'id' | 'type'>): Suivi[] => suivis.filter((x) => !(x.id === s.id && x.type === s.type))
