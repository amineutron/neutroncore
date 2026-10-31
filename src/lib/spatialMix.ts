// Mix de scènes : plusieurs scènes (2d et 3d) jouées ensemble, rangées par priorité, chacune pour toutes les lampes ou
// pour un groupe. Logique pure, testée dans spatialMix.test.ts. `superposer` est le miroir exact de celui de spatial_fx.py
// (huebeat, les vraies lampes) ; `sortieMix` en est la version d'aperçu (sans le gamma des lampes : voir `lumiereMontree`).
import { evaluer, type Dims, type Fixture, type FxId, type FxParams, type RGB, type Scene, type Sortie, type Vec3 } from './spatialFx'

export const MAX_COUCHES = 6       // comme MAX_COUCHES de lib/spatial.py (API)

/** Une couche : une scène du pad, pour toutes les lampes (`canaux` absent) ou pour les canaux listés. */
export type CoucheMix = { scene: string; canaux?: string[] }
/** Un mix enregistré : la première couche est la plus prioritaire, elle masque les suivantes là où elle éclaire. */
export type Mix = { id: string; nom: string; couches: CoucheMix[] }
export type CoucheResolue = { scene: Scene; canaux?: string[] }

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
const parNumero = (a: string, b: string): number => Number(a) - Number(b)

// ---- calcul ---------------------------------------------------------------------------------------------

/** Plusieurs sorties d'une même lampe (lumière émise 0..1), la plus prioritaire d'abord : celle du dessus masque celles
 * du dessous là où elle éclaire (sa part de lumière, le plus fort de ses canaux, cache d'autant) et les laisse voir là
 * où elle est faible ou éteinte. Jamais au-delà de 1. */
export function superposer(calques: RGB[]): RGB {
  let r = 0, g = 0, b = 0
  for (let i = calques.length - 1; i >= 0; i--) {
    const [cr, cg, cb] = calques[i]
    const couvert = clamp01(Math.max(cr, cg, cb))
    r = cr + (1 - couvert) * r
    g = cg + (1 - couvert) * g
    b = cb + (1 - couvert) * b
  }
  return [r, g, b]
}

/** Lumière d'une couche telle que l'aperçu la montre : le niveau de `evaluer`, sans le gamma perceptuel que huebeat met
 * au carré sur les lampes en 3d. L'aperçu d'une scène seule ne l'applique pas non plus : une couche seule se voit donc
 * exactement comme la même scène seule, sans saut de luminosité quand on passe de l'une à l'autre. */
function lumiereMontree(s: Sortie): RGB {
  return [s.rgb[0] * s.niveau, s.rgb[1] * s.niveau, s.rgb[2] * s.niveau]
}

/** Une couche jouée pour un appareil : ses effets, ses réglages, et le rang de l'appareil DANS le groupe qu'elle vise. */
export type CoucheJouee = { effets: FxId[]; params: FxParams; rang: number }

/** Sortie d'un appareil pour les couches qui le concernent (la plus prioritaire d'abord), superposées par priorité.
 * Limite assumée : l'aperçu superpose sans le gamma des lampes, donc dans un mix qui mêle 2d et 3d, la 3d se voit un peu
 * plus fort à l'écran que sur les lampes (où elle est mise au carré, la 2d restant linéaire). */
export function sortieMix(couches: CoucheJouee[], f: Fixture, dims: Dims, beat: number): Sortie {
  const sorties = couches.map((c) => evaluer(c.effets, f, dims, c.params, beat, c.rang))
  const [r, g, b] = superposer(sorties.map(lumiereMontree))
  const niveau = Math.max(r, g, b)
  const vise = sorties.find((s) => s.niveau > 1e-6)?.vise ?? null       // la lyre suit la couche la plus prioritaire qui éclaire
  return { rgb: niveau > 1e-9 ? [r / niveau, g / niveau, b / niveau] : [1, 1, 1], niveau, vise }
}

// ---- quelles lampes une couche vise ---------------------------------------------------------------------

/** Canal de huebeat le plus proche de chaque appareil (distance dans le plan, hauteur ignorée : les deux n'ont pas la
 * même origine en z). Sans canaux (club, autre lieu), aucun appareil n'est rattaché. */
export function canalLePlusProche(positions: Vec3[], canaux: Record<string, number[]>): (string | null)[] {
  const cles = Object.keys(canaux).sort(parNumero)
  return positions.map((p) => {
    let meilleur: string | null = null, d2 = Infinity
    for (const k of cles) {
      const c = canaux[k]
      const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2
      if (d < d2) { d2 = d; meilleur = k }
    }
    return meilleur
  })
}

/** Les appareils qu'une couche concerne : tous si elle ne vise personne en particulier ; un appareil qu'aucun canal ne
 * représente (autre lieu) suit la couche entière plutôt que de s'éteindre sans explication. */
export function membres(canalDe: (string | null)[], canaux: string[] | null | undefined): boolean[] {
  return canalDe.map((c) => !canaux || c === null || canaux.includes(c))
}

/** Rang de chaque appareil parmi les membres seulement (même ordre que `rangs` de spatialFx) : l'alternance 2d d'une
 * couche réservée à un groupe se compte dans ce groupe. Un non-membre vaut 0 (sans effet : on ne l'évalue pas). */
export function rangsCouche(positions: Vec3[], estMembre: boolean[]): number[] {
  const idx = positions.map((_, i) => i).filter((i) => estMembre[i])
    .sort((a, b) => positions[a][0] - positions[b][0] || positions[a][1] - positions[b][1] || positions[a][2] - positions[b][2] || a - b)
  const sortie = new Array<number>(positions.length).fill(0)
  idx.forEach((i, rang) => { sortie[i] = rang })
  return sortie
}

// ---- éditeur --------------------------------------------------------------------------------------------

export type GroupeDeLampes = { nom: string; canaux: string[] }

/** Les canaux regroupés par lampe : les segments d'un ruban ne font qu'une lampe à cocher. */
export function groupesDeLampes(canaux: Record<string, unknown>, noms: Record<string, string>): GroupeDeLampes[] {
  const ordre: string[] = []
  const par = new Map<string, string[]>()
  for (const k of Object.keys(canaux).sort(parNumero)) {
    const nom = noms[k] || `canal ${k}`
    if (!par.has(nom)) { par.set(nom, []); ordre.push(nom) }
    par.get(nom)!.push(k)
  }
  return ordre.map((nom) => ({ nom, canaux: par.get(nom)! }))
}

/** Coche ou décoche un groupe. Rien de coché, ou tout coché, veut dire « toutes les lampes » (undefined). */
export function basculerGroupe(courant: string[] | undefined, groupe: string[], tous: string[]): string[] | undefined {
  const actuels = new Set(courant ?? [])
  const dedans = groupe.every((k) => actuels.has(k))
  if (!courant) groupe.forEach((k) => actuels.add(k))
  else if (dedans) groupe.forEach((k) => actuels.delete(k))
  else groupe.forEach((k) => actuels.add(k))
  const liste = [...actuels].sort(parNumero)
  return liste.length === 0 || tous.every((k) => actuels.has(k)) ? undefined : liste
}

/** Ce que vise une couche, en mots. */
export function lampesDeLaCouche(canaux: string[] | undefined, groupes: GroupeDeLampes[]): string {
  if (!canaux) return 'toutes les lampes'
  const mots: string[] = []
  for (const g of groupes) {
    const k = g.canaux.filter((c) => canaux.includes(c)).length
    if (k === g.canaux.length) mots.push(g.nom)
    else if (k > 0) mots.push(`${k} canal${k > 1 ? 'ux' : ''} sur ${g.canaux.length} de ${g.nom}`)
  }
  return mots.join(', ') || 'aucune lampe'
}

/** Change la priorité d'une couche (-1 = vers le dessus). Aux extrémités, rend la liste telle quelle. */
export function deplacerCouche(couches: CoucheMix[], i: number, sens: -1 | 1): CoucheMix[] {
  const j = i + sens
  if (i < 0 || i >= couches.length || j < 0 || j >= couches.length) return couches
  const n = [...couches]
  ;[n[i], n[j]] = [n[j], n[i]]
  return n
}

export const ajouterCouche = (couches: CoucheMix[], scene: string): CoucheMix[] => (couches.length >= MAX_COUCHES ? couches : [...couches, { scene }])
export const retirerCouche = (couches: CoucheMix[], i: number): CoucheMix[] => couches.filter((_, j) => j !== i)

/** Les couches dont la scène est encore au pad, dans l'ordre de priorité. */
export function resoudre(mix: Pick<Mix, 'couches'>, scenes: Scene[]): CoucheResolue[] {
  return mix.couches.flatMap((c) => {
    const scene = scenes.find((s) => s.id === c.scene)
    return scene ? [c.canaux ? { scene, canaux: c.canaux } : { scene }] : []
  })
}

/** « 3d + 2d · 3 couches » : ce que mélange ce mix. */
export function resume(mix: Pick<Mix, 'couches'>, scenes: Scene[]): string {
  const r = resoudre(mix, scenes)
  const modes = [...new Set(r.map((c) => c.scene.mode ?? '3d'))]
  return `${modes.join(' + ') || 'vide'} · ${r.length} couche${r.length > 1 ? 's' : ''}`
}

/** Un mix à jouer tout de suite : les scènes en entier (l'écran joue aussi ce qu'il n'a pas enregistré), sans identifiant. */
export function mixPourApi(mix: Pick<Mix, 'nom' | 'couches'>, scenes: Scene[]): { nom: string; couches: { scene: Omit<Scene, 'id'>; canaux?: string[] }[] } {
  return {
    nom: mix.nom,
    couches: resoudre(mix, scenes).map(({ scene: { id: _id, ...scene }, canaux }) => (canaux ? { scene, canaux } : { scene })),
  }
}
