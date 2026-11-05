// DJ Light : le tempo par le cycle de la musique (logique pure, testée dans djCycle.test.ts).
// Une mesure (3 ou 4 temps) se répète telle quelle pendant des dizaines de secondes : on regarde si l'énergie du son ressemble à
// elle-même après un temps, une mesure, deux mesures, quatre mesures. La combinaison « tempo x nombre de temps » qui se répète le
// mieux gagne. Ça marche même quand les grosses caisses sont irrégulières (tout le spectre compte), lève la confusion entre un
// tempo et son double, et donne le premier temps de la mesure. En direct on ne voit que le passé : il faut quelques secondes.

export type ReglagesCycle = {
  actif: boolean
  mesure: 'auto' | 3 | 4          // « auto » essaie les deux
  fenetreS: number                // combien de secondes de musique on regarde (plus long : plus sûr, plus lent à suivre un changement)
  bpmMin: number
  bpmMax: number
  centreBpm: number               // le tempo qu'on préfère à égalité (les deux octaves voisines se ressemblent)
  seuil: number                   // confiance minimale (0..1) pour que le cycle prenne la main sur les grosses caisses
}
export const CYCLE_DEFAUT: ReglagesCycle = { actif: true, mesure: 'auto', fenetreS: 14, bpmMin: 70, bpmMax: 180, centreBpm: 120, seuil: 0.45 }
export const BORNES_CYCLE = { fenetreS: [8, 24], bpm: [50, 220], seuil: [0.1, 0.9] } as const

/** L'historique de ce que l'on a entendu : un point par image du moteur audio. */
export type HistoriqueFlux = { t: number[]; total: number[]; graves: number[]; spec: number[] | null }
export const HISTORIQUE_VIDE: HistoriqueFlux = { t: [], total: [], graves: [], spec: null }
const GRAVES = 30                  // les 30 premières bandes sur 96 (jusqu'à ~220 Hz) : grosse caisse et basse

/** Ajoute une image : de combien le spectre a monté depuis la précédente (toutes les bandes, puis les graves seuls). */
export function ajouterFlux(h: HistoriqueFlux, spec: number[], t: number, fenetreS: number): HistoriqueFlux {
  let total = 0, graves = 0
  if (h.spec && h.spec.length === spec.length) {
    for (let b = 0; b < spec.length; b++) {
      const d = Math.max(0, spec[b] - h.spec[b])
      total += d
      if (b < GRAVES) graves += d
    }
  }
  const garde = Math.max(0, h.t.length - Math.ceil(fenetreS * 40))            // au plus ~40 images par seconde
  return { t: [...h.t.slice(garde), t], total: [...h.total.slice(garde), total], graves: [...h.graves.slice(garde), graves], spec }
}

export type CycleEstime = {
  bpm: number
  mesure: 3 | 4
  confiance: number               // 0..1
  score: number
  /** Le premier temps de la mesure : un instant (s) où il est tombé, ou null si on ne le distingue pas des autres. */
  premierTemps: number | null
  forceTemps1: number             // à quel point le premier temps ressort des autres (1 : pas du tout)
}

/** Facteur (<= 1) d'un tempo candidat selon la cadence des grosses caisses : s'il en faudrait plus de 1,5 par temps (2,2 : bien plus),
 * il est trop lent, c'est la moitié du vrai tempo. Une grosse caisse tous les deux ou quatre temps (rythme lent) ne pénalise rien. */
function tropLent(kicksParS: number | null | undefined, bpm: number): number {
  if (!kicksParS || kicksParS <= 0) return 1
  const parTemps = (kicksParS * 60) / bpm
  return parTemps > 2.2 ? 0.6 : parTemps > 1.5 ? 0.75 : 1
}

const moyenne = (v: number[]): number => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0)

/** Courbe d'attaques : le flux moins sa moyenne sur ±0,5 s, sans valeur négative, puis centré. */
function attaques(flux: number[], fps: number): number[] {
  const demi = Math.max(1, Math.round(fps / 2))
  const pos = flux.map((x, i) => Math.max(0, x - moyenne(flux.slice(Math.max(0, i - demi), i + demi + 1))))
  const m = moyenne(pos)
  return pos.map((x) => x - m)
}

/** Ressemblance (-1..1) de la courbe avec elle-même décalée de `lag` images (fractionnaire). */
function autocorrelation(x: number[], lag: number, energie: number): number {
  const n = x.length, a = Math.floor(lag), f = lag - a
  if (lag < 1 || a + 1 >= n || energie <= 1e-9) return 0
  let s = 0
  for (let i = 0; i + a + 1 < n; i++) s += x[i] * (x[i + a] * (1 - f) + x[i + a + 1] * f)
  return s / energie * (n / (n - lag))                 // ramené à la même échelle quel que soit le recouvrement
}

/** Le tempo et la mesure qui se répètent le mieux dans l'historique, ou null s'il manque de musique ou de relief. */
export type ContexteCycle = {
  indice?: number | null          // le tempo que donnent déjà les grosses caisses
  bpm?: number | null             // le tempo suivi en ce moment par le cycle (inertie : il garde un avantage)
  mesure?: 3 | 4 | null           // la mesure suivie en ce moment (idem)
  kicksParS?: number | null       // combien de grosses caisses par seconde : plus de 1,5 par temps ne peut pas être un tempo si lent
}
export function estimerCycle(h: HistoriqueFlux, r: ReglagesCycle = CYCLE_DEFAUT, ctx: ContexteCycle = {}): CycleEstime | null {
  const indice = ctx.indice ?? null
  const n = h.t.length
  if (n < 30) return null
  const duree = h.t[n - 1] - h.t[0]
  if (duree < 6) return null
  const fps = (n - 1) / duree
  const x = attaques(h.total, fps)
  const energie = x.reduce((s, v) => s + v * v, 0)
  if (energie <= 1e-6) return null                       // du silence ou un son sans aucun relief
  const memo = new Map<number, number>()
  const ac = (lag: number): number => {
    const cle = Math.round(lag * 8)
    let v = memo.get(cle)
    if (v === undefined) { v = autocorrelation(x, lag, energie); memo.set(cle, v) }
    return v
  }
  const mesures: (3 | 4)[] = r.mesure === 'auto' ? [3, 4] : [r.mesure]
  const cand: { bpm: number; mesure: 3 | 4; score: number }[] = []
  for (let bpm = Math.max(40, r.bpmMin); bpm <= Math.min(240, r.bpmMax); bpm += 0.25) {
    const temps = (60 / bpm) * fps                                   // un temps, en images
    // le préféré à égalité : une courbe en cloche sur l'échelle des octaves, qui ne change presque rien (25 %) sauf entre deux ex aequo
    // `indice` : le tempo que donnent déjà les grosses caisses ; un candidat qui s'en approche (à 4 %) a un petit avantage, ce qui
    // départage un tempo de son double (les grosses caisses y sont fiables) sans les forcer quand elles se trompent
    // l'inertie : le tempo déjà suivi garde 10 % d'avance, et la mesure déjà suivie 6 %, pour qu'un tempo voisin (le double, les deux tiers)
    // ou l'autre mesure ne le remplace que s'il est nettement meilleur et pas sur une fluctuation
    const prior = (0.75 + 0.25 * Math.exp(-0.5 * (Math.log2(bpm / r.centreBpm) / 0.5) ** 2))
      * (indice && Math.abs(bpm / indice - 1) < 0.04 ? 1.12 : 1) * (ctx.bpm && Math.abs(bpm / ctx.bpm - 1) < 0.03 ? 1.1 : 1)
      * tropLent(ctx.kicksParS, bpm)
    for (const m of mesures) {
      const lags: [number, number][] = [[temps, 0.2], [temps * m, 0.35], [temps * m * 2, 0.28], [temps * m * 4, 0.17]]
      const utiles = lags.filter(([l]) => l <= n * 0.5)
      if (utiles.length < 2) continue
      const poids = utiles.reduce((s, [, w]) => s + w, 0)
      cand.push({ bpm, mesure: m, score: (utiles.reduce((s, [l, w]) => s + w * ac(l), 0) / poids) * prior * (ctx.mesure === m ? 1.06 : 1) })
    }
  }
  if (!cand.length) return null
  const best = cand.reduce((a, b) => (b.score > a.score ? b : a))
  if (best.score <= 0) return null
  // la confiance est le relief du gagnant : de combien d'écarts-types il dépasse l'ensemble des candidats (un pic net, pas un plateau).
  // Comparer au seul second ne marche pas pour un rythme très régulier, où des dizaines de tempos voisins se ressemblent.
  const scores = cand.map((c) => c.score), m0 = moyenne(scores)
  const sigma = Math.sqrt(moyenne(scores.map((s) => (s - m0) ** 2)))
  const relief = sigma > 1e-9 ? (best.score - m0) / sigma : 0
  const confiance = Math.min(1, Math.max(0, (relief - 2.5) / 3))
  const [premierTemps, forceTemps1] = trouverPremierTemps(h, best.bpm, best.mesure)
  return { bpm: Math.round(best.bpm * 100) / 100, mesure: best.mesure, confiance, score: best.score, premierTemps, forceTemps1 }
}

/** Parmi les temps de la mesure, celui où les graves frappent le plus fort : le « un ». Rend un instant où il est tombé et à
 * quel point il ressort (rapport au temps moyen). */
function trouverPremierTemps(h: HistoriqueFlux, bpm: number, m: 3 | 4): [number | null, number] {
  const periode = 60 / bpm, n = h.t.length
  const t0 = h.t[n - 1]
  // 1) la phase d'un temps : où, dans la période, tombent les attaques graves
  const bacs = 12, phase = new Array<number>(bacs).fill(0)
  for (let i = 0; i < n; i++) phase[Math.floor((((h.t[i] - t0) / periode) % 1 + 1) % 1 * bacs) % bacs] += h.graves[i]
  let p0 = 0
  for (let b = 1; b < bacs; b++) if (phase[b] > phase[p0]) p0 = b
  const decalage = (p0 + 0.5) / bacs * periode                       // instant d'un temps, modulo la période, par rapport à t0
  // 2) l'énergie de chaque temps de la mesure : attaques graves à ±0,2 temps d'un temps de la grille
  const parTemps = new Array<number>(m).fill(0), compte = new Array<number>(m).fill(0)
  for (let i = 0; i < n; i++) {
    const k = Math.round((h.t[i] - t0 - decalage) / periode), reste = h.t[i] - t0 - decalage - k * periode
    if (Math.abs(reste) > 0.2 * periode) continue
    const j = ((k % m) + m) % m
    parTemps[j] += h.graves[i]; compte[j]++
  }
  const moy = moyenne(parTemps)
  if (moy <= 1e-9) return [null, 1]
  let j = 0
  for (let q = 1; q < m; q++) if (parTemps[q] > parTemps[j]) j = q
  const force = parTemps[j] / moy
  // un instant où le temps « un » est tombé : la grille, ramenée au plus récent
  const kMax = Math.floor((h.t[n - 1] - t0 - decalage) / periode)
  let k = kMax
  while ((((k % m) + m) % m) !== j) k--
  return [t0 + decalage + k * periode, force]
}

/** Où l'on en est dans la mesure à l'instant `t` : un nombre de 0 (le « un ») à `mesure` (exclu). */
export function positionDansMesure(premierTemps: number, bpm: number, mesure: number, t: number): number {
  const p = ((t - premierTemps) * bpm) / 60
  return ((p % mesure) + mesure) % mesure
}
