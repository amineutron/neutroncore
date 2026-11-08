// God Eye : recherche sur tous les éléments (logique pure, testée dans recherche.test.ts).
import type { CoucheId, Donnees } from './modele'

export type TypeRecherche = 'avion' | 'navire' | 'satellite' | 'seisme' | 'evenement' | 'actualite' | 'pays'
export const TYPES_RECHERCHE: { id: TypeRecherche; nom: string }[] = [
  { id: 'avion', nom: 'avions' }, { id: 'navire', nom: 'navires' }, { id: 'satellite', nom: 'satellites' }, { id: 'seisme', nom: 'séismes' },
  { id: 'evenement', nom: 'événements' }, { id: 'actualite', nom: 'actualités' }, { id: 'pays', nom: 'pays' },
]
export type Resultat = {
  cle: string; type: TypeRecherche
  /** Identifiant de l'objet sur la carte (`avi:...`) ; null pour un pays. */
  objetId: string | null; couche: CoucheId | null
  titre: string; detail: string; lon: number; lat: number; score: number
}
export const COUCHE_DU_TYPE: Record<TypeRecherche, CoucheId | null> = {
  avion: 'avions', navire: 'navires', satellite: 'satellites', seisme: 'seismes', evenement: 'evenements', actualite: 'infos', pays: null,
}
const PREFIXE: Record<Exclude<TypeRecherche, 'pays'>, string> = { avion: 'avi', navire: 'nav', satellite: 'sat', seisme: 'sei', evenement: 'eve', actualite: 'inf' }
export const LONGUEUR_MIN = 2
const PAR_TYPE = 12

export const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Pertinence d'un champ pour la requête (déjà normalisée) : 100 égal, 80 commence par, 60 un mot commence par, 40 contient, 0 rien. */
export function scoreTexte(champ: string, q: string): number {
  if (!q) return 0
  const c = norm(champ)
  if (c === q) return 100
  if (c.startsWith(q)) return 80
  if (c.split(/[^a-z0-9]+/).some((m) => m.startsWith(q))) return 60
  return c.includes(q) ? 40 : 0
}
const meilleur = (champs: readonly (string | undefined)[], q: string): number => Math.max(0, ...champs.map((c) => (c ? scoreTexte(c, q) : 0)))

/** Résultats classés (score, puis type, puis titre) ; `types` null ou vide = tous les types. */
export function chercher(d: Donnees, requete: string, types: ReadonlySet<TypeRecherche> | null = null, max = 40): Resultat[] {
  const q = norm(requete)
  if (q.length < LONGUEUR_MIN) return []
  const veut = (t: TypeRecherche): boolean => !types || types.size === 0 || types.has(t)
  const tous: Resultat[] = []
  const ajoute = (type: Exclude<TypeRecherche, 'pays'>, id: string, champs: (string | undefined)[], titre: string, detail: string, lon: number, lat: number): void => {
    const score = meilleur(champs, q)
    if (score > 0) tous.push({ cle: `${type}:${id}`, type, objetId: `${PREFIXE[type]}:${id}`, couche: COUCHE_DU_TYPE[type], titre, detail, lon, lat, score })
  }
  if (veut('avion')) for (const v of d.avions) ajoute('avion', v.id, [v.indicatif, v.id, v.immat, v.type], v.indicatif || v.immat || v.id.toUpperCase(), `${v.type || 'type inconnu'}${v.immat ? ` - ${v.immat}` : ''} - ${v.id.toUpperCase()}`, v.lon, v.lat)
  if (veut('navire')) for (const n of d.navires) ajoute('navire', n.id, [n.id], `MMSI ${n.id}`, `${n.vitesse.toFixed(1)} nœuds - cap ${Math.round(n.cap)}`, n.lon, n.lat)
  if (veut('satellite')) for (const s of d.satellites) ajoute('satellite', s.id, [s.nom, s.id], s.nom, `altitude ${Math.round(s.altKm)} km`, s.lon, s.lat)
  if (veut('seisme')) for (const s of d.seismes) ajoute('seisme', s.id, [s.lieu, `M ${s.mag.toFixed(1)}`], `M ${s.mag.toFixed(1)}`, s.lieu || 'position en mer', s.lon, s.lat)
  if (veut('evenement')) for (const e of d.evenements) ajoute('evenement', e.id, [e.titre, e.pays], e.titre, e.pays ?? e.categorie, e.lon, e.lat)
  if (veut('actualite')) for (const a of d.infos) if (a.lat !== null && a.lon !== null) ajoute('actualite', a.id, [a.titre, a.pays ?? undefined], a.titre, `${a.sourceNom}${a.pays ? ` - ${a.pays}` : ''}`, a.lon, a.lat)
  if (veut('pays')) tous.push(...paysTrouves(d, q))
  const ordreType = new Map(TYPES_RECHERCHE.map((t, i) => [t.id, i]))
  const trie = tous.sort((a, b) => b.score - a.score || (ordreType.get(a.type) ?? 0) - (ordreType.get(b.type) ?? 0) || a.titre.localeCompare(b.titre, 'fr'))
  const compte = new Map<TypeRecherche, number>()
  const sortie: Resultat[] = []
  for (const r of trie) {   // pas plus de PAR_TYPE par type : 600 satellites ne doivent pas masquer le reste
    const n = compte.get(r.type) ?? 0
    if (n >= PAR_TYPE) continue
    compte.set(r.type, n + 1)
    sortie.push(r)
    if (sortie.length >= max) break
  }
  return sortie
}

/** Un résultat par pays cité (actualités et événements), placé au centre de ses éléments localisés. */
function paysTrouves(d: Donnees, q: string): Resultat[] {
  const parPays = new Map<string, { nom: string; lons: number[]; lats: number[]; infos: number; evenements: number }>()
  const noter = (nom: string | null | undefined, lon: number | null, lat: number | null, genre: 'infos' | 'evenements'): void => {
    if (!nom || lon === null || lat === null) return
    const cle = norm(nom)
    const e = parPays.get(cle) ?? { nom, lons: [], lats: [], infos: 0, evenements: 0 }
    e.lons.push(lon); e.lats.push(lat); e[genre] += 1
    parPays.set(cle, e)
  }
  for (const a of d.infos) noter(a.pays, a.lon, a.lat, 'infos')
  for (const e of d.evenements) noter(e.pays, e.lon, e.lat, 'evenements')
  const moy = (l: number[]): number => l.reduce((a, b) => a + b, 0) / l.length
  const sortie: Resultat[] = []
  for (const [cle, e] of parPays) {
    const base = scoreTexte(e.nom, q)
    if (!base) continue
    const score = base + 5   // un nom de pays tapé en entier désigne le pays, avant les actualités qui le citent
    const parts = [e.infos ? `${e.infos} actualité${e.infos > 1 ? 's' : ''}` : '', e.evenements ? `${e.evenements} événement${e.evenements > 1 ? 's' : ''}` : ''].filter(Boolean)
    sortie.push({ cle: `pays:${cle}`, type: 'pays', objetId: null, couche: null, titre: e.nom, detail: parts.join(', '), lon: moy(e.lons), lat: moy(e.lats), score })
  }
  return sortie
}
