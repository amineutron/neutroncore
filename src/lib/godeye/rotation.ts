// God Eye : rotation automatique entre des étapes (monde entier, zone surveillée). Logique pure, testée dans rotation.test.ts.
import { VUE_DEPART, type Vue } from '../vueMonde'

export type Etape = { type: 'monde' } | { type: 'zone'; zone_id: string }
export type Rotation = { actif: boolean; secondes: number; etapes: Etape[] }
export const ROTATION_DEFAUT: Rotation = { actif: false, secondes: 20, etapes: [{ type: 'monde' }] }
export const SECONDES_MIN = 5
export const SECONDES_MAX = 300
export const MAX_ETAPES = 12
/** Après le moindre geste de l'utilisateur, la rotation attend au moins ce délai avant de reprendre. */
export const PAUSE_GESTE_MS = 30_000

/** Zone surveillée telle que la sert GET /godeye/zones (seuls les champs utiles ici). */
export type ZoneVue = { id: string; nom: string; centre: { lat: number; lon: number }; rayonKm: number; actif: boolean }

const borne = (v: unknown, min: number, max: number, repli: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : repli)

/** Relit une rotation enregistrée (serveur ou navigateur) : tout ce qui est invalide retombe sur le défaut, sans exception. */
export function lireRotation(brut: unknown): Rotation {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>
  const etapes: Etape[] = []
  if (Array.isArray(o.etapes)) {
    for (const e of o.etapes) {
      const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
      if (x.type === 'monde') etapes.push({ type: 'monde' })
      else if (x.type === 'zone' && typeof x.zone_id === 'string' && /^[\w-]{1,40}$/.test(x.zone_id)) etapes.push({ type: 'zone', zone_id: x.zone_id })
      if (etapes.length >= MAX_ETAPES) break
    }
  }
  return { actif: o.actif === true, secondes: borne(o.secondes, SECONDES_MIN, SECONDES_MAX, ROTATION_DEFAUT.secondes), etapes: etapes.length ? etapes : ROTATION_DEFAUT.etapes }
}

/** Relit GET /godeye/zones (liste nue ou `{zones: [...]}`), cercle ou rectangle. */
export function lireZones(brut: unknown): ZoneVue[] {
  const liste = Array.isArray(brut) ? brut : (brut as { zones?: unknown } | null)?.zones
  if (!Array.isArray(liste)) return []
  const sortie: ZoneVue[] = []
  for (const z of liste) {
    const o = (z && typeof z === 'object' ? z : {}) as Record<string, unknown>
    if (typeof o.id !== 'string') continue
    const c = o.centre as { lat?: unknown; lon?: unknown } | undefined
    const b = o.bbox as { s?: unknown; w?: unknown; n?: unknown; e?: unknown } | undefined
    let lat: number | null = null, lon: number | null = null, rayon = 500
    if (typeof c?.lat === 'number' && typeof c?.lon === 'number') { lat = c.lat; lon = c.lon }
    if (b && [b.s, b.w, b.n, b.e].every((v) => typeof v === 'number')) {
      const [s, w, n, e] = [b.s, b.w, b.n, b.e] as number[]
      lat ??= (s + n) / 2; lon ??= (w + e) / 2
      rayon = Math.max(((n - s) / 2) * 111, ((e - w) / 2) * 111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))
    }
    if (typeof o.rayon_km === 'number' && o.rayon_km > 0) rayon = o.rayon_km
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue
    sortie.push({ id: o.id, nom: typeof o.nom === 'string' ? o.nom : o.id, centre: { lat, lon }, rayonKm: rayon, actif: o.actif !== false })
  }
  return sortie
}

/** Zoom de la vue pour qu'une zone de ce rayon (km) tienne à l'écran : 1 = monde entier. */
export function zoomPourRayon(rayonKm: number): number {
  const z = 6000 / Math.max(rayonKm, 150)
  return Math.round(Math.min(12, Math.max(1.5, z)) * 10) / 10
}

/** Cadrage d'une étape ; une zone introuvable ou coupée n'a pas de cadrage. */
export function cadreEtape(e: Etape, zones: readonly ZoneVue[]): Vue | null {
  if (e.type === 'monde') return VUE_DEPART
  const z = zones.find((x) => x.id === e.zone_id)
  return z && z.actif ? { cx: z.centre.lon, cy: z.centre.lat, zoom: zoomPourRayon(z.rayonKm) } : null
}

/** Étapes réellement jouables aujourd'hui (les zones supprimées ou coupées sont sautées). */
export const etapesJouables = (etapes: readonly Etape[], zones: readonly ZoneVue[]): Etape[] => etapes.filter((e) => cadreEtape(e, zones) !== null)

/** Doit-on passer à l'étape suivante ? Non si l'utilisateur a bougé récemment ou si l'étape actuelle n'a pas fini son temps. */
export function aAvancer(p: { maintenant: number; dernierGeste: number; derniereEtape: number; secondes: number }): boolean {
  return p.maintenant - p.dernierGeste >= Math.max(PAUSE_GESTE_MS, p.secondes * 1000) && p.maintenant - p.derniereEtape >= p.secondes * 1000
}

/** Étape suivante (circulaire) ; `-1` au départ donne la première. */
export const indexSuivant = (i: number, n: number): number => (n <= 0 ? -1 : (i + 1) % n)

export const nomEtape = (e: Etape, zones: readonly ZoneVue[]): string => (e.type === 'monde' ? 'monde entier' : zones.find((z) => z.id === e.zone_id)?.nom ?? 'zone supprimée')
