// DJ Light sur l'Ambilight de la télé : du signal musical (0..1) à un niveau de lumière, puis à la cadence à laquelle on
// peut l'envoyer sans saturer la télé. Logique pure, testée dans djAmbilight.test.ts : ni réseau, ni horloge, ni état caché.
//
// Trois réglages, comme pour huebeat :
//   min      le niveau au repos (silence), en % de la lumière maximale de la couleur choisie ;
//   max      le niveau sur les pics, en % ;
//   lissage  la « moyenne » : 0 suit le signal d'un coup, 100 est très lent. La montée est plus vive que la descente,
//            pour que la lumière accompagne un coup fort sans clignoter à chaque creux.
import { clamp01, type SignalId } from './djSignaux'

/** Comment on parle à la télé. `cached` : couleur par l'API de cache (mode manuel), très réactive mais sans effet sur les lampes
 * liées à l'Ambilight ; `lounge` : couleur fixe du style « Lounge light », fidèle jusqu'à ~1 changement/s puis en retard. */
export type VoieAmbilight = 'cached' | 'lounge'
export const VOIES_AMBILIGHT: VoieAmbilight[] = ['cached', 'lounge']
/** Les signaux continus qui ont un sens pour une luminosité (les autres sont des impulsions ou des notions musicales). */
export const SIGNAUX_AMBILIGHT: SignalId[] = ['volume', 'volume_court', 'basses', 'sub', 'mediums', 'aigus', 'montee']

export type ReglagesAmbilight = {
  voie: VoieAmbilight
  signal: SignalId       // ce qui pilote la luminosité
  auto: boolean          // sensibilité auto : recale le signal sur ce que la musique fait réellement (creux = minimum, pics = maximum)
  min: number            // 0..100
  max: number            // 0..100
  lissage: number        // 0..100
  cadence: number        // mises à jour par seconde demandées (bornées à CADENCE_MAX)
  couleur: string        // #rrggbb : la teinte de repli (rien d'autre à suivre), dont la luminosité varie
  couleurs: string[]     // couleurs choisies à la main (vide : on suit les lampes, ou la scène)
}
export const REGLAGES_AMBILIGHT: ReglagesAmbilight = { voie: 'cached', signal: 'volume', auto: true, min: 10, max: 100, lissage: 40, cadence: 10, couleur: '#ff8c28', couleurs: [] }

/** `lisse` : le niveau lissé (0..1) ; `bas` et `haut` : la plage que le signal a récemment parcourue (sensibilité auto). */
export type EtatNiveau = { lisse: number; t: number | null; bas: number; haut: number }
export const ETAT_DEPART: EtatNiveau = { lisse: 0, t: null, bas: 0, haut: 0 }

const TAU_MAX_MS = 2000          // constante de temps à lissage 100, pour la descente
const FACTEUR_MONTEE = 3         // la montée est trois fois plus vive que la descente
const DT_MAX_MS = 500            // un trou plus long (onglet en arrière-plan) ne fait pas sauter le niveau
const TAU_PLAGE_MS = 8000        // sensibilité auto : la plage retenue s'adapte à la musique en une dizaine de secondes
const PLAGE_MIN = 0.12           // en dessous, un signal quasi constant n'est pas grossi en bruit
const SILENCE = 0.02             // sous ce signal, c'est du silence : minimum, jamais recentré

/** Recale le signal sur la plage qu'il parcourt vraiment : le creux récent vaut 0, le pic récent vaut 1. Le volume d'un morceau
 * ne varie souvent que de 0,4 à 0,6 : sans cela, l'Ambilight resterait à mi-hauteur, comme figé. Rend la plage mise à jour. */
function adapter(s: number, bas: number, haut: number, dt: number): { norm: number; bas: number; haut: number } {
  const k = 1 - Math.exp(-dt / TAU_PLAGE_MS)
  const h = s > haut ? s : haut + (s - haut) * k           // le pic monte d'un coup et retombe lentement
  const b = s < bas ? s : bas + (s - bas) * k              // le creux descend d'un coup et remonte lentement
  const norm = s < SILENCE ? 0 : clamp01(0.5 + (s - (b + h) / 2) / Math.max(PLAGE_MIN, h - b))
  return { norm, bas: b, haut: h }
}

/** Avance d'une image : le signal du moment (0..1) donne le niveau (0..1) à afficher. N'altère pas `etat`. */
export function avancer(etat: EtatNiveau, signal: number, tMs: number, r: Pick<ReglagesAmbilight, 'min' | 'max' | 'lissage' | 'auto'>): { etat: EtatNiveau; niveau: number } {
  const s = clamp01(signal)
  const lo = Math.min(r.min, r.max), hi = Math.max(r.min, r.max)
  const premiere = etat.t === null
  const dt = premiere ? 0 : Math.min(DT_MAX_MS, Math.max(0, tMs - (etat.t as number)))
  let bas = etat.bas, haut = etat.haut, cible = s
  if (premiere) { bas = s; haut = s; cible = r.auto ? (s < SILENCE ? 0 : 0.5) : s }
  else if (r.auto) { const a = adapter(s, bas, haut, dt); bas = a.bas; haut = a.haut; cible = a.norm }
  let lisse: number
  if (premiere) lisse = cible
  else {
    const tau = (Math.min(100, Math.max(0, r.lissage)) / 100) * TAU_MAX_MS / (cible > etat.lisse ? FACTEUR_MONTEE : 1)
    const alpha = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau)
    lisse = etat.lisse + (cible - etat.lisse) * alpha
  }
  return { etat: { lisse, t: tMs, bas, haut }, niveau: clamp01((lo + (hi - lo) * lisse) / 100) }
}

const BLANC_CHAUD = { r: 255, g: 140, b: 40 }

/** La couleur à envoyer pour un niveau : la teinte de base, proportionnellement éteinte. */
export function couleurDeNiveau(niveau: number, base: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-f]{6})$/i.exec(base.trim())
  const c = m ? { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) } : BLANC_CHAUD
  const k = clamp01(niveau)
  return { r: Math.round(c.r * k), g: Math.round(c.g * k), b: Math.round(c.b * k) }
}

// ---- cadence --------------------------------------------------------------------------------------------------------

export type Cadence = { t: number | null; niveau: number }
export const CADENCE_DEPART: Cadence = { t: null, niveau: 0 }
export const CADENCE_MIN = 1
export const CADENCE_MAX = 15            // mesuré : la télé tient 10 Hz sans erreur (p95 < 80 ms) ; 15 Hz laisse de la marge
const ZONE_MORTE = 0.015                 // un niveau qui bouge de moins de 1,5 % ne vaut pas une requête
const RAFRAICHIR_MS = 1000               // on renvoie au moins une fois par seconde, même sans changement

/** Faut-il envoyer ce niveau maintenant ? Un tick manqué n'est pas rattrapé : seul le dernier niveau compte. N'altère pas `cad`. */
export function decider(cad: Cadence, tMs: number, niveau: number, cadenceVoulue: number): { envoyer: boolean; cadence: Cadence } {
  const hz = Math.min(CADENCE_MAX, Math.max(CADENCE_MIN, Number.isFinite(cadenceVoulue) ? cadenceVoulue : CADENCE_MIN))
  const ecoule = cad.t === null ? Infinity : tMs - cad.t
  if (ecoule < 1000 / hz) return { envoyer: false, cadence: cad }
  const change = Math.abs(niveau - cad.niveau) >= ZONE_MORTE
  if (cad.t !== null && !change && ecoule < RAFRAICHIR_MS) return { envoyer: false, cadence: cad }
  return { envoyer: true, cadence: { t: tMs, niveau } }
}
