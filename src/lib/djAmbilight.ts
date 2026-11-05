// DJ Light sur l'Ambilight de la télé : du signal musical (0..1) à un niveau de lumière, puis à la cadence à laquelle on
// peut l'envoyer sans saturer la télé. Logique pure, testée dans djAmbilight.test.ts : ni réseau, ni horloge, ni état caché.
//
// Trois réglages, comme pour huebeat :
//   min      le niveau au repos (silence), en % de la lumière maximale de la couleur choisie ;
//   max      le niveau sur les pics, en % ;
//   lissage  la « moyenne » : 0 suit le signal d'un coup, 100 est très lent. La montée est plus vive que la descente,
//            pour que la lumière accompagne un coup fort sans clignoter à chaque creux.
import { clamp01 } from './djSignaux'

export type ReglagesAmbilight = {
  actif: boolean
  min: number            // 0..100
  max: number            // 0..100
  lissage: number        // 0..100
  cadence: number        // mises à jour par seconde demandées (bornées à CADENCE_MAX)
  couleur: string        // #rrggbb : la teinte, dont la luminosité varie
}
export const REGLAGES_AMBILIGHT: ReglagesAmbilight = { actif: false, min: 10, max: 100, lissage: 40, cadence: 10, couleur: '#ff8c28' }

export type EtatNiveau = { lisse: number; t: number | null }
export const ETAT_DEPART: EtatNiveau = { lisse: 0, t: null }

const TAU_MAX_MS = 2000          // constante de temps à lissage 100, pour la descente
const FACTEUR_MONTEE = 3         // la montée est trois fois plus vive que la descente
const DT_MAX_MS = 500            // un trou plus long (onglet en arrière-plan) ne fait pas sauter le niveau

/** Avance d'une image : le signal du moment (0..1) donne le niveau (0..1) à afficher. N'altère pas `etat`. */
export function avancer(etat: EtatNiveau, signal: number, tMs: number, r: Pick<ReglagesAmbilight, 'min' | 'max' | 'lissage'>): { etat: EtatNiveau; niveau: number } {
  const s = clamp01(signal)
  const lo = Math.min(r.min, r.max), hi = Math.max(r.min, r.max)
  let lisse: number
  if (etat.t === null) lisse = s
  else {
    const dt = Math.min(DT_MAX_MS, Math.max(0, tMs - etat.t))
    const tau = (Math.min(100, Math.max(0, r.lissage)) / 100) * TAU_MAX_MS / (s > etat.lisse ? FACTEUR_MONTEE : 1)
    const alpha = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau)
    lisse = etat.lisse + (s - etat.lisse) * alpha
  }
  return { etat: { lisse, t: tMs }, niveau: clamp01((lo + (hi - lo) * lisse) / 100) }
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
