// God Eye : zones surveillées (géométrie et validation pures, testées dans zones.test.ts).
// L'évaluation (entrées, sorties, notifications) est faite côté serveur ; ici : formes, bornes, dessin.

export type FormeZone = 'cercle' | 'rect'
export type ObjetZone = 'avion' | 'navire' | 'satellite' | 'seisme'
export type Bbox = { s: number; w: number; n: number; e: number }
export type Zone = {
  id: string
  nom: string
  forme: FormeZone
  centre: { lat: number; lon: number }
  rayon_km?: number
  bbox?: Bbox
  objets: ObjetZone[]
  actif: boolean
  notifier: boolean
}
/** Zone en cours d'édition ou de création : l'identifiant est absent tant que le serveur ne l'a pas donné. */
export type ZoneBrouillon = Omit<Zone, 'id'> & { id?: string }

export const ZONES_MAX = 10
export const RAYON_MIN_KM = 1
export const RAYON_MAX_KM = 5000
export const NOM_MAX = 40
export const RAYON_TERRE_KM = 6371.0088
export const OBJETS_ZONE: { id: ObjetZone; nom: string }[] = [
  { id: 'avion', nom: 'avions' }, { id: 'navire', nom: 'navires' }, { id: 'satellite', nom: 'satellites' }, { id: 'seisme', nom: 'séismes' },
]
export const ID_BROUILLON = 'brouillon'

const rad = (d: number): number => (d * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI
const fini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const arrondir = (v: number, n = 3): number => Math.round(v * 10 ** n) / 10 ** n
/** Longitude ramenée dans [-180, 180). */
export const normaliserLon = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180

/** Distance du grand cercle en km (haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Zone vide proposée à la création : un cercle de 100 km autour de (lat, lon). */
export function zoneVide(lat = 48.85, lon = 2.35): ZoneBrouillon {
  return { nom: '', forme: 'cercle', centre: { lat: arrondir(lat), lon: arrondir(normaliserLon(lon)) }, rayon_km: 100, objets: ['avion', 'navire'], actif: true, notifier: false }
}

/** Rectangle englobant un cercle, pour passer de « cercle » à « rect » sans repartir de zéro. */
export function bboxDeCercle(lat: number, lon: number, rayonKm: number): Bbox {
  const dLat = deg(rayonKm / RAYON_TERRE_KM)
  const dLon = deg(rayonKm / RAYON_TERRE_KM / Math.max(0.05, Math.cos(rad(lat))))
  return {
    s: arrondir(Math.max(-90, lat - dLat)), n: arrondir(Math.min(90, lat + dLat)),
    w: arrondir(normaliserLon(lon - Math.min(179, dLon))), e: arrondir(normaliserLon(lon + Math.min(179, dLon))),
  }
}

/** Largeur en longitude d'un rectangle (il peut enjamber l'antiméridien : w > e). */
export const largeurLon = (b: Bbox): number => (b.e >= b.w ? b.e - b.w : b.e + 360 - b.w)

/** Erreurs de validation (mêmes bornes que le serveur) ; liste vide = zone valide. */
export function erreursZone(z: ZoneBrouillon): string[] {
  const e: string[] = []
  const nom = z.nom.trim()
  if (!nom) e.push('Donne un nom à la zone.')
  else if (nom.length > NOM_MAX) e.push(`Le nom est limité à ${NOM_MAX} caractères.`)
  if (!fini(z.centre?.lat) || z.centre.lat < -90 || z.centre.lat > 90) e.push('La latitude doit être comprise entre -90 et 90.')
  if (!fini(z.centre?.lon) || z.centre.lon < -180 || z.centre.lon > 180) e.push('La longitude doit être comprise entre -180 et 180.')
  if (z.forme === 'cercle') {
    if (!fini(z.rayon_km) || z.rayon_km < RAYON_MIN_KM || z.rayon_km > RAYON_MAX_KM) e.push(`Le rayon doit être compris entre ${RAYON_MIN_KM} et ${RAYON_MAX_KM} km.`)
  } else {
    const b = z.bbox
    if (!b || ![b.s, b.w, b.n, b.e].every(fini)) e.push('Les quatre bords du rectangle sont requis.')
    else {
      if (b.s < -90 || b.n > 90 || b.s >= b.n) e.push('Le bord sud doit être au sud du bord nord (entre -90 et 90).')
      if (b.w < -180 || b.w > 180 || b.e < -180 || b.e > 180) e.push('Les bords ouest et est doivent être compris entre -180 et 180.')
      else if (b.w === b.e) e.push('Les bords ouest et est doivent différer.')
    }
  }
  if (z.objets.length === 0) e.push('Choisis au moins un type d\'objet à surveiller.')
  return e
}

/** Le point est-il dans la zone ? (cercle : distance au centre ; rectangle : bords, antiméridien compris.) */
export function dansZone(z: Pick<Zone, 'forme' | 'centre' | 'rayon_km' | 'bbox'>, lat: number, lon: number): boolean {
  if (z.forme === 'cercle') return fini(z.rayon_km) && distanceKm(z.centre.lat, z.centre.lon, lat, lon) <= z.rayon_km
  const b = z.bbox
  if (!b || lat < b.s || lat > b.n) return false
  const l = normaliserLon(lon)
  return b.w <= b.e ? l >= b.w && l <= b.e : l >= b.w || l <= b.e
}

/** Point [lon, lat] à `distKm` du départ dans la direction `capDeg` (0 = nord). */
export function pointDistant(lat: number, lon: number, capDeg: number, distKm: number): [number, number] {
  const d = distKm / RAYON_TERRE_KM, c = rad(capDeg), la = rad(lat), lo = rad(lon)
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(c))
  const lo2 = lo + Math.atan2(Math.sin(c) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2))
  return [deg(lo2), deg(la2)]
}

/**
 * Polygone fermé [lon, lat] d'un cercle géodésique à `n` points. Les longitudes sont DÉROULÉES (continues, hors de
 * [-180, 180] si le cercle franchit l'antiméridien) : le dessin les translate de ±360 pour couvrir les deux bords.
 */
export function polygoneCercle(lat: number, lon: number, rayonKm: number, n = 64): [number, number][] {
  const pts: [number, number][] = []
  let precedent = lon
  for (let i = 0; i < n; i++) {
    const [lo, la] = pointDistant(lat, lon, (360 * i) / n, rayonKm)
    let l = normaliserLon(lo)
    while (l - precedent > 180) l -= 360
    while (l - precedent < -180) l += 360
    precedent = l
    pts.push([l, Math.max(-90, Math.min(90, la))])
  }
  pts.push(pts[0])
  return pts
}

/** Polygone fermé d'un rectangle (côtés subdivisés : sur le globe un bord est une courbe), longitudes déroulées. */
export function polygoneRect(b: Bbox, pas = 6): [number, number][] {
  const est = b.w + largeurLon(b)
  const n = Math.max(1, Math.ceil(largeurLon(b) / pas)), m = Math.max(1, Math.ceil((b.n - b.s) / pas))
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) pts.push([b.w + ((est - b.w) * i) / n, b.s])
  for (let i = 1; i <= m; i++) pts.push([est, b.s + ((b.n - b.s) * i) / m])
  for (let i = n - 1; i >= 0; i--) pts.push([b.w + ((est - b.w) * i) / n, b.n])
  for (let i = m - 1; i >= 1; i--) pts.push([b.w, b.s + ((b.n - b.s) * i) / m])
  pts.push(pts[0])
  return pts
}

/** Polygone de dessin d'une zone ; vide si la zone est incohérente (rien n'est dessiné plutôt que de planter). */
export function polygoneZone(z: ZoneBrouillon): [number, number][] {
  if (erreursZone({ ...z, nom: z.nom || 'x', objets: z.objets.length ? z.objets : ['avion'] }).length) return []
  return z.forme === 'cercle' ? polygoneCercle(z.centre.lat, z.centre.lon, z.rayon_km ?? 0) : polygoneRect(z.bbox as Bbox)
}

/** Texte court de la forme : « cercle de 120 km » ou « rectangle 12° x 8° ». */
export function resumeForme(z: ZoneBrouillon): string {
  if (z.forme === 'cercle') return `cercle de ${Math.round(z.rayon_km ?? 0)} km`
  const b = z.bbox
  return b ? `rectangle ${Math.round(largeurLon(b))}° x ${Math.round(b.n - b.s)}°` : 'rectangle'
}

export const resumeObjets = (z: Pick<Zone, 'objets'>): string => OBJETS_ZONE.filter((o) => z.objets.includes(o.id)).map((o) => o.nom).join(', ') || 'aucun objet'

/** Zone lue depuis une réponse du serveur ; null si elle est inutilisable (une zone abîmée n'empêche pas les autres). */
export function lireZone(brut: unknown): Zone | null {
  if (!brut || typeof brut !== 'object') return null
  const o = brut as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.nom !== 'string') return null
  const c = o.centre as { lat?: unknown; lon?: unknown } | undefined
  if (!c || !fini(c.lat) || !fini(c.lon)) return null
  const ids = OBJETS_ZONE.map((x) => x.id)
  const z: Zone = {
    id: o.id, nom: o.nom, forme: o.forme === 'rect' ? 'rect' : 'cercle', centre: { lat: c.lat, lon: c.lon },
    objets: Array.isArray(o.objets) ? o.objets.filter((v): v is ObjetZone => ids.includes(v as ObjetZone)) : [],
    actif: o.actif !== false, notifier: o.notifier === true,
  }
  if (fini(o.rayon_km)) z.rayon_km = o.rayon_km
  const b = o.bbox as Partial<Bbox> | undefined
  if (b && fini(b.s) && fini(b.w) && fini(b.n) && fini(b.e)) z.bbox = { s: b.s, w: b.w, n: b.n, e: b.e }
  return z
}

export const lireZones = (brut: unknown): Zone[] => {
  const l = (brut as { zones?: unknown } | null)?.zones
  return (Array.isArray(l) ? l : []).map(lireZone).filter((z): z is Zone => z !== null).slice(0, ZONES_MAX)
}

/** Corps envoyé au serveur : sans identifiant, seule la forme choisie garde ses champs, nom nettoyé. */
export function corpsZone(z: ZoneBrouillon): Omit<Zone, 'id'> {
  const base = { nom: z.nom.trim(), forme: z.forme, centre: { lat: z.centre.lat, lon: z.centre.lon }, objets: [...z.objets], actif: z.actif, notifier: z.notifier }
  return z.forme === 'cercle' ? { ...base, rayon_km: z.rayon_km } : { ...base, bbox: z.bbox }
}

/** Passage d'une forme à l'autre en gardant la même emprise approximative. */
export function changerForme(z: ZoneBrouillon, forme: FormeZone): ZoneBrouillon {
  if (forme === z.forme) return z
  if (forme === 'rect') return { ...z, forme, bbox: bboxDeCercle(z.centre.lat, z.centre.lon, z.rayon_km ?? 100) }
  const b = z.bbox
  const rayon = b ? Math.round(Math.max(RAYON_MIN_KM, Math.min(RAYON_MAX_KM, distanceKm(z.centre.lat, z.centre.lon, b.n, b.e)))) : 100
  return { ...z, forme, rayon_km: rayon }
}

/** Recentre une zone : le cercle suit son centre, le rectangle garde sa taille autour du nouveau centre. */
export function deplacerZone(z: ZoneBrouillon, lat: number, lon: number): ZoneBrouillon {
  const centre = { lat: arrondir(Math.max(-90, Math.min(90, lat))), lon: arrondir(normaliserLon(lon)) }
  if (z.forme === 'cercle' || !z.bbox) return { ...z, centre }
  const h = (z.bbox.n - z.bbox.s) / 2, l = largeurLon(z.bbox) / 2
  const s = Math.max(-90, centre.lat - h), n = Math.min(90, centre.lat + h)
  return { ...z, centre, bbox: { s: arrondir(s), n: arrondir(n), w: arrondir(normaliserLon(centre.lon - l)), e: arrondir(normaliserLon(centre.lon + l)) } }
}
