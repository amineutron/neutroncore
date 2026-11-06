// Rampes de lumière, version simple : quelques modèles nommés, une courbe de luminosité qu'on tire à la souris,
// une durée en minutes, des lampes par leur nom. Logique pure (testée dans rampesAssistant.test.ts).
// Vocabulaire commun avec le réveil : « la lumière monte / baisse », « pleine lumière », « lampes », « montée ».
import { BRI_MAX, courbeGamma, courbeLineaire, dureeLisible, mettreALechelle, valeur, type Point, type Rampe } from './rampes'

export type ModeleSimple = {
  id: string; nom: string; desc: string
  /** durée proposée (min), plage conseillée et luminosité maximale proposée (%) */
  duree_min: number; max_pct: number
  fabrique: (o: { duree_min: number; lampes: string[]; max_pct: number }) => Omit<Rampe, 'id'>
}

const bri = (pct: number) => Math.round((Math.min(Math.max(pct, 1), 100) / 100) * BRI_MAX)
const base = (nom: string, duree_s: number, boucle: boolean, lampes: string[], b: Point[], k: Point[]): Omit<Rampe, 'id'> =>
  ({ nom, duree_s, pas_s: duree_s <= 120 ? 3 : 10, boucle, pistes: [{ lampes, bri: b, kelvin: k }] })

export const MODELES_SIMPLES: ModeleSimple[] = [
  {
    id: 'lever', nom: 'lever de soleil', desc: 'la lumière monte doucement, du rouge-orange au blanc du jour', duree_min: 20, max_pct: 100,
    fabrique: ({ duree_min, lampes, max_pct }) => base('lever de soleil', duree_min * 60, false, lampes,
      courbeGamma(duree_min * 60, 1, bri(max_pct)), courbeLineaire(duree_min * 60, 2200, 5000, 'doux')),
  },
  {
    id: 'coucher', nom: 'coucher de soleil', desc: 'la lumière baisse et rougit jusqu’à presque rien', duree_min: 45, max_pct: 80,
    fabrique: ({ duree_min, lampes, max_pct }) => base('coucher de soleil', duree_min * 60, false, lampes,
      courbeGamma(duree_min * 60, bri(max_pct), 8, 0.5), courbeLineaire(duree_min * 60, 3800, 2200, 'doux')),
  },
  {
    id: 'lecture', nom: 'lecture', desc: 'monte vite à une lumière blanche et confortable, puis reste stable', duree_min: 60, max_pct: 70,
    fabrique: ({ duree_min, lampes, max_pct }) => {
      const d = duree_min * 60
      return base('lecture', d, false, lampes,
        [{ t: 0, v: bri(15), forme: 'doux' }, { t: Math.min(120, d / 4), v: bri(max_pct), forme: 'lineaire' }, { t: d, v: bri(max_pct), forme: 'lineaire' }],
        courbeLineaire(d, 3800, 3800))
    },
  },
  {
    id: 'nuit', nom: 'nuit douce', desc: 'très peu de lumière, très chaude, qui s’éteint toute seule', duree_min: 30, max_pct: 15,
    fabrique: ({ duree_min, lampes, max_pct }) => base('nuit douce', duree_min * 60, false, lampes,
      courbeLineaire(duree_min * 60, bri(max_pct), 1, 'doux'), courbeLineaire(duree_min * 60, 2200, 2200)),
  },
]

export const modeleSimple = (id: string): ModeleSimple | undefined => MODELES_SIMPLES.find((m) => m.id === id)

/** Rampe prête à éditer depuis un modèle nommé (durée et luminosité du modèle). */
export function depuisModeleSimple(id: string, lampes: string[] = []): Omit<Rampe, 'id'> | null {
  const m = modeleSimple(id)
  return m ? m.fabrique({ duree_min: m.duree_min, lampes, max_pct: m.max_pct }) : null
}

// --- réglages simples (immuables) ---

/** Même forme sur une autre durée, en minutes. */
export function reglerDuree(r: Rampe, minutes: number): Rampe {
  const vers = Math.max(1, Math.round(minutes)) * 60
  return { ...r, duree_s: vers, pistes: r.pistes.map((p) => ({ ...p, bri: mettreALechelle(p.bri, r.duree_s, vers), kelvin: mettreALechelle(p.kelvin, r.duree_s, vers) })) }
}

/** Luminosité la plus forte de la rampe, en % (0 si pas de courbe). */
export function maxPourcent(r: Rampe): number {
  const m = Math.max(0, ...r.pistes.flatMap((p) => p.bri.map((x) => x.v)))
  return Math.round((m / BRI_MAX) * 100)
}

/** Ramène la luminosité la plus forte à `pct` % en gardant la forme. */
export function reglerMax(r: Rampe, pct: number): Rampe {
  const actuel = Math.max(1, ...r.pistes.flatMap((p) => p.bri.map((x) => x.v)))
  const f = bri(pct) / actuel
  return { ...r, pistes: r.pistes.map((p) => ({ ...p, bri: p.bri.map((x) => ({ ...x, v: Math.min(BRI_MAX, Math.round(x.v * f * 100) / 100) })) })) }
}

/** Mots pour une température de couleur (K). */
export function motCouleur(k: number): string {
  if (k <= 2400) return 'bougie'
  if (k <= 3100) return 'chaude'
  if (k <= 4300) return 'neutre'
  return 'du jour'
}
export const COULEURS = [
  { k: 2200, nom: 'bougie' }, { k: 2700, nom: 'chaude' }, { k: 4000, nom: 'neutre' }, { k: 5500, nom: 'lumière du jour' },
] as const

/** Couleur du début et de la fin d'une piste, par mots (ou null si la rampe ne touche pas à la couleur). */
export function couleursEnMots(r: Rampe): { debut: string; fin: string } | null {
  const k = r.pistes[0]?.kelvin ?? []
  if (!k.length) return null
  return { debut: motCouleur(k[0].v), fin: motCouleur(k[k.length - 1].v) }
}

/** Remplace la courbe de couleur par un trajet simple d'une température à l'autre. */
export function reglerCouleurs(r: Rampe, debutK: number, finK: number): Rampe {
  return { ...r, pistes: r.pistes.map((p) => ({ ...p, kelvin: courbeLineaire(r.duree_s, debutK, finK, 'doux') })) }
}

type Tendance = 'monte' | 'baisse' | 'stable' | 'varie'
/** Sens général de la luminosité (première piste) : monte, baisse, reste stable ou va et vient. */
export function tendance(r: Rampe): Tendance {
  const p = r.pistes[0]?.bri ?? []
  if (p.length < 2) return 'stable'
  const a = valeur(p, 0) ?? 0, z = valeur(p, r.duree_s) ?? 0
  const haut = Math.max(...p.map((x) => x.v)), bas = Math.min(...p.map((x) => x.v))
  if (Math.abs(z - a) < 0.05 * BRI_MAX) return haut - bas > 0.2 * BRI_MAX ? 'varie' : 'stable'
  return z > a ? 'monte' : 'baisse'
}

const pct = (v: number) => `${Math.max(1, Math.round((v / BRI_MAX) * 100))} %`
const liste = (x: string[]) => x.length <= 1 ? (x[0] ?? '') : `${x.slice(0, -1).join(', ')} et ${x[x.length - 1]}`

/** « Pendant 20 min, la lumière monte de 1 % à 100 % sur salon, du rouge-orange au blanc du jour. » */
export function phraseRampe(r: Rampe, lampes: Record<string, string> = {}): string {
  const p = r.pistes[0]
  if (!p || !p.bri.length) return 'Cette montée n’a pas encore de courbe de lumière.'
  const ids = r.pistes.flatMap((x) => x.lampes)
  const ou = ids.length ? ` sur ${liste(ids.map((i) => lampes[i] ?? `lampe ${i}`))}` : ' (aucune lampe choisie)'
  const a = valeur(p.bri, 0) ?? 0, z = valeur(p.bri, r.duree_s) ?? 0
  const t = tendance(r)
  const quoi = t === 'monte' ? `la lumière monte de ${pct(a)} à ${pct(z)}` : t === 'baisse' ? `la lumière baisse de ${pct(a)} à ${pct(z)}`
    : t === 'varie' ? `la lumière va et vient autour de ${pct(a)}` : `la lumière reste à ${pct(a)}`
  const c = couleursEnMots(r)
  const teinte = !c ? '' : c.debut === c.fin ? `, en lumière ${c.debut}` : `, de la lumière ${c.debut} à la lumière ${c.fin}`
  return `Pendant ${dureeLisible(r.duree_s)}, ${quoi}${ou}${teinte}${r.boucle ? ', en boucle jusqu’à l’arrêt' : ''}.`
}

/** Ce qui empêche d'enregistrer, en clair ('' = rien). */
export function problemeRampe(r: Rampe): string {
  if (!r.nom.trim()) return 'donne un nom à cette montée'
  if (r.pistes.some((p) => !p.lampes.length)) return 'choisis au moins une lampe'
  if (r.pistes.some((p) => !p.bri.length)) return 'la courbe de luminosité est vide'
  return ''
}

// --- le réveil se sert d'une rampe ---

/** Une rampe peut servir de montée de réveil si la lumière finit plus forte qu'elle ne commence. */
export const peutServirAuReveil = (r: Rampe): boolean => tendance(r) === 'monte'

/** Les deux courbes (luminosité, couleur) de la première piste, remises à l'échelle d'un réveil de `dureeMin` minutes. */
export function courbesPourReveil(r: Rampe, dureeMin: number): { bri: Point[]; kelvin: Point[] } {
  const p = r.pistes[0], vers = dureeMin * 60
  return { bri: mettreALechelle(p.bri, r.duree_s, vers), kelvin: mettreALechelle(p.kelvin, r.duree_s, vers) }
}

/** L'inverse : une rampe jouable à partir des courbes d'un réveil (pour « en faire une montée réutilisable »). */
export function rampeDepuisCourbes(nom: string, dureeMin: number, lampes: string[], c: { bri: Point[]; kelvin: Point[] }): Omit<Rampe, 'id'> {
  return { nom, duree_s: dureeMin * 60, pas_s: 10, boucle: false, pistes: [{ lampes, bri: c.bri, kelvin: c.kelvin }] }
}

/** Passerelle entre les écrans : la rampe choisie voyage par sessionStorage. */
export const MONTEE_POUR_REVEIL = 'neutroncore_reveil_montee'
