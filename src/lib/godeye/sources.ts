// God Eye : adresses des flux et lecture de leurs réponses (tout ce qui est inattendu est ignoré, jamais d'exception).
import { THEMES, type AlerteGdacs, type Avion, type Evenement, type Faille, type GroupeSat, type Info, type Marche, type Navire, type SourceInfo } from './modele'

export const URL_EONET = (jours: number): string =>
  `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=${Math.round(Math.min(90, Math.max(1, jours)))}&limit=400`
export const URL_CELESTRAK = (groupe: GroupeSat): string =>
  `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(groupe)}&FORMAT=tle`
export const MAX_PAR_GROUPE: Partial<Record<GroupeSat, number>> = { starlink: 600, geo: 400, oneweb: 400 }

const nb = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const bonnePosition = (lon: number | null, lat: number | null): lon is number => lon !== null && lat !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180

/** Premier point d'un événement EONET (le plus récent), y compris pour une géométrie en polygone. */
function dernierPoint(geometries: unknown): { lon: number; lat: number; t: number } | null {
  if (!Array.isArray(geometries)) return null
  for (let i = geometries.length - 1; i >= 0; i--) {
    const g = geometries[i] as { type?: unknown; coordinates?: unknown; date?: unknown } | null
    let c: unknown = g?.coordinates
    if (g?.type === 'Polygon' && Array.isArray(c)) c = (c[0] as unknown[] | undefined)?.[0]
    if (!Array.isArray(c)) continue
    const lon = nb(c[0]), lat = nb(c[1]), t = typeof g?.date === 'string' ? Date.parse(g.date) : NaN
    if (bonnePosition(lon, lat) && Number.isFinite(t)) return { lon, lat: lat as number, t }
  }
  return null
}

export function lireEonet(brut: unknown): Evenement[] {
  const liste = (brut as { events?: unknown } | null)?.events
  if (!Array.isArray(liste)) return []
  const sortie: Evenement[] = []
  for (const e of liste as Record<string, unknown>[]) {
    const p = dernierPoint(e?.geometry)
    const cat = Array.isArray(e?.categories) ? (e.categories[0] as { id?: unknown } | undefined)?.id : undefined
    if (!p || typeof e.id !== 'string' || typeof e.title !== 'string' || typeof cat !== 'string') continue
    const lien = typeof e.link === 'string' && /^https:\/\//.test(e.link) ? e.link : ''
    sortie.push({ id: e.id, titre: e.title.slice(0, 140), categorie: cat, lon: p.lon, lat: p.lat, t: p.t, lien })
  }
  return sortie
}

// ----------------------------------------------------------------------------- GDACS (alertes officielles ONU / Commission européenne)

const GDACS = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH'
const GDACS_CATEGORIE: Record<string, string> = { TC: 'severeStorms', FL: 'floods', VO: 'volcanoes', DR: 'drought', WF: 'wildfires' }
const GDACS_NIVEAU: Record<string, AlerteGdacs> = { green: 'verte', orange: 'orange', red: 'rouge' }
const jour = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

/**
 * Deux requêtes : tout sauf les incendies à tous les niveaux (cyclones en cours, crues, volcans, sécheresses), puis les incendies
 * seulement orange ou rouge (les « verts » sont des centaines de petits feux). Les séismes viennent déjà de l'USGS.
 */
export function urlsGdacs(maintenant: number, jours: number): [string, string] {
  const j = Math.round(Math.min(90, Math.max(1, jours)))
  const dates = `fromdate=${jour(maintenant - j * 86_400_000)}&todate=${jour(maintenant)}`
  return [`${GDACS}?eventlist=TC;FL;VO;DR&alertlevel=Green;Orange;Red&${dates}`, `${GDACS}?eventlist=WF&alertlevel=Orange;Red&${dates}`]
}

/** Date GDACS sans fuseau (« 2026-11-07T14:05:55 ») = UTC. */
const dateGdacs = (v: unknown): number => (typeof v === 'string' ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`) : NaN)

export function lireGdacs(brut: unknown): Evenement[] {
  const liste = (brut as { features?: unknown } | null)?.features
  if (!Array.isArray(liste)) return []
  const sortie: Evenement[] = []
  for (const f of liste as Record<string, unknown>[]) {
    const p = (f?.properties ?? null) as Record<string, unknown> | null
    const c = (f?.geometry as { coordinates?: unknown } | null)?.coordinates
    const cat = typeof p?.eventtype === 'string' ? GDACS_CATEGORIE[p.eventtype] : undefined
    if (!p || !cat || !Array.isArray(c) || typeof p.name !== 'string' || (typeof p.eventid !== 'number' && typeof p.eventid !== 'string')) continue
    const lon = nb(c[0]), lat = nb(c[1]), t = dateGdacs(p.datemodified ?? p.todate ?? p.fromdate)
    if (!bonnePosition(lon, lat) || !Number.isFinite(t)) continue
    const lien = (p.url as { report?: unknown } | undefined)?.report
    sortie.push({
      id: `gdacs:${String(p.eventtype)}:${String(p.eventid)}`, titre: p.name.slice(0, 140), categorie: cat, lon, lat: lat as number, t,
      lien: typeof lien === 'string' && /^https:\/\//.test(lien) ? lien : '', alerte: GDACS_NIVEAU[String(p.alertlevel).toLowerCase()] ?? 'verte', source: 'gdacs',
      pays: typeof p.country === 'string' ? p.country.slice(0, 60) : undefined,
    })
  }
  return sortie
}

const km = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const r = Math.PI / 180, a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2
  return 12_742 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** NASA + GDACS sans doublon : un événement NASA de même catégorie, à moins de 400 km et 6 jours d'un GDACS lui cède la place. */
export function fusionnerEvenements(eonet: readonly Evenement[], gdacs: readonly Evenement[]): Evenement[] {
  const proche = (e: Evenement): boolean => gdacs.some((g) => g.categorie === e.categorie && Math.abs(g.t - e.t) <= 6 * 86_400_000 && km(g.lat, g.lon, e.lat, e.lon) <= 400)
  return [...eonet.filter((e) => !proche(e)), ...gdacs]
}

const COUPLE = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)

/** Réponse de GET /godeye/avions (déjà nettoyée côté API) : on revérifie les types avant de s'en servir. */
export function lireAvionsApi(brut: unknown): Avion[] {
  const l = (brut as { avions?: unknown } | null)?.avions
  if (!Array.isArray(l)) return []
  return (l as Record<string, unknown>[]).filter((a) => typeof a?.id === 'string' && COUPLE(a.lat) && COUPLE(a.lon) && COUPLE(a.alt) && COUPLE(a.vitesse) && COUPLE(a.cap))
    .map((a) => ({
      id: a.id as string, indicatif: String(a.indicatif ?? ''), immat: String(a.immat ?? ''), type: String(a.type ?? ''),
      alt: a.alt as number, sol: a.sol === true, vitesse: a.vitesse as number, cap: a.cap as number,
      lat: a.lat as number, lon: a.lon as number, squawk: String(a.squawk ?? ''), urgence: a.urgence === true, militaire: a.militaire === true, helico: a.helico === true,
    }))
}

export function lireNaviresApi(brut: unknown): Navire[] {
  const l = (brut as { navires?: unknown } | null)?.navires
  if (!Array.isArray(l)) return []
  return (l as Record<string, unknown>[]).filter((n) => typeof n?.id === 'string' && COUPLE(n.lat) && COUPLE(n.lon) && COUPLE(n.vitesse) && COUPLE(n.cap))
    .map((n) => ({
      id: n.id as string, vitesse: n.vitesse as number, cap: n.cap as number, lat: n.lat as number, lon: n.lon as number,
      statut: COUPLE(n.statut) ? (n.statut as number) : null, t: COUPLE(n.t) ? (n.t as number) : null,
    }))
}

export type Tle = { nom: string; l1: string; l2: string }

/** Éléments orbitaux CelesTrak (format TLE, trois lignes par objet) : ne garde que les jeux complets, au plus `max`. */
export function lireTle(brut: unknown, max = 800): Tle[] {
  if (typeof brut !== 'string') return []
  const lignes = brut.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l !== '')
  const sortie: Tle[] = []
  for (let i = 0; i + 2 < lignes.length && sortie.length < max; i++) {
    if (lignes[i + 1].startsWith('1 ') && lignes[i + 2].startsWith('2 ') && lignes[i + 1].length >= 68 && lignes[i + 2].length >= 68) {
      sortie.push({ nom: lignes[i].replace(/^0 /, '').trim().slice(0, 40), l1: lignes[i + 1], l2: lignes[i + 2] })
      i += 2
    }
  }
  return sortie
}

const THEMES_CONNUS: readonly string[] = THEMES.map((t) => t.id)
const NIVEAUX_CONNUS: readonly string[] = ['info', 'warn', 'crit']

/** Réponse de GET /godeye/infos : les lignes illisibles sont ignorées, les liens non https écartés. */
export function lireInfosApi(brut: unknown): { infos: Info[]; sources: SourceInfo[] } {
  const o = (brut ?? {}) as { infos?: unknown; flux?: unknown }
  const infos = (Array.isArray(o.infos) ? (o.infos as Record<string, unknown>[]) : [])
    .filter((a) => typeof a?.id === 'string' && typeof a.titre === 'string' && typeof a.t === 'number' && Number.isFinite(a.t)
      && typeof a.lien === 'string' && /^https:\/\//.test(a.lien) && THEMES_CONNUS.includes(a.theme as string) && NIVEAUX_CONNUS.includes(a.niveau as string))
    .map((a): Info => {
      const place = COUPLE(a.lat) && COUPLE(a.lon)
      return {
        id: a.id as string, titre: a.titre as string, resume: String(a.resume ?? ''), lien: a.lien as string, source: String(a.source ?? ''),
        sourceNom: String(a.source_nom ?? a.source ?? ''), t: a.t as number, theme: a.theme as Info['theme'], niveau: a.niveau as Info['niveau'],
        pays: typeof a.pays === 'string' ? a.pays : null, lat: place ? (a.lat as number) : null, lon: place ? (a.lon as number) : null,
      }
    })
  const sources = (Array.isArray(o.flux) ? (o.flux as Record<string, unknown>[]) : [])
    .filter((s) => typeof s?.id === 'string' && typeof s.nom === 'string')
    .map((s): SourceInfo => ({ id: s.id as string, nom: s.nom as string, ok: s.ok === true, n: COUPLE(s.n) ? (s.n as number) : 0 }))
  return { infos, sources }
}

export function lireMarchesApi(brut: unknown): Marche[] {
  const l = (brut as { marches?: unknown } | null)?.marches
  if (!Array.isArray(l)) return []
  return (l as Record<string, unknown>[]).filter((m) => typeof m?.symbole === 'string' && typeof m.nom === 'string' && COUPLE(m.prix) && COUPLE(m.variation_pct))
    .map((m) => ({ symbole: m.symbole as string, nom: m.nom as string, prix: m.prix as number, variation_pct: m.variation_pct as number, devise: String(m.devise ?? '') }))
}

export function lireFaillesApi(brut: unknown): { total: number; recentes: Faille[] } {
  const o = (brut ?? {}) as { total?: unknown; recentes?: unknown }
  const recentes = (Array.isArray(o.recentes) ? (o.recentes as Record<string, unknown>[]) : [])
    .filter((v) => typeof v?.cve === 'string' && typeof v.nom === 'string' && typeof v.lien === 'string' && /^https:\/\//.test(v.lien))
    .map((v): Faille => ({
      cve: v.cve as string, editeur: String(v.editeur ?? ''), produit: String(v.produit ?? ''), nom: v.nom as string,
      ajoutee: String(v.ajoutee ?? ''), rancongiciel: v.rancongiciel === true, lien: v.lien as string,
    }))
  return { total: COUPLE(o.total) ? (o.total as number) : recentes.length, recentes }
}
