// DJ Light : ce qu'on déduit de la musique avec le temps (logique pure, testée dans djAnalyse.test.ts) :
// la tonalité (majeur ou mineur), le tempo, l'horloge des temps, et les montées et drops.
// En direct on ne voit que le passé : chaque détecteur ne regarde donc que ce qui vient de se passer.
import { clamp01 } from './djSignaux'

export const NOTES = ['do', 'do#', 'ré', 'ré#', 'mi', 'fa', 'fa#', 'sol', 'sol#', 'la', 'la#', 'si']

// ---- tonalité ---------------------------------------------------------------------------------------------

// Profils de Krumhansl-Kessler : à quel point chacune des 12 notes « appartient » à une gamme majeure ou mineure
const PROFIL_MAJEUR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const PROFIL_MINEUR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

export type Cle = { tonique: number; mineur: boolean }

export function correlation(a: number[], b: number[]): number {
  const n = a.length
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2 }
  return da <= 1e-12 || db <= 1e-12 ? 0 : num / Math.sqrt(da * db)
}

/** La gamme dont le profil ressemble le plus à ces 12 notes (Do en premier), et à quel point (-1..1). */
export function meilleureCle(chroma: number[]): { cle: Cle; score: number } | null {
  if (chroma.length !== 12 || chroma.every((v) => !(v > 0))) return null
  let meilleur: { cle: Cle; score: number } | null = null
  for (const mineur of [false, true]) {
    const profil = mineur ? PROFIL_MINEUR : PROFIL_MAJEUR
    for (let tonique = 0; tonique < 12; tonique++) {
      const decale = chroma.map((_, i) => profil[(i - tonique + 12) % 12])
      const score = correlation(chroma, decale)
      if (!meilleur || score > meilleur.score) meilleur = { cle: { tonique, mineur }, score }
    }
  }
  return meilleur
}

/** Suivi de la tonalité : les notes entendues s'accumulent sur ~8 s, et la gamme ne change que si une autre domine
 * nettement pendant 2 s (une transition d'accord ne doit pas la faire sauter). */
export type SuiviCle = { accu: number[]; cle: Cle | null; score: number; candidat: { cle: Cle; depuis: number } | null }
export const SUIVI_CLE_VIDE: SuiviCle = { accu: new Array(12).fill(0), cle: null, score: 0, candidat: null }
const OUBLI_CLE_S = 12, DELAI_CHANGEMENT_S = 3, AVANCE_CHANGEMENT = 0.06, SCORE_MINI = 0.45

const memeCle = (a: Cle, b: Cle): boolean => a.tonique === b.tonique && a.mineur === b.mineur

export function avancerCle(e: SuiviCle, chroma: number[], dt: number, t: number): SuiviCle {
  const oubli = Math.exp(-dt / OUBLI_CLE_S)
  const accu = e.accu.map((v, i) => v * oubli + (chroma[i] ?? 0) * dt)
  const m = meilleureCle(accu)
  if (!m || m.score < SCORE_MINI) return { ...e, accu, candidat: null }
  if (!e.cle) return { accu, cle: m.cle, score: m.score, candidat: null }
  if (memeCle(m.cle, e.cle)) return { accu, cle: e.cle, score: m.score, candidat: null }
  const actuelle = scoreDe(accu, e.cle)
  if (m.score < actuelle + AVANCE_CHANGEMENT) return { accu, cle: e.cle, score: actuelle, candidat: null }
  const candidat = e.candidat && memeCle(e.candidat.cle, m.cle) ? e.candidat : { cle: m.cle, depuis: t }
  return t - candidat.depuis >= DELAI_CHANGEMENT_S ? { accu, cle: m.cle, score: m.score, candidat: null } : { accu, cle: e.cle, score: actuelle, candidat }
}

function scoreDe(chroma: number[], cle: Cle): number {
  const profil = cle.mineur ? PROFIL_MINEUR : PROFIL_MAJEUR
  return correlation(chroma, chroma.map((_, i) => profil[(i - cle.tonique + 12) % 12]))
}

export const nomDeCle = (c: Cle | null): string => (c ? `${NOTES[c.tonique]} ${c.mineur ? 'mineur' : 'majeur'}` : 'à trouver')

// ---- tempo ------------------------------------------------------------------------------------------------

const BPM_MINI = 70, BPM_MAXI = 180

/** Tempo d'après les instants (en s) des coups de grosse caisse : chaque écart est ramené entre 70 et 180 pulsations par
 * minute (un écart de croche vaut un double-temps), puis on prend le tempo que le plus d'écarts désignent.
 * `confiance` = part des écarts qui s'accordent avec lui. Null s'il manque de coups. */
export function tempoDepuisAttaques(instants: number[]): { bpm: number; confiance: number } | null {
  const recents = instants.slice(-32)
  const bpms: number[] = []
  for (let i = 1; i < recents.length; i++) {
    let ecart = recents[i] - recents[i - 1]
    if (!(ecart > 0.12 && ecart < 3)) continue
    let bpm = 60 / ecart
    while (bpm < BPM_MINI) bpm *= 2
    while (bpm > BPM_MAXI) bpm /= 2
    bpms.push(bpm)
  }
  if (bpms.length < 6) return null
  let meilleur = 0, poids = -1
  for (let c = BPM_MINI; c <= BPM_MAXI; c += 0.5) {
    const p = bpms.reduce((s, b) => s + Math.exp(-(((b - c) / 8) ** 2)), 0)
    if (p > poids) { poids = p; meilleur = c }
  }
  const accord = bpms.filter((b) => Math.abs(b - meilleur) <= 0.06 * meilleur).length / bpms.length
  const fin = affiner(recents, periodeMoyenne(recents, meilleur))
  // la confiance est la meilleure de deux preuves : les écarts s'accordent entre eux, ou les coups tiennent sur la grille ajustée
  // (à 30 images par seconde, les écarts d'un tempo rapide alternent entre deux valeurs et s'accordent mal entre eux)
  return { bpm: fin ? fin.bpm : Math.round(meilleur * 2) / 2, confiance: Math.max(accord, fin ? fin.tenue : 0) }
}

/** Affine un tempo approximatif : chaque coup reçoit son numéro de temps, puis une droite (instant = départ + numéro x période)
 * est ajustée sur tous les coups qui s'y tiennent. La mesure d'une image à l'autre bouge de ±15 ms ; sur une vingtaine de coups,
 * l'erreur sur la période tombe sous le pour cent. Null s'il y a trop peu de coups réguliers. */
function affiner(instants: number[], depart: number): { bpm: number; tenue: number } | null {
  // plusieurs passes : si l'estimation de départ est décalée de quelques pour cent, seuls les premiers coups tiennent sur la
  // droite ; l'ajustement qu'ils donnent est meilleur, et la passe suivante en garde davantage
  let bpm = depart, resultat: { bpm: number; tenue: number } | null = null
  for (let passe = 0; passe < 4; passe++) {
    const ajuste = ajuster(instants, bpm)
    if (ajuste === null) break
    resultat = ajuste
    if (Math.abs(ajuste.bpm - bpm) < 0.002 * bpm) break
    bpm = ajuste.bpm
  }
  return resultat === null ? null : { bpm: Math.round(resultat.bpm * 10) / 10, tenue: resultat.tenue }
}

/** Tempo moyen des écarts qui valent un nombre entier de temps de `bpm` (à 25 % près) : leur somme se tient d'un bout à l'autre,
 * donc la quantification des instants (une image = 33 ms) ne la fausse pas, contrairement au pic de l'histogramme. */
function periodeMoyenne(instants: number[], bpm: number): number {
  const p0 = 60 / bpm
  let somme = 0, temps = 0
  for (let i = 1; i < instants.length; i++) {
    const e = instants[i] - instants[i - 1], m = Math.round(e / p0)
    if (m >= 1 && Math.abs(e - m * p0) < 0.25 * p0) { somme += e; temps += m }
  }
  return temps >= 6 ? 60 / (somme / temps) : bpm
}

/** Un ajustement : le tempo et la part des coups qui tiennent sur la grille qu'il dessine. */
function ajuster(instants: number[], bpm: number): { bpm: number; tenue: number } | null {
  const periode = 60 / bpm, t0 = instants[0]
  const pts = instants.map((t) => ({ t, k: Math.round((t - t0) / periode) })).filter((p) => Math.abs(p.t - (t0 + p.k * periode)) < 0.12 * periode)
  if (pts.length < 6 || pts[pts.length - 1].k - pts[0].k < 4) return null
  const n = pts.length, mk = pts.reduce((s, p) => s + p.k, 0) / n, mt = pts.reduce((s, p) => s + p.t, 0) / n
  const cov = pts.reduce((s, p) => s + (p.k - mk) * (p.t - mt), 0), vari = pts.reduce((s, p) => s + (p.k - mk) ** 2, 0)
  if (vari <= 0 || cov <= 0) return null
  const ajuste = 60 / (cov / vari)
  if (Math.abs(ajuste - bpm) >= 0.1 * bpm) return null
  // part des coups qui tiennent sur la grille AJUSTÉE (et non sur celle de départ)
  const p2 = 60 / ajuste, tient = instants.filter((t) => Math.abs(t - (t0 + Math.round((t - t0) / p2) * p2)) < 0.15 * p2).length
  return { bpm: ajuste, tenue: tient / instants.length }
}

// ---- horloge des temps ------------------------------------------------------------------------------------

/** `beat` : où en est-on dans le morceau, en pulsations (un entier = un temps). */
export type Horloge = { beat: number; bpm: number }
export const HORLOGE_DEPART: Horloge = { beat: 0, bpm: 120 }

export function avancerHorloge(h: Horloge, dt: number): Horloge {
  return { ...h, beat: h.beat + (Math.max(0, dt) * h.bpm) / 60 }
}

/** Une grosse caisse vient de tomber : elle est censée tomber sur un temps. Si l'horloge en est proche (moins d'un
 * tiers de temps), on la rapproche de moitié de l'écart ; au-delà c'est un contretemps, on n'y touche pas. */
export function recalerSurAttaque(h: Horloge): Horloge {
  const ecart = Math.round(h.beat) - h.beat
  return Math.abs(ecart) < 0.34 ? { ...h, beat: h.beat + ecart * 0.5 } : h
}

/** Le tempo de l'horloge se rapproche du tempo mesuré, sans sauter : un quart du chemin par mesure, et un écart de plus
 * d'un quart de tempo (doublement, erreur de lecture) n'est pas pris. */
export function suivreTempo(h: Horloge, mesure: { bpm: number; confiance: number } | null): Horloge {
  if (!mesure || mesure.confiance < 0.5) return h
  const ratio = mesure.bpm / h.bpm
  if (ratio < 0.75 || ratio > 1.33) return mesure.confiance > 0.8 && Math.abs(ratio - 1) > 0.33 ? { ...h, bpm: mesure.bpm } : h
  return { ...h, bpm: h.bpm + (mesure.bpm - h.bpm) * 0.25 }
}

// ---- montées et drops -------------------------------------------------------------------------------------

export type PhaseDrop = 'normal' | 'break' | 'montee'
export type EtatDrop = {
  phase: PhaseDrop
  depuis: number                   // instant d'entrée dans la phase
  depuisMontee: number             // instant où la montée a commencé (un break qui devient montée garde son `depuis`)
  basses: number                  // basses lissées (0,5 s)
  fort: number                     // volume lissé sur 12 s : le morceau a-t-il été fort ?
  haut: number                     // le volume (LUFS) le plus haut des dernières minutes (redescend de 0,6 LU par seconde)
  dernierKick: number
  caisses: number[]                // instants des caisses claires des 5 dernières secondes
  dernierDrop: number
  coupure: boolean                 // le break est une coupure franche (le son s'arrête net) : un retour d'une demi-seconde suffit
}
export const DROP_VIDE: EtatDrop = { phase: 'normal', depuis: 0, depuisMontee: 0, basses: 0, fort: 0, haut: -70, dernierKick: -1e9, caisses: [], dernierDrop: -1e9, coupure: false }
/** `volume` : 0..1 relatif au morceau ; `lufs` : le volume court terme (3 s) en LUFS, pour mesurer un creux en dB sans échelle
 * (le momentané oscille de plusieurs dB à chaque coup) ; `lufsM` : le momentané, pour voir une coupure franche. */
export type EntreeDrop = { basses: number; volume: number; lufs: number; lufsM?: number; kick: boolean; snare: boolean }
const BREAK_BASSES = 0.14, BREAK_SANS_KICK_S = 0.9, MONTEE_CAISSES = 5, MONTEE_FENETRE_S = 2.5, MONTEE_DUREE_S = 8
const DROP_BASSES = 0.5, DROP_MINI_S = 3, DROP_REPOS_S = 10, FORT_MINI = 0.35
// Les basses sont relatives à leur médiane (sous 0,14 la moitié du temps par construction) et une batterie qui joue des caisses
// claires en continu n'est pas une montée : un break demande un vrai creux de volume, une montée des caisses qui s'accélèrent.
const CREUX_LU = 5, HAUT_DECROIT_LU = 0.6, ACCELERATION = 2, MONTEE_MAXI_S = 16, COUPURE_LU = 18, DROP_MINI_COUPURE_S = 0.5

/** Une image de plus. `drop` n'est vrai qu'à l'image du coup : tout revient (basses et grosse caisse) après un break ou une
 * montée d'au moins 3 s, quand le morceau avait été fort : une coupure d'un temps n'en est pas un. `montee` va de 0 à 1
 * pendant la montée. */
export function avancerDrop(e: EtatDrop, x: EntreeDrop, dt: number, t: number): { etat: EtatDrop; montee: number; drop: boolean } {
  const basses = e.basses + (x.basses - e.basses) * Math.min(1, dt / 0.5)
  const fort = e.fort + (x.volume - e.fort) * Math.min(1, dt / 12)
  const dernierKick = x.kick ? t : e.dernierKick
  const haut = Math.max(Number.isFinite(x.lufs) ? x.lufs : -70, e.haut - dt * HAUT_DECROIT_LU)
  const caisses = [...e.caisses.filter((c) => t - c <= 5), ...(x.snare ? [t] : [])]
  const n1 = caisses.filter((c) => t - c <= MONTEE_FENETRE_S / 2).length, n2 = caisses.filter((c) => t - c > MONTEE_FENETRE_S / 2 && t - c <= MONTEE_FENETRE_S).length
  const n3 = caisses.filter((c) => t - c > MONTEE_FENETRE_S).length
  const accelere = n1 >= 4 && n2 >= 1 && n1 >= ACCELERATION * n2 && n3 <= n2 + 1
  let phase = e.phase, depuis = e.depuis, depuisMontee = e.depuisMontee, dernierDrop = e.dernierDrop, coupure = e.coupure, drop = false
  const duree = t - e.depuis
  if (phase === 'normal') {
    const repose = t - dernierDrop > 4              // juste après un drop, les caisses claires qui restent ne sont pas une montée
    const creux = x.lufs < e.haut - CREUX_LU
    const coupe = (x.lufsM ?? x.lufs) < e.haut - COUPURE_LU      // le son s'arrête net : pas besoin d'attendre qu'on n'entende plus de grosse caisse
    if (coupe && fort > FORT_MINI) { phase = 'break'; depuis = t; coupure = true }
    else if (basses < BREAK_BASSES && t - dernierKick > BREAK_SANS_KICK_S && fort > FORT_MINI && creux) { phase = 'break'; depuis = t; coupure = false }
    else if (repose && accelere && fort > FORT_MINI) { phase = 'montee'; depuis = t; depuisMontee = t; coupure = false }
  } else {
    // un break où les caisses claires s'accélèrent devient une montée ; sans rien de tout ça pendant 40 s, on repart à zéro
    if (phase === 'break' && n1 + n2 >= MONTEE_CAISSES) { phase = 'montee'; depuisMontee = t; coupure = false }
    const retour = x.kick && basses > DROP_BASSES, mini = coupure ? DROP_MINI_COUPURE_S : DROP_MINI_S
    if (retour && duree >= mini && t - dernierDrop >= DROP_REPOS_S) { drop = true; dernierDrop = t; phase = 'normal'; depuis = t; coupure = false }
    else if (retour && duree < mini) { phase = 'normal'; depuis = t; coupure = false }      // fausse alerte : la musique est revenue trop vite
    else if (duree > 40 || (phase === 'montee' && t - depuisMontee > MONTEE_MAXI_S)) { phase = 'normal'; depuis = t; coupure = false }
  }
  const montee = phase === 'normal' ? 0 : clamp01((t - depuis) / MONTEE_DUREE_S) * (phase === 'montee' ? 1 : 0.7)
  return { etat: { phase, depuis, depuisMontee, basses, fort, haut, dernierKick, caisses, dernierDrop, coupure }, montee, drop }
}
