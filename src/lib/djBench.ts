// DJ Light : le banc d'essai. Il rejoue une suite d'images du moteur audio (capture réelle ou morceau simulé) dans les
// détecteurs et note chaque fonction de 0 à 100, une par une puis toutes ensemble. Les « références » sont calculées
// autrement que les détecteurs (flux spectral, autocorrélation, chroma moyen) : elles ne sont pas la vérité, elles
// servent à voir si deux méthodes indépendantes s'accordent. Logique pure : aucune lecture de fichier ici.
import { DjMoteur } from './djMoteur'
import { correlation, meilleureCle, type Cle } from './djAnalyse'
import { clamp01, type ImageAudio, type SignalId } from './djSignaux'
import { profilsDeDepart, type Profil } from './djCouches'
import { COMMUN_DEFAUT, evaluer, type Dims, type Fixture, type Scene } from './spatialFx'
import { Simulateur } from './djSimu'
import { REGLAGES_DEFAUT, avanceMs, vitesseOnde, type ReglagesDj } from './djReglages'

export type Note = { id: string; label: string; score: number; mesures: Record<string, number | string>; verdict: string }
export type Rapport = { duree: number; independantes: Note[]; collectives: Note[]; globalIndependant: number; globalCollectif: number }

const moyenne = (v: number[]): number => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0)
const ecartType = (v: number[]): number => { const m = moyenne(v); return Math.sqrt(moyenne(v.map((x) => (x - m) ** 2))) }
const quantile = (v: number[], q: number): number => { if (!v.length) return 0; const t = [...v].sort((a, b) => a - b); return t[Math.min(t.length - 1, Math.floor(q * t.length))] }
const r2 = (x: number): number => Math.round(x * 100) / 100
const pts = (x: number): number => Math.round(Math.max(0, Math.min(100, x)))
/** 100 dans [a, b], retombe linéairement à 0 à `marge` de chaque côté. */
const plateau = (x: number, a: number, b: number, marge: number): number => (x >= a && x <= b ? 100 : pts(100 * (1 - (x < a ? a - x : x - b) / marge)))
const verdict = (s: number): string => (s >= 85 ? 'très bien' : s >= 70 ? 'bien' : s >= 50 ? 'moyen' : s >= 25 ? 'faible' : 'ne marche pas')
const note = (id: string, label: string, score: number, mesures: Note['mesures']): Note => ({ id, label, score: pts(score), mesures, verdict: verdict(pts(score)) })

// ---- références indépendantes -------------------------------------------------------------------------------

/** Flux spectral positif d'une plage de bandes : combien le spectre a monté d'une image à l'autre. */
export function flux(images: ImageAudio[], de: number, a: number): number[] {
  return images.map((im, i) => {
    if (!i) return 0
    let s = 0
    for (let b = de; b <= a; b++) s += Math.max(0, im.spec[b] - images[i - 1].spec[b])
    return s
  })
}

/** Pics d'une courbe au-dessus de sa médiane locale (±1,5 s) + k x l'écart médian, espacés d'au moins `espaceS`. */
export function pics(courbe: number[], fps: number, k: number, espaceS: number): number[] {
  const demi = Math.round(1.5 * fps), res: number[] = []
  let dernier = -1e9
  for (let i = 1; i < courbe.length - 1; i++) {
    const fen = courbe.slice(Math.max(0, i - demi), i + demi + 1)
    const med = quantile(fen, 0.5), dev = quantile(fen.map((x) => Math.abs(x - med)), 0.5)
    if (courbe[i] > med + k * Math.max(dev, 1) && courbe[i] >= courbe[i - 1] && courbe[i] > courbe[i + 1] && (i - dernier) / fps >= espaceS) { res.push(i); dernier = i }
  }
  return res
}

/** Précision, rappel et F de `trouves` contre `ref`, à ± `tol` images. */
export function fMesure(trouves: number[], ref: number[], tol: number): { p: number; r: number; f: number } {
  const bon = trouves.filter((t) => ref.some((x) => Math.abs(x - t) <= tol)).length
  const vus = ref.filter((x) => trouves.some((t) => Math.abs(x - t) <= tol)).length
  const p = trouves.length ? bon / trouves.length : 0, r = ref.length ? vus / ref.length : 0
  return { p, r, f: p + r ? (2 * p * r) / (p + r) : 0 }
}

/** Tempo de référence : le peigne de période T qui capte le plus d'énergie de flux (le flux est d'abord débarrassé de sa
 * moyenne locale), ramené entre 70 et 180. `nette` : le gagnant domine les autres tempos sans lien d'octave avec lui d'au moins 12 %,
 * sinon la référence est ambiguë et ne doit pas servir de vérité. */
export function tempoReference(fluxTotal: number[], fps: number): { bpm: number; nette: boolean } {
  const demi = Math.round(fps), bruts = fluxTotal
  const flux = bruts.map((x, i) => Math.max(0, x - moyenne(bruts.slice(Math.max(0, i - demi), i + demi + 1))))
  const peigne = (bpm: number): number => {
    const periode = (60 / bpm) * fps
    let s = 0, n = 0
    for (let k = 0; k * periode < flux.length - 2; k++) {
      const i = k * periode, a = Math.floor(i), f = i - a
      s += flux[a] * (1 - f) + flux[a + 1] * f; n++
    }
    return n ? s / n : 0
  }
  const cand: { bpm: number; v: number }[] = []
  for (let bpm = 70; bpm <= 180; bpm += 0.5) cand.push({ bpm, v: peigne(bpm) + 0.5 * peigne(bpm * 2) + 0.5 * peigne(bpm / 2) })
  const gagnant = cand.reduce((a, b) => (b.v > a.v ? b : a))
  const lie = (b: number): boolean => [1, 2, 0.5, 4 / 3, 0.75, 1.5, 2 / 3].some((r) => Math.abs(b / gagnant.bpm - r) < 0.06)
  const second = cand.filter((c) => !lie(c.bpm)).reduce((a, b) => (b.v > a.v ? b : a), { bpm: 0, v: 0 })
  return { bpm: gagnant.bpm, nette: gagnant.v >= 1.12 * second.v }
}
const replie = (bpm: number): number => { while (bpm < 70) bpm *= 2; while (bpm > 180) bpm /= 2; return bpm }

// ---- mesures par fonction -----------------------------------------------------------------------------------

/** `verite` : ce qu'on sait du morceau quand on l'a fabriqué (drops en secondes, tempo, nombre de temps, instant d'un premier temps).
 * Sans elle, on compare à des références calculées. `reglages` : ceux du moteur pendant le rejeu (les réglages par défaut sinon). */
export type Suite = { images: ImageAudio[]; fps: number; reelle: boolean; verite?: { drops?: number[]; bpm?: number; mesure?: 3 | 4; premierTemps?: number; kicks?: number[] }; reglages?: ReglagesDj }

/** Un morceau de rythme connu : `mesure` temps par mesure à `bpm`, grosse caisse forte sur le « un », caisse claire sur les temps pairs, charleston
 * sur les contretemps. `oubli` : part des grosses caisses des autres temps qui ne sonnent pas (rythme irrégulier) ; `oubliUn` : idem pour le « un ».
 * Reproductible. */
export function suiteRythmee(bpm: number, mesure: 3 | 4, secondes: number, opts: { oubli?: number; oubliUn?: number; graine?: number } = {}): Suite {
  let a = (opts.graine ?? 7) >>> 0
  const alea = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const fps = 30, P = 60 / bpm, phase0 = 0.31, base = new Simulateur(1).suivant(1 / 30)
  const kickJoue = new Map<number, boolean>()
  const joue = (k: number): boolean => { let v = kickJoue.get(k); if (v === undefined) { v = k % mesure === 0 ? alea() >= (opts.oubliUn ?? 0) : alea() >= (opts.oubli ?? 0); kickJoue.set(k, v) } return v }
  const images: ImageAudio[] = []
  const n = Math.floor(secondes * fps)
  for (let k = 0; phase0 + k * P < secondes; k++) joue(k)                    // tire les grosses caisses dans l'ordre : le morceau ne dépend pas de qui les demande
  const kicks = [...kickJoue].filter(([, v]) => v).map(([k]) => phase0 + k * P).sort((a, b) => a - b)
  for (let i = 0; i < n; i++) {
    const t = i / fps, spec = new Array<number>(96).fill(0).map(() => 30 + alea() * 4)
    let kick = false, snare = false, hat = false
    const k0 = Math.floor((t - phase0) / P)
    for (let k = k0 - 4; k <= k0; k++) {
      const tk = phase0 + k * P
      if (tk < 0 || tk > t) continue
      const dKick = t - tk
      if (joue(k)) {
        const amp = k % mesure === 0 ? 200 : 70
        for (let b = 0; b < 30; b++) spec[b] += amp * Math.exp(-dKick / 0.1)
        if (dKick < 1 / fps) kick = true
      }
      if (k % mesure !== 0 && (mesure === 3 || k % 2 === 1)) { for (let b = 40; b < 66; b++) spec[b] += 70 * Math.exp(-dKick / 0.08); if (dKick < 1 / fps) snare = true }
      const dHat = t - (tk + P / 2)
      if (dHat >= 0) { for (let b = 76; b < 96; b++) spec[b] += 60 * Math.exp(-dHat / 0.04); if (dHat < 1 / fps) hat = true }
    }
    images.push({ ...base, t, spec: spec.map((v) => Math.min(255, v)), kick: { on: kick, v: kick ? 1 : 0 }, snare: { on: snare, v: snare ? 0.8 : 0 }, hat: { on: hat, v: hat ? 0.6 : 0 }, lufs: { m: -22, s: -22 }, silence: false })
  }
  return { images, fps, reelle: false, verite: { bpm, mesure, premierTemps: phase0, kicks } }
}

/** Rejoue la suite dans un moteur neuf et garde ce que chaque image a produit. */
export function rejouer(suite: Suite) {
  const m = new DjMoteur()
  if (suite.reglages) m.regler(suite.reglages)
  const signaux: Record<SignalId, number>[] = [], lectures: ReturnType<DjMoteur['lecture']>[] = [], drops: number[] = []
  suite.images.forEach((img, i) => {
    const ms = (i * 1000) / suite.fps
    const r = m.pousser(img, ms)
    if (r.drop) drops.push(i)
    const l = m.lecture(ms)
    lectures.push(l); signaux.push(l.signaux)
  })
  return { signaux, lectures, drops }
}

function noteCapture(s: Suite): Note {
  const t = s.images.map((i) => i.t), ecarts = t.slice(1).map((x, i) => (x - t[i]) * 1000)
  const fps = (s.images.length - 1) / Math.max(1e-6, t[t.length - 1] - t[0])
  const sans = s.images.filter((i) => i.silence).length / s.images.length
  const gros = ecarts.filter((e) => e > 100).length
  return note('capture', 'capture du son', 0.6 * plateau(fps, 29, 31, 10) + 0.4 * pts(100 - gros * 5), { images_par_s: r2(fps), ecart_max_ms: r2(Math.max(...ecarts)), ecarts_sup_100ms: gros, part_silence: r2(sans) })
}

/** Un signal continu est « exploitable » s'il se promène franchement : large étendue, centré, ni collé en haut ni en bas. */
function noteContinu(id: string, label: string, v: number[], ideal: [number, number] = [0.3, 0.7]): Note {
  const p5 = quantile(v, 0.05), p95 = quantile(v, 0.95), med = quantile(v, 0.5)
  const etendue = p95 - p5, colle = v.filter((x) => x > 0.97 || x < 0.03).length / v.length
  const score = 0.55 * pts(Math.min(100, (etendue / 0.45) * 100)) + 0.3 * plateau(med, ideal[0], ideal[1], 0.3) + 0.15 * pts(100 - colle * 200)
  return note(id, label, score, { p5: r2(p5), mediane: r2(med), p95: r2(p95), etendue: r2(etendue), part_collee_aux_bornes: r2(colle) })
}

function noteAttaque(id: 'kick' | 'snare' | 'hat', label: string, s: Suite, de: number, a: number, k: number, espace: number): Note {
  const ref = pics(flux(s.images, de, a), s.fps, k, espace)
  const trouves = s.images.flatMap((im, i) => (im[id].on ? [i] : []))
  const min = s.images.length / s.fps / 60
  if (!trouves.length && !ref.length) return note(id, label, 60, { attaques: 0, reference: 0, remarque: 'rien à détecter ici' })
  const f = fMesure(trouves, ref, Math.round(0.14 * s.fps))
  const enchaine = trouves.length > 1 ? ecartType(trouves.slice(1).map((x, i) => x - trouves[i])) / moyenne(trouves.slice(1).map((x, i) => x - trouves[i])) : 0
  return note(id, label, 100 * f.f, { attaques_par_min: Math.round(trouves.length / min), reference_par_min: Math.round(ref.length / min), precision: r2(f.p), rappel: r2(f.r), irregularite: r2(enchaine) })
}

function noteTempo(s: Suite, lectures: ReturnType<typeof rejouer>['lectures']): Note {
  const calculee = s.verite?.bpm === undefined ? tempoReference(flux(s.images, 0, 95), s.fps) : null
  const ref = s.verite?.bpm ?? replie(calculee!.bpm)
  const debut = Math.round(15 * s.fps), apres = lectures.slice(debut).map((l) => l.bpm)
  if (!apres.length) return note('tempo', 'tempo', 0, { remarque: 'suite trop courte' })
  const proche = (b: number) => Math.min(Math.abs(b - ref) / ref, Math.abs(b - ref * 2) / (ref * 2), Math.abs(b - ref / 2) / (ref / 2))
  const juste = apres.filter((b) => proche(b) < 0.03).length / apres.length
  const exact = apres.filter((b) => Math.abs(b - ref) / ref < 0.03).length / apres.length
  const sur = lectures.findIndex((l) => l.bpmSur)
  const stable = ecartType(apres), tenue = pts(100 - stable * 8)
  const mesures = { reference_bpm: r2(ref), final_bpm: r2(apres[apres.length - 1]), part_exacte: r2(exact), part_a_une_octave: r2(juste), ecart_type_bpm: r2(stable), trouve_apres_s: sur < 0 ? 'jamais' : r2(sur / s.fps) }
  if (calculee && !calculee.nette) {
    // pas de vérité : on ne note que ce qu'on peut vérifier sans elle (le tempo est trouvé vite et ne saute pas), plafonné à 70
    const vite = sur >= 0 && sur / s.fps < 20 ? 100 : 0
    return note('tempo', 'tempo', Math.min(70, 0.5 * tenue + 0.5 * vite), { ...mesures, remarque: 'référence ambiguë : noté sur la stabilité seulement' })
  }
  return note('tempo', 'tempo', 0.6 * 100 * exact + 0.2 * 100 * juste + 0.2 * tenue, mesures)
}

function noteCle(s: Suite, lectures: ReturnType<typeof rejouer>['lectures']): Note {
  const moy = new Array(12).fill(0)
  s.images.forEach((im) => im.chroma.forEach((c, i) => { moy[i] += c / s.images.length }))
  const ref = meilleureCle(moy)
  const apres = lectures.slice(Math.round(20 * s.fps))
  if (!ref || !apres.length) return note('cle', 'tonalité', 0, { remarque: 'rien à comparer' })
  const memeCle = (c: Cle | null) => !!c && c.tonique === ref.cle.tonique && c.mineur === ref.cle.mineur
  // la relative (la mineur / do majeur) est la confusion la plus courante : on la compte à moitié
  const relative = (c: Cle | null) => !!c && c.mineur !== ref.cle.mineur && (c.mineur ? (ref.cle.tonique + 9) % 12 === c.tonique : (ref.cle.tonique + 3) % 12 === c.tonique)
  const exacte = apres.filter((l) => memeCle(l.cle)).length / apres.length, rel = apres.filter((l) => relative(l.cle)).length / apres.length
  const trouvee = apres.filter((l) => l.cle).length / apres.length
  let changements = 0
  apres.forEach((l, i) => { if (i && l.cle && apres[i - 1].cle && (l.cle.tonique !== apres[i - 1].cle!.tonique || l.cle.mineur !== apres[i - 1].cle!.mineur)) changements++ })
  const minutes = apres.length / s.fps / 60
  const mes = { reference: `${ref.cle.tonique}${ref.cle.mineur ? 'm' : 'M'}`, part_exacte: r2(exacte), part_relative: r2(rel), trouvee: r2(trouvee), changements_par_min: r2(changements / Math.max(0.5, minutes)), confiance_ref: r2(ref.score) }
  if (ref.score < 0.55) {
    // la gamme moyenne du passage est elle-même peu nette (modal, plusieurs gammes) : on ne note que la stabilité, plafonnée à 70
    return note('cle', 'tonalité', Math.min(70, 0.7 * pts(100 - (changements / Math.max(0.5, minutes)) * 12) + 0.3 * 100 * trouvee), { ...mes, remarque: 'référence ambiguë : noté sur la stabilité seulement' })
  }
  return note('cle', 'tonalité', 0.7 * 100 * (exacte + 0.5 * rel) + 0.15 * 100 * trouvee + 0.15 * pts(100 - (changements / Math.max(0.5, minutes)) * 10), mes)
}

/** Le cycle (tempo, nombre de temps, premier temps). Avec une vérité connue : exactitude ; sans : il mène le tempo et ne change pas d'avis (plafond 80). */
function noteCycle(s: Suite, lectures: ReturnType<typeof rejouer>['lectures']): Note | null {
  const r = s.reglages ?? REGLAGES_DEFAUT
  if (!r.cycle.actif) return null
  const apres = lectures.slice(Math.round(15 * s.fps))
  if (!apres.length) return null
  const enMain = apres.filter((l) => l.enMain).length / apres.length
  const v = s.verite
  if (v?.bpm && v.mesure) {
    const bpmOk = apres.filter((l) => Math.abs(l.bpm / v.bpm! - 1) < 0.03).length / apres.length
    const mesOk = apres.filter((l) => l.cycle?.mesure === v.mesure).length / apres.length
    const P = 60 / v.bpm, t0 = v.premierTemps ?? 0
    let bons = 0, essais = 0
    for (let k = 0; ; k++) {
      const td = t0 + k * v.mesure * P + 0.4 * P, i = Math.round(td * s.fps)
      if (i >= lectures.length) break
      if (td < 20) continue
      essais++
      if (lectures[i].temps === 1) bons++
    }
    const un = essais ? bons / essais : 0
    return note('cycle', 'cycle de la musique', 100 * (0.4 * bpmOk + 0.25 * mesOk + 0.35 * un), { part_tempo_juste: r2(bpmOk), part_mesure_juste: r2(mesOk), premier_temps_juste: r2(un), part_en_main: r2(enMain) })
  }
  const bpms = apres.map((l) => l.cycle?.bpm).filter((x): x is number => x !== undefined)
  if (!bpms.length) return note('cycle', 'cycle de la musique', 0, { part_en_main: 0, remarque: 'jamais trouvé' })
  const med = quantile(bpms, 0.5), stable = bpms.filter((b) => Math.abs(b / med - 1) < 0.03).length / bpms.length
  const trouves = apres.filter((l) => l.temps !== null).length / apres.length
  return note('cycle', 'cycle de la musique', Math.min(80, 100 * (0.45 * enMain + 0.45 * stable + 0.1 * trouves)),
    { tempo_median: r2(med), part_stable_a_3pc: r2(stable), part_en_main: r2(enMain), part_premier_temps_connu: r2(trouves), remarque: 'pas de vérité : noté sur la stabilité seulement' })
}

function noteDrop(s: Suite, r: ReturnType<typeof rejouer>): Note {
  // référence : le volume lent plonge d'au moins 5 LU pendant 2 s puis remonte d'au moins 5 LU en 2 s
  const vol = s.images.map((i) => i.lufs.s), w = Math.round(2 * s.fps)
  const ref: number[] = s.verite?.drops ? s.verite.drops.map((t) => Math.round(t * s.fps)).filter((i) => i < s.images.length) : []
  if (!s.verite?.drops) {
    for (let i = w; i < vol.length - w; i++) {
      if (vol[i + w] - vol[i] >= 5 && vol[i - w] - vol[i] >= 4 && (!ref.length || i - ref[ref.length - 1] > 10 * s.fps)) ref.push(i + Math.round(s.fps))
    }
  }
  const minutes = s.images.length / s.fps / 60
  const f = fMesure(r.drops, ref, Math.round(3 * s.fps))
  const fausses = r.drops.filter((d) => !ref.some((x) => Math.abs(x - d) <= 3 * s.fps)).length
  const phases = r.lectures.filter((l) => l.phase !== 'normal').length / r.lectures.length
  const score = ref.length ? 100 * f.f : pts(100 - fausses * 40)
  return note('drop', 'break, montée et drop', score, { drops_detectes: r.drops.length, drops_reference: ref.length, fausses_alertes: fausses, precision: r2(f.p), rappel: r2(f.r), part_du_temps_en_break_ou_montee: r2(phases), par_min: r2(r.drops.length / minutes) })
}

// ---- le tout ensemble ---------------------------------------------------------------------------------------

const AMONT_MS = 110                // ce que coûte le chemin du son jusqu'à l'image du moteur audio puis à l'écran (estimation)
const DIMS: Dims = { w: 400, h: 300, d: 250 }
const SCENE: Scene = { id: 'bench001', nom: 'bench', effets: ['onde', 'phare'], palette: 'neon', axe: 'x', source: { x: 50, y: 30, z: 35 }, intensite: 100 }
// cinq lampes réparties dans la pièce : la lumière « de la pièce » est leur moyenne, pour ne pas juger la géométrie d'un seul coin
const LAMPES: Fixture[] = [[200, 150, 120], [60, 50, 60], [340, 50, 180], [60, 250, 180], [340, 250, 60]].map((pos, i) => ({ id: `l${i}`, kind: 'lampe' as const, pos: pos as [number, number, number] }))

/** La chaîne complète (signaux, pile du profil « club », effets) rejouée à 60 images par seconde d'écran. */
export function chaineComplete(s: Suite, quel: string | Profil = 'club0001', espion?: (ms: number, l: ReturnType<DjMoteur['lumiere']>, teinte: number | null) => void) {
  const profil = typeof quel === 'string' ? profilsDeDepart().find((p) => p.id === quel)! : quel
  const m = new DjMoteur()
  if (s.reglages) m.regler(s.reglages)
  const tick = 1000 / 60
  const niveau: number[] = [], teinte: number[] = [], temps: number[] = [], declenchements: number[] = [], general: number[] = []
  let dernierDecl = false, teintePrecedente: number | null = null, sauts = 0
  let prochaineImage = 0
  const ctx = { profil, scene: SCENE, scenes: [SCENE], commun: COMMUN_DEFAUT, dims: DIMS }
  const total = (s.images.length / s.fps) * 1000
  for (let ms = 0; ms < total; ms += tick) {
    while (prochaineImage < s.images.length && (prochaineImage * 1000) / s.fps <= ms) { m.pousser(s.images[prochaineImage], (prochaineImage * 1000) / s.fps); prochaineImage++ }
    const t0 = performance.now()
    const l = m.lumiere(ms, ctx)
    const sorties = LAMPES.map((f) => evaluer(l.sortie.effets, f, DIMS, l.sortie.params, l.beat))
    temps.push(performance.now() - t0)
    const o = { niveau: moyenne(sorties.map((x) => x.niveau)), rgb: sorties[0].rgb }
    niveau.push(o.niveau)
    general.push(l.sortie.params.general ?? 1)
    let teinteIci: number | null = null
    if (sorties[0].niveau > 0.05) {                           // la teinte d'une lampe éteinte ne veut rien dire ; on suit celle du milieu
      const [r, g, b] = sorties[0].rgb, mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const h = mx === mn ? 0 : mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4
      teinteIci = h * 60
      teinte.push(teinteIci)
      if (teintePrecedente !== null) { const d = Math.abs(teinteIci - teintePrecedente); if (Math.min(d, 360 - d) > 40) sauts++ }     // seulement d'un tick allumé au suivant
    }
    teintePrecedente = teinteIci
    espion?.(ms, l, teinteIci)
    const decl = Object.keys(l.declenches).length > 0
    if (decl && !dernierDecl) declenchements.push(ms)
    dernierDecl = decl
  }
  return { niveau, teinte, temps, declenchements, general, sauts }
}

function notesCollectives(s: Suite, r: ReturnType<typeof rejouer>): Note[] {
  const c = chaineComplete(s)
  const n = c.niveau
  const out: Note[] = []
  const etendue = quantile(n, 0.95) - quantile(n, 0.05)
  out.push(note('dynamique', 'lumière qui vit (écart bas/haut)', pts((etendue / 0.35) * 100) * 0.7 + plateau(moyenne(n), 0.2, 0.7, 0.25) * 0.3, { p5: r2(quantile(n, 0.05)), p95: r2(quantile(n, 0.95)), moyenne: r2(moyenne(n)) }))
  // synchro : après chaque grosse caisse de référence, la lumière monte-t-elle dans les 150 ms ?
  // les grosses caisses de référence : les vraies si on les connaît (morceau fabriqué), sinon les pics du flux des graves
  const refKick = (s.verite?.kicks ? s.verite.kicks.map((t) => Math.ceil(t * s.fps)).filter((i) => i < s.images.length) : pics(flux(s.images, 0, 30), s.fps, 2.5, 0.2)).filter((i) => i > 2 * s.fps)
  // « suivie » = la courbe monte d'au moins un cinquième de son étendue habituelle dans les 230 ms ; la latence est le délai du sommet
  const reponse = (serie: number[]): { part: number; latence: number } => {
    const seuil = 0.2 * Math.max(1e-6, quantile(serie, 0.95) - quantile(serie, 0.05)), lat: number[] = []
    let suivis = 0
    for (const i of refKick) {
      // fenêtre de 20 images d'écran (333 ms, moins qu'une période à 180) dont les 6 premières précèdent la grosse caisse : avec une avance, la lumière peut la devancer
      const t = Math.round((i / s.fps) * 60), fen = serie.slice(Math.max(0, t - 6), t + 14)
      if (fen.length < 20) continue
      const base = Math.min(...fen.slice(0, 3)), pic = Math.max(...fen.slice(3))
      if (pic - base > seuil) {
        // le retard : quand la lumière a fait la moitié de sa montée (plusieurs lampes s'allument à des instants différents : le sommet n'a pas de sens)
        const ou = fen.findIndex((x, j) => j >= 3 && x - base >= 0.5 * (pic - base))
        suivis++; lat.push(((ou - 6) / 60) * 1000)
      }
    }
    return { part: refKick.length ? suivis / refKick.length : 0, latence: lat.length ? quantile(lat, 0.5) : 999 }
  }
  const lumiere = reponse(n), couches = reponse(c.general)
  out.push(note('synchro', 'synchro avec la grosse caisse', 0.7 * 100 * lumiere.part + 0.3 * plateau(Math.max(0, lumiere.latence), 0, 120, 200),
    { grosses_caisses_ref: refKick.length, suivies_par_la_lumiere: r2(lumiere.part), latence_lumiere_ms: Math.round(lumiere.latence), suivies_par_les_couches: r2(couches.part), latence_couches_ms: Math.round(couches.latence) }))
  // le retard de la lumière derrière la grosse caisse : l'objectif est de rester sous 80 ms (au-delà de 100, on le voit)
  // (mesuré sur les images du moteur audio : le chemin du son jusqu'à l'image (capture 25, bloc 23, fenêtre 23, détection ~20, image 17, réseau et affichage ~20)
  // s'y ajoute, environ 110 ms, estimation à confirmer à l'oreille ; la sortie audio de la télé en retarde le son d'autant)
  const rg = s.reglages ?? REGLAGES_DEFAUT, total = lumiere.latence + AMONT_MS
  out.push(note('latence', 'retard de la lumière', plateau(total, 0, 80, 120), {
    latence_sur_les_images_ms: Math.round(lumiere.latence), amont_estime_ms: AMONT_MS, total_estime_ms: Math.round(total), objectif_ms: 80, onde: `x${vitesseOnde(rg)}`, avance_ms: avanceMs(rg),
  }))
  // scintillement : à 60 images/s, plus d'un tiers d'écart d'une image à l'autre est du stroboscope
  const sauts = n.slice(1).filter((x, i) => Math.abs(x - n[i]) > 0.33).length / n.length
  out.push(note('stabilite', 'pas de scintillement', pts(100 - sauts * 1500), { sauts_brusques_par_image: r2(sauts * 100) + ' %' }))
  // couleur : elle bouge (écart) mais sans saut (d'une image à l'autre)
  const bouge = ecartType(c.teinte), parSeconde = c.sauts / (s.images.length / s.fps)
  out.push(note('couleur', 'couleurs cohérentes', 0.5 * pts((bouge / 25) * 100) + 0.5 * pts(100 - parSeconde * 100), { ecart_type_teinte: r2(bouge), sauts_de_teinte: c.sauts, sauts_par_s: r2(parSeconde) }))
  // ce que les couches apportent : la lumière suit-elle mieux la grosse caisse avec le profil « club » que sans aucune couche ?
  // (la corrélation se prend sur la sortie des couches, le multiplicateur « général » : la lumière d'une lampe dépend aussi du
  // passage de l'onde devant elle, ce qui n'a rien à voir avec les couches)
  const zero = chaineComplete(s, 'zero0001')
  const env = new Array(n.length).fill(0)
  for (const i of refKick) { const t = Math.round((i / s.fps) * 60); for (let j = 0; j < 30 && t + j < env.length; j++) env[t + j] = Math.max(env[t + j], Math.exp(-j / 9)) }
  const suit = correlation(c.general, env), reste = moyenne(n) / Math.max(1e-6, moyenne(zero.niveau))
  out.push(note('couches', 'apport des couches', 0.5 * pts((suit / 0.4) * 100) + 0.5 * pts((reste / 0.6) * 100),
    { suivi_de_la_grosse_caisse: r2(suit), part_de_lumiere_gardee: r2(reste), lumiere_moyenne_avec: r2(moyenne(n)), lumiere_moyenne_sans: r2(moyenne(zero.niveau)) }))
  out.push(note('perf', 'coût par image', plateau(moyenne(c.temps), 0, 1, 4), { ms_moyen: r2(moyenne(c.temps)), ms_max: r2(Math.max(...c.temps)) }))
  const minutes = s.images.length / s.fps / 60
  out.push(note('declencheur', 'scène du drop', r.drops.length === 0 ? (c.declenchements.length === 0 ? 70 : 20) : pts((c.declenchements.length / r.drops.length) * 100), { drops: r.drops.length, scenes_lancees: c.declenchements.length, par_min: r2(c.declenchements.length / minutes) }))
  return out
}

/** La note de chaque fonction puis de l'ensemble. */
export function evaluerSuite(s: Suite): Rapport {
  const r = rejouer(s)
  const col = (id: SignalId) => r.signaux.map((x) => x[id])
  const ind: Note[] = [
    noteCapture(s),
    noteContinu('volume', 'volume (LUFS)', col('volume')),
    noteContinu('volume_court', 'volume lent', col('volume_court')),
    noteContinu('sub', 'sous-graves', col('sub'), [0.2, 0.6]),
    noteContinu('basses', 'basses', col('basses'), [0.2, 0.6]),
    noteContinu('mediums', 'médiums', col('mediums'), [0.2, 0.6]),
    noteContinu('aigus', 'aigus', col('aigus'), [0.2, 0.6]),
    noteContinu('chaleur', 'chaleur du son', col('chaleur'), [0.25, 0.75]),
    noteContinu('largeur', 'largeur stéréo', col('largeur'), [0.15, 0.7]),
    noteAttaque('kick', 'grosse caisse', s, 0, 30, 2.5, 0.2),
    noteAttaque('snare', 'caisse claire', s, 40, 66, 2.5, 0.2),
    noteAttaque('hat', 'charleston', s, 76, 95, 2.5, 0.08),
    noteTempo(s, r.lectures),
    noteCle(s, r.lectures),
    ...(noteCycle(s, r.lectures) ? [noteCycle(s, r.lectures)!] : []),
    noteDrop(s, r),
  ]
  const col2 = notesCollectives(s, r)
  return { duree: s.images.length / s.fps, independantes: ind, collectives: col2, globalIndependant: pts(moyenne(ind.map((x) => x.score))), globalCollectif: pts(moyenne(col2.map((x) => x.score))) }
}

/** Le rapport en texte. */
export function rapportEnTexte(r: Rapport, titre: string): string {
  const ligne = (n: Note) => `| ${n.label} | ${n.score} | ${n.verdict} | ${Object.entries(n.mesures).map(([k, v]) => `${k}=${v}`).join(', ')} |`
  const tete = '| fonction | note | verdict | mesures |\n|---|---|---|---|'
  return `# ${titre}\n\nduree ${Math.round(r.duree)} s\n\n## fonctions une par une (moyenne ${r.globalIndependant})\n${tete}\n${r.independantes.map(ligne).join('\n')}\n\n## le tout ensemble (moyenne ${r.globalCollectif})\n${tete}\n${r.collectives.map(ligne).join('\n')}\n`
}

export { clamp01 }
