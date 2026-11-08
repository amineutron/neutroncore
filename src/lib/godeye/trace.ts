// God Eye : traces de positions (logique pure, testée dans trace.test.ts). Le dessin ne fait que tracer les polylignes rendues ici.
import { COULEURS_COUCHE } from './couleurs'
import { trace as traceOrbite, type Orbite } from './orbites'

export type Lonlat = [number, number]
export type GenreTrace = 'age' | 'suivi' | 'selection'
/** Une ligne à tracer : plusieurs morceaux (coupés à l'antiméridien), le plus ancien point en premier. */
export type Polyligne = { id: string; genre: GenreTrace; couleur: string; morceaux: Lonlat[][] }
export type PointT = { t: number; lon: number; lat: number }
/** Positions relevées par le navigateur, par identifiant d'objet (`avi:...`, `nav:...`). */
export type Historique = Readonly<Record<string, readonly PointT[]>>

export const COULEUR_SUIVI = '#ffd43b'
export const COULEUR_SELECTION = '#9be8ff'
export const HISTORIQUE_MAX_POINTS = 240
export const ECART_MIN_MS = 4_000

/** Coupe une suite de points là où elle traverse l'antiméridien (écart de longitude > 180). */
export function morceauxDepuisPoints(points: readonly { lon: number; lat: number }[]): Lonlat[][] {
  const sortie: Lonlat[][] = []
  let courant: Lonlat[] = []
  let dernier: number | null = null
  for (const p of points) {
    if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue
    if (dernier !== null && Math.abs(p.lon - dernier) > 180) { sortie.push(courant); courant = [] }
    courant.push([p.lon, p.lat])
    dernier = p.lon
  }
  if (courant.length) sortie.push(courant)
  return sortie.filter((m) => m.length >= 2)
}

/** Ajoute une position à l'historique d'un objet (sans modifier l'ancien) ; ignore un point trop proche dans le temps ou identique. */
export function ajouterPoint(histo: Historique, id: string, p: PointT, max = HISTORIQUE_MAX_POINTS): Historique {
  const liste = histo[id] ?? []
  const dernier = liste[liste.length - 1]
  if (dernier && (p.t - dernier.t < ECART_MIN_MS || (dernier.lon === p.lon && dernier.lat === p.lat))) return histo
  return { ...histo, [id]: [...liste, p].slice(-max) }
}

/** Garde seulement les objets listés (avions et navires : la trace n'existe que pour la sélection). */
export function garderIds(histo: Historique, ids: readonly string[]): Historique {
  const reste = Object.entries(histo).filter(([k]) => ids.includes(k))
  return reste.length === Object.keys(histo).length ? histo : Object.fromEntries(reste)
}

/** Trace de l'objet sélectionné (avion ou navire) d'après les positions relevées ici. */
export function traceSelection(id: string, histo: Historique, couleur = COULEUR_SELECTION): Polyligne | null {
  const morceaux = morceauxDepuisPoints(histo[id] ?? [])
  return morceaux.length ? { id: `sel:${id}`, genre: 'selection', couleur, morceaux } : null
}

/** Trace d'un objet marqué : les positions que le serveur a enregistrées depuis le marquage. */
export function traceSuivi(id: string, points: readonly { lon: number; lat: number }[]): Polyligne | null {
  const morceaux = morceauxDepuisPoints(points)
  return morceaux.length ? { id: `suivi:${id}`, genre: 'suivi', couleur: COULEUR_SUIVI, morceaux } : null
}

export type OptionsSatellites = { minutes?: number; pasMin?: number; max?: number; prioritaires?: readonly string[] }

/**
 * Âge de position des satellites : le chemin parcouru pendant les dernières minutes, calculé depuis les éléments orbitaux.
 * `visibles` = identifiants d'orbites à tracer (null = toutes) ; les prioritaires passent d'abord, puis les stations, jusqu'à `max`.
 */
export function tracesSatellites(orbites: readonly Orbite[], visibles: ReadonlySet<string> | null, maintenant: number, o: OptionsSatellites = {}): Polyligne[] {
  const { minutes = 40, pasMin = 4, max = 80, prioritaires = [] } = o
  const rang = (b: Orbite): number => (prioritaires.includes(b.id) ? 0 : b.groupe === 'stations' ? 1 : 2)
  const choix = orbites.filter((b) => !visibles || visibles.has(b.id)).slice().sort((a, b) => rang(a) - rang(b)).slice(0, max)
  const debut = new Date(maintenant - minutes * 60_000)
  const sortie: Polyligne[] = []
  for (const b of choix) {
    const morceaux = traceOrbite(b, debut, minutes, pasMin).filter((m) => m.length >= 2)
    if (morceaux.length) sortie.push({ id: `age:${b.id}`, genre: 'age', couleur: COULEURS_COUCHE.satellites, morceaux })
  }
  return sortie
}

/** Toutes les lignes à dessiner, sans doublon d'identifiant (la dernière gagne) ; les traces de sélection passent par-dessus. */
export function assembler(...groupes: readonly (readonly (Polyligne | null)[])[]): Polyligne[] {
  const parId = new Map<string, Polyligne>()
  for (const g of groupes) for (const p of g) if (p) parId.set(p.id, p)
  const ordre: Record<GenreTrace, number> = { age: 0, suivi: 1, selection: 2 }
  return [...parId.values()].sort((a, b) => ordre[a.genre] - ordre[b.genre])
}
