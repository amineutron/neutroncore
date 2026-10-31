// Vue du monde : projection, séismes, repères cyber (logique pure, testée dans vueMonde.test.ts).

export type Vue = { cx: number; cy: number; zoom: number }
export type Seisme = { id: string; mag: number; lieu: string; lon: number; lat: number; prof: number; t: number }
export type NiveauCyber = 'ok' | 'info' | 'warn' | 'crit'
export type Periode = 'jour' | 'semaine'

export const VUE_DEPART: Vue = { cx: 10, cy: 15, zoom: 1 }
export const ZOOM_MIN = 1
export const ZOOM_MAX = 40
// CERT-FR est un service français : les avis n'ont pas de position, on les pose sur la France.
export const FRANCE = { lon: 2.4, lat: 46.6 }
export const FLUX_USGS: Record<Periode, string> = {
  jour: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  semaine: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
}

/** Pixels par degré : le monde entier tient dans la toile au zoom 1. */
export function echelle(w: number, h: number, zoom: number): number {
  return Math.min(w / 360, h / 180) * zoom
}

export function projeter(lon: number, lat: number, vue: Vue, w: number, h: number): [number, number] {
  const s = echelle(w, h, vue.zoom)
  return [w / 2 + (lon - vue.cx) * s, h / 2 - (lat - vue.cy) * s]
}

export function deprojeter(x: number, y: number, vue: Vue, w: number, h: number): [number, number] {
  const s = echelle(w, h, vue.zoom)
  return [vue.cx + (x - w / 2) / s, vue.cy - (y - h / 2) / s]
}

/** Garde la vue dans le monde : zoom borné, centre tel que la toile ne dépasse pas du monde. */
export function borner(vue: Vue, w: number, h: number): Vue {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(vue.zoom) ? vue.zoom : 1))
  const s = echelle(w, h, zoom)
  const bx = Math.max(0, 180 - w / 2 / s)
  const by = Math.max(0, 90 - h / 2 / s)
  const cx = Math.min(bx, Math.max(-bx, Number.isFinite(vue.cx) ? vue.cx : 0))
  const cy = Math.min(by, Math.max(-by, Number.isFinite(vue.cy) ? vue.cy : 0))
  return { cx, cy, zoom }
}

/** Zoome en gardant fixe le point (x, y) de la toile. */
export function zoomerAutour(vue: Vue, facteur: number, x: number, y: number, w: number, h: number): Vue {
  const [lon, lat] = deprojeter(x, y, vue, w, h)
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, vue.zoom * facteur))
  const s = echelle(w, h, zoom)
  return borner({ cx: lon - (x - w / 2) / s, cy: lat + (y - h / 2) / s, zoom }, w, h)
}

export function deplacer(vue: Vue, dx: number, dy: number, w: number, h: number): Vue {
  const s = echelle(w, h, vue.zoom)
  return borner({ ...vue, cx: vue.cx - dx / s, cy: vue.cy + dy / s }, w, h)
}

/** Lit un GeoJSON USGS ; tout ce qui est inattendu est ignoré (jamais d'exception). */
export function lireUsgs(brut: unknown): Seisme[] {
  const feats = (brut as { features?: unknown } | null)?.features
  if (!Array.isArray(feats)) return []
  const sorties: Seisme[] = []
  for (const f of feats) {
    const p = (f as { properties?: Record<string, unknown> } | null)?.properties
    const c = (f as { geometry?: { coordinates?: unknown } } | null)?.geometry?.coordinates
    const id = (f as { id?: unknown } | null)?.id
    if (!p || !Array.isArray(c) || typeof id !== 'string') continue
    const [lon, lat, prof] = c as unknown[]
    const mag = p.mag
    const t = p.time
    if (typeof lon !== 'number' || typeof lat !== 'number' || typeof mag !== 'number' || typeof t !== 'number') continue
    if (!Number.isFinite(lon + lat + mag + t) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue
    sorties.push({ id, mag, lieu: typeof p.place === 'string' ? p.place.slice(0, 120) : '', lon, lat, prof: typeof prof === 'number' && Number.isFinite(prof) ? prof : 0, t })
  }
  return sorties.sort((a, b) => b.t - a.t)
}

export type TonSeisme = 'ok' | 'warn' | 'crit'
export function tonSeisme(mag: number): TonSeisme {
  return mag >= 6 ? 'crit' : mag >= 5 ? 'warn' : 'ok'
}

/** Rayon en pixels d'un séisme (croît avec la magnitude, borné). */
export function rayonSeisme(mag: number): number {
  return Math.min(22, Math.max(2.5, 1.6 * Math.pow(1.45, mag - 2)))
}

export function ageTexte(t: number, maintenant: number): string {
  const min = Math.max(0, Math.round((maintenant - t) / 60000))
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`
}

/** Séisme le plus proche du point (x, y), dans une tolérance en pixels. */
export function plusProche(seismes: Seisme[], x: number, y: number, vue: Vue, w: number, h: number, tolerance = 14): Seisme | null {
  let meilleur: Seisme | null = null
  let dmin = tolerance
  for (const s of seismes) {
    const [px, py] = projeter(s.lon, s.lat, vue, w, h)
    const d = Math.hypot(px - x, py - y) - rayonSeisme(s.mag) * 0.5
    if (d < dmin) { dmin = d; meilleur = s }
  }
  return meilleur
}

export const NOM_NIVEAU_CYBER: Record<NiveauCyber, string> = { ok: 'calme', info: 'info', warn: 'attention', crit: 'critique' }

export function niveauCyber(v: unknown): NiveauCyber {
  return v === 'info' || v === 'warn' || v === 'crit' ? v : 'ok'
}
