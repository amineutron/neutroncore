// God Eye : filtres activables et enregistrables, et passage des données brutes aux objets de la carte.
// Logique pure, testée dans filtres.test.ts : aucun accès réseau, aucune horloge (l'heure est un paramètre).
import { FRANCE, rayonSeisme, tonSeisme } from '../vueMonde'
import {
  CATEGORIES_EVENEMENT, COUCHES, GROUPES_SAT,
  THEMES, type Avion, type Boite, type CoucheId, type Donnees, type GroupeSat, type Info, type NiveauInfo, type Objet, type Theme, type Ton,
} from './modele'

export type Filtres = {
  couches: Record<CoucheId, boolean>
  texte: string
  /** Ne garder que ce qui est dans la zone visible de la carte. */
  vueSeule: boolean
  seismes: { magMin: number; profMax: number; periode: 'jour' | 'semaine' }
  avions: { mode: 'zone' | 'militaires'; altMin: number; altMax: number; vitesseMin: number; sol: boolean; militairesSeuls: boolean; urgencesSeules: boolean }
  satellites: { groupes: GroupeSat[]; altMaxKm: number }
  navires: { vitesseMin: number }
  evenements: { categories: string[]; jours: number }
  infos: { themes: Theme[]; niveauMin: NiveauInfo; heures: number; sources: string[]; avecLieu: boolean }
  cyber: { niveauMin: 'info' | 'warn' | 'crit' }
}

export const ALT_MAX_FT = 45_000

/** Les couches citées sont allumées, toutes les autres éteintes. */
export function choisirCouches(...ids: CoucheId[]): Record<CoucheId, boolean> {
  return Object.fromEntries(COUCHES.map((c) => [c.id, ids.includes(c.id)])) as Record<CoucheId, boolean>
}
export const FILTRES_DEFAUT: Filtres = {
  couches: choisirCouches('infos', 'seismes', 'cyber'),
  texte: '', vueSeule: false,
  seismes: { magMin: 2.5, profMax: 700, periode: 'jour' },
  avions: { mode: 'zone', altMin: 0, altMax: ALT_MAX_FT, vitesseMin: 0, sol: false, militairesSeuls: false, urgencesSeules: false },
  satellites: { groupes: ['stations'], altMaxKm: 40_000 },
  navires: { vitesseMin: 0 },
  evenements: { categories: CATEGORIES_EVENEMENT.map((c) => c.id), jours: 30 },
  infos: { themes: THEMES.map((t) => t.id).filter((id) => id !== 'monde'), niveauMin: 'info', heures: 24, sources: [], avecLieu: false },
  cyber: { niveauMin: 'info' },
}

const borne = (v: unknown, min: number, max: number, repli: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : repli

/** Relit des filtres enregistrés (localStorage ou serveur) : tout ce qui est inattendu retombe sur le défaut. */
export function lireFiltres(brut: unknown): Filtres {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, Record<string, unknown> | unknown>
  const sous = (k: string): Record<string, unknown> => (o[k] && typeof o[k] === 'object' ? (o[k] as Record<string, unknown>) : {})
  const d = FILTRES_DEFAUT
  const co = sous('couches')
  const couches = Object.fromEntries(COUCHES.map((c) => [c.id, typeof co[c.id] === 'boolean' ? co[c.id] : d.couches[c.id]])) as Record<CoucheId, boolean>
  const inf = sous('infos'), se = sous('seismes'), av = sous('avions'), sa = sous('satellites'), na = sous('navires'), ev = sous('evenements'), cy = sous('cyber')
  const groupes = Array.isArray(sa.groupes) ? GROUPES_SAT.map((g) => g.id).filter((id) => (sa.groupes as unknown[]).includes(id)) : d.satellites.groupes
  const categories = Array.isArray(ev.categories) ? CATEGORIES_EVENEMENT.map((c) => c.id).filter((id) => (ev.categories as unknown[]).includes(id)) : d.evenements.categories
  const altMin = borne(av.altMin, 0, ALT_MAX_FT, 0)
  const themes = Array.isArray(inf.themes) ? THEMES.map((t) => t.id).filter((id) => (inf.themes as unknown[]).includes(id)) : d.infos.themes
  const sources = Array.isArray(inf.sources) ? (inf.sources as unknown[]).filter((v): v is string => typeof v === 'string' && /^[a-z0-9]{2,20}$/.test(v)).slice(0, 40) : []
  return {
    couches,
    texte: typeof o.texte === 'string' ? o.texte.slice(0, 60) : '',
    vueSeule: o.vueSeule === true,
    seismes: { magMin: borne(se.magMin, 2.5, 8, 2.5), profMax: borne(se.profMax, 10, 700, 700), periode: se.periode === 'semaine' ? 'semaine' : 'jour' },
    avions: {
      mode: av.mode === 'militaires' ? 'militaires' : 'zone',
      altMin, altMax: Math.max(altMin, borne(av.altMax, 0, ALT_MAX_FT, ALT_MAX_FT)),
      vitesseMin: borne(av.vitesseMin, 0, 700, 0), sol: av.sol === true,
      militairesSeuls: av.militairesSeuls === true, urgencesSeules: av.urgencesSeules === true,
    },
    satellites: { groupes, altMaxKm: borne(sa.altMaxKm, 300, 40_000, 40_000) },
    navires: { vitesseMin: borne(na.vitesseMin, 0, 40, 0) },
    evenements: { categories, jours: Math.round(borne(ev.jours, 1, 90, 30)) },
    infos: {
      themes, sources, niveauMin: inf.niveauMin === 'crit' || inf.niveauMin === 'warn' ? inf.niveauMin : 'info',
      heures: Math.round(borne(inf.heures, 1, 72, 24)), avecLieu: inf.avecLieu === true,
    },
    cyber: { niveauMin: cy.niveauMin === 'crit' || cy.niveauMin === 'warn' ? cy.niveauMin : 'info' },
  }
}

/** Nouvelle valeur de filtres : `miseAJour` est fusionnée un niveau plus bas (l'original n'est pas modifié). */
export function modifier<K extends keyof Filtres>(f: Filtres, cle: K, valeur: Partial<Filtres[K]> | Filtres[K]): Filtres {
  const actuel = f[cle]
  const fusion = actuel && typeof actuel === 'object' && !Array.isArray(actuel) && valeur && typeof valeur === 'object'
    ? { ...actuel, ...valeur } : valeur
  return lireFiltres({ ...f, [cle]: fusion })
}

export function basculerCouche(f: Filtres, id: CoucheId): Filtres {
  return { ...f, couches: { ...f.couches, [id]: !f.couches[id] } }
}

/** Ajoute ou retire une valeur d'une liste de filtres (groupes de satellites, catégories d'événements). */
export function basculerDans<T>(liste: readonly T[], valeur: T): T[] {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur]
}

// ----------------------------------------------------------------------------- résumé

/** Ce qui s'écarte du réglage de départ, en phrases courtes (puces « filtres actifs » et liste des vues). */
export function resumeFiltres(f: Filtres): string[] {
  const d = FILTRES_DEFAUT
  const r: string[] = []
  if (f.texte.trim()) r.push(`texte « ${f.texte.trim()} »`)
  if (f.vueSeule) r.push('zone visible seulement')
  if (f.couches.seismes) {
    if (f.seismes.magMin > d.seismes.magMin) r.push(`séismes M${f.seismes.magMin}+`)
    if (f.seismes.profMax < d.seismes.profMax) r.push(`séismes moins de ${f.seismes.profMax} km de profondeur`)
    if (f.seismes.periode === 'semaine') r.push('séismes sur 7 jours')
  }
  if (f.couches.avions) {
    const a = f.avions
    if (a.mode === 'militaires') r.push('avions militaires du monde')
    if (a.militairesSeuls) r.push('militaires seulement')
    if (a.urgencesSeules) r.push('urgences seulement')
    if (a.altMin > 0 || a.altMax < ALT_MAX_FT) r.push(`altitude FL${Math.round(a.altMin / 100)} à FL${Math.round(a.altMax / 100)}`)
    if (a.vitesseMin > 0) r.push(`avions plus de ${a.vitesseMin} kt`)
    if (a.sol) r.push('avions au sol inclus')
  }
  if (f.couches.satellites && (f.satellites.altMaxKm < 40_000)) r.push(`satellites sous ${f.satellites.altMaxKm} km`)
  if (f.couches.navires && f.navires.vitesseMin > 0) r.push(`navires plus de ${f.navires.vitesseMin} nœuds`)
  if (f.couches.evenements) {
    if (f.evenements.categories.length < d.evenements.categories.length) r.push(`événements : ${f.evenements.categories.length} catégories`)
    if (f.evenements.jours !== d.evenements.jours) r.push(`événements sur ${f.evenements.jours} j`)
  }
  if (f.couches.infos) {
    const i = f.infos
    if (i.themes.length < d.infos.themes.length) r.push(`actualités : ${i.themes.map((id) => THEMES.find((t) => t.id === id)?.nom ?? id).join(', ') || 'aucun thème'}`)
    if (i.niveauMin !== 'info') r.push(`actualités ${i.niveauMin === 'crit' ? 'critiques' : 'importantes'} seulement`)
    if (i.heures !== d.infos.heures) r.push(`actualités des ${i.heures} dernières heures`)
    if (i.sources.length) r.push(`${i.sources.length} source${i.sources.length > 1 ? 's' : ''} d'actualités`)
    if (i.avecLieu) r.push('actualités localisées seulement')
  }
  if (f.couches.cyber && f.cyber.niveauMin !== 'info') r.push(`cyber ${f.cyber.niveauMin === 'crit' ? 'critique' : 'attention'} et plus`)
  return r
}

/** Couches allumées, dans l'ordre de l'écran. */
export const couchesActives = (f: Filtres): CoucheId[] => COUCHES.filter((c) => f.couches[c.id]).map((c) => c.id)

// ----------------------------------------------------------------------------- géométrie

/** Position estimée d'un mobile `dtS` secondes après son relevé (route sur le fond constante, sphère). */
export function extrapoler(lat: number, lon: number, vitesseKt: number, capDeg: number, dtS: number): [number, number] {
  if (!(vitesseKt > 0) || !(dtS > 0)) return [lat, lon]
  const d = (vitesseKt * 1852 * dtS) / 3600 / 6_371_000   // distance angulaire
  const cap = (capDeg * Math.PI) / 180
  const p1 = (lat * Math.PI) / 180, l1 = (lon * Math.PI) / 180
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(cap))
  const l2 = l1 + Math.atan2(Math.sin(cap) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2))
  return [(p2 * 180) / Math.PI, ((((l2 * 180) / Math.PI + 540) % 360) - 180)]
}
const EXTRAPOLATION_MAX_S = 45

export function dansBoite(b: Boite | null, lon: number, lat: number): boolean {
  return !b || (lat >= b.sud && lat <= b.nord && lon >= b.ouest && lon <= b.est)
}

// ----------------------------------------------------------------------------- données -> objets

export type Contexte = { maintenant: number; boite: Boite | null; niveauCyber: 'ok' | 'info' | 'warn' | 'crit' }
const RANG_NIVEAU = { ok: 0, info: 1, warn: 2, crit: 3 } as const
const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const nomAvion = (a: Avion): string => a.indicatif || a.immat || a.id.toUpperCase()
const flAlt = (alt: number): string => (alt <= 0 ? 'au sol' : `FL${String(Math.round(alt / 100)).padStart(3, '0')}`)

/** Applique les filtres et produit les objets à dessiner. `seismes` etc. sont les données DÉJÀ chargées. */
const RANG_INFO: Record<NiveauInfo, number> = { info: 0, warn: 1, crit: 2 }
const TON_INFO: Record<NiveauInfo, Ton> = { info: 'info', warn: 'warn', crit: 'crit' }

/** Actualités retenues par les filtres (thèmes, niveau, fraîcheur, sources, texte, zone) : celles sans lieu restent dans le fil. */
export function infosFiltrees(infos: readonly Info[], f: Filtres, ctx: Contexte): Info[] {
  const i = f.infos
  const q = norm(f.texte.trim())
  const limite = ctx.maintenant - i.heures * 3_600_000
  return infos.filter((a) => {
    if (a.t < limite || !i.themes.includes(a.theme) || RANG_INFO[a.niveau] < RANG_INFO[i.niveauMin]) return false
    if (i.sources.length && !i.sources.includes(a.source)) return false
    if ((i.avecLieu || (f.vueSeule && ctx.boite)) && (a.lat === null || a.lon === null)) return false
    if (f.vueSeule && a.lat !== null && a.lon !== null && !dansBoite(ctx.boite, a.lon, a.lat)) return false
    return !q || norm(`${a.titre} ${a.pays ?? ''} ${a.sourceNom}`).includes(q)
  })
}

/** Petit décalage stable (jusqu'à ~1,2 degré) : les actualités d'un même pays ne se superposent pas toutes sur son centre. */
export function ecartStable(id: string): [number, number] {
  let h = 2166136261
  for (let k = 0; k < id.length; k++) h = Math.imul(h ^ id.charCodeAt(k), 16777619)
  return [(((h >>> 0) % 1000) / 1000 - 0.5) * 2.4, ((((h >>> 10) >>> 0) % 1000) / 1000 - 0.5) * 2.4]
}

export function appliquer(d: Donnees, f: Filtres, ctx: Contexte): Objet[] {
  const q = norm(f.texte.trim())
  const sortie: Objet[] = []
  const zone = f.vueSeule ? ctx.boite : null
  const garde = (titre: string, detail: string): boolean => !q || norm(`${titre} ${detail}`).includes(q)

  if (f.couches.seismes) {
    for (const s of d.seismes) {
      if (s.mag < f.seismes.magMin || s.prof > f.seismes.profMax || !dansBoite(zone, s.lon, s.lat)) continue
      const titre = `M ${s.mag.toFixed(1)}`
      const detail = `${s.lieu || 'position en mer'} - profondeur ${Math.round(s.prof)} km`
      if (!garde(titre, detail)) continue
      sortie.push({ id: `sei:${s.id}`, couche: 'seismes', lon: s.lon, lat: s.lat, ton: tonSeisme(s.mag), rayon: rayonSeisme(s.mag), titre, detail, t: s.t })
    }
  }
  if (f.couches.avions) {
    const a = f.avions
    const dt = Math.min(EXTRAPOLATION_MAX_S, Math.max(0, (ctx.maintenant - d.releveAvions) / 1000))
    for (const v of d.avions) {
      if (v.sol && !a.sol) continue
      if (!v.sol && (v.alt < a.altMin || v.alt > a.altMax)) continue
      if (v.vitesse < a.vitesseMin || (a.militairesSeuls && !v.militaire) || (a.urgencesSeules && !v.urgence)) continue
      const [lat, lon] = v.sol ? [v.lat, v.lon] : extrapoler(v.lat, v.lon, v.vitesse, v.cap, dt)
      if (!dansBoite(zone, lon, lat)) continue
      const titre = nomAvion(v)
      const detail = `${v.type || 'type inconnu'} - ${flAlt(v.alt)} - ${Math.round(v.vitesse)} kt - cap ${Math.round(v.cap)}${v.immat && v.indicatif ? ` - ${v.immat}` : ''}${v.urgence ? ` - URGENCE ${v.squawk}` : ''}`
      if (!garde(titre, detail)) continue
      const ton: Ton = v.urgence ? 'crit' : v.militaire ? 'warn' : 'info'
      sortie.push({ id: `avi:${v.id}`, couche: 'avions', lon, lat, cap: v.cap, ton, rayon: v.urgence ? 7 : 5, titre, detail, sorte: v.militaire ? 'militaire' : 'civil' })
    }
  }
  if (f.couches.satellites) {
    for (const s of d.satellites) {
      if (!f.satellites.groupes.includes(s.groupe) || s.altKm > f.satellites.altMaxKm || !dansBoite(zone, s.lon, s.lat)) continue
      const detail = `altitude ${Math.round(s.altKm)} km - ${s.vitesseKms.toFixed(1)} km/s`
      if (!garde(s.nom, detail)) continue
      sortie.push({ id: `sat:${s.id}`, couche: 'satellites', lon: s.lon, lat: s.lat, ton: 'ok', rayon: s.groupe === 'stations' ? 6 : 3.5, titre: s.nom, detail, sorte: s.groupe })
    }
  }
  if (f.couches.navires) {
    const dt = Math.min(EXTRAPOLATION_MAX_S, Math.max(0, (ctx.maintenant - d.releveNavires) / 1000))
    for (const n of d.navires) {
      if (n.vitesse < f.navires.vitesseMin) continue
      const [lat, lon] = extrapoler(n.lat, n.lon, n.vitesse, n.cap, dt)
      if (!dansBoite(zone, lon, lat)) continue
      const titre = `MMSI ${n.id}`
      const detail = `${n.vitesse.toFixed(1)} nœuds - cap ${Math.round(n.cap)}`
      if (!garde(titre, detail)) continue
      sortie.push({ id: `nav:${n.id}`, couche: 'navires', lon, lat, cap: n.cap, ton: 'ok', rayon: 4.5, titre, detail, t: n.t ?? undefined })
    }
  }
  if (f.couches.evenements) {
    const limite = ctx.maintenant - f.evenements.jours * 86_400_000
    for (const e of d.evenements) {
      if (!f.evenements.categories.includes(e.categorie) || e.t < limite || !dansBoite(zone, e.lon, e.lat)) continue
      const cat = CATEGORIES_EVENEMENT.find((c) => c.id === e.categorie)
      const detail = cat?.nom ?? e.categorie
      if (!garde(e.titre, detail)) continue
      sortie.push({ id: `eve:${e.id}`, couche: 'evenements', lon: e.lon, lat: e.lat, ton: cat?.ton ?? 'info', rayon: 6, titre: e.titre, detail, t: e.t, lien: e.lien, sorte: e.categorie })
    }
  }
  if (f.couches.infos) {
    for (const a of infosFiltrees(d.infos, f, ctx)) {
      if (a.lat === null || a.lon === null) continue
      const [dx, dy] = ecartStable(a.id)
      sortie.push({
        id: `inf:${a.id}`, couche: 'infos', lon: a.lon + dx, lat: Math.max(-85, Math.min(85, a.lat + dy)), ton: TON_INFO[a.niveau],
        rayon: a.niveau === 'crit' ? 8 : 7, titre: a.titre, detail: `${a.sourceNom}${a.pays ? ` - ${a.pays}` : ''}`, t: a.t, lien: a.lien, sorte: a.theme,
      })
    }
  }
  if (f.couches.cyber && RANG_NIVEAU[ctx.niveauCyber] >= RANG_NIVEAU[f.cyber.niveauMin] && dansBoite(zone, FRANCE.lon, FRANCE.lat)) {
    sortie.push({ id: 'cyber:fr', couche: 'cyber', lon: FRANCE.lon, lat: FRANCE.lat, ton: ctx.niveauCyber === 'ok' ? 'ok' : ctx.niveauCyber, rayon: 6, titre: 'niveau cyber', detail: ctx.niveauCyber })
  }
  return sortie
}

// ----------------------------------------------------------------------------- vues de départ

export type VueEnregistree = { id: string; nom: string; filtres: Filtres; camera: { cx: number; cy: number; zoom: number } | null; integree?: boolean }

const base = (nom: string, id: string, surcharge: Partial<Filtres>, camera: VueEnregistree['camera'] = null): VueEnregistree => ({
  id, nom, integree: true, camera, filtres: lireFiltres({ ...FILTRES_DEFAUT, ...surcharge }),
})

/** Vues toutes faites, non supprimables : un point de départ pour comprendre les filtres. */
export const VUES_INTEGREES: VueEnregistree[] = [
  base('tout', 'int-tout', { couches: choisirCouches('infos', 'seismes', 'avions', 'satellites', 'navires', 'evenements', 'cyber') }),
  base('guerre et diplomatie', 'int-guerre', {
    couches: choisirCouches('infos', 'avions'),
    infos: { ...FILTRES_DEFAUT.infos, themes: ['guerre', 'diplomatie'], heures: 48 },
    avions: { ...FILTRES_DEFAUT.avions, mode: 'militaires', militairesSeuls: true },
  }),
  base('économie', 'int-eco', { couches: choisirCouches('infos'), infos: { ...FILTRES_DEFAUT.infos, themes: ['economie'], heures: 48 } }),
  base('cybersécurité', 'int-cyber', {
    couches: choisirCouches('infos', 'cyber'),
    infos: { ...FILTRES_DEFAUT.infos, themes: ['cyber'], heures: 72 },
  }),
  base('sécurité et crises', 'int-secu', { couches: choisirCouches('infos'), infos: { ...FILTRES_DEFAUT.infos, themes: ['securite', 'catastrophe'], niveauMin: 'warn' } }),
  base('catastrophes', 'int-cata', {
    couches: choisirCouches('seismes', 'evenements'),
    seismes: { ...FILTRES_DEFAUT.seismes, magMin: 5 },
    evenements: { categories: ['wildfires', 'volcanoes', 'severeStorms', 'floods'], jours: 14 },
  }),
  base('ciel militaire', 'int-mil', {
    couches: choisirCouches('avions'),
    avions: { ...FILTRES_DEFAUT.avions, mode: 'militaires', militairesSeuls: true },
  }),
  base('orbite', 'int-orbite', {
    couches: choisirCouches('satellites'),
    satellites: { groupes: ['stations', 'visual', 'gps-ops'], altMaxKm: 40_000 },
  }),
  base('avions en croisière', 'int-croisiere', {
    couches: choisirCouches('avions'),
    avions: { ...FILTRES_DEFAUT.avions, altMin: 30_000, vitesseMin: 350 },
    vueSeule: true,
  }),
]
