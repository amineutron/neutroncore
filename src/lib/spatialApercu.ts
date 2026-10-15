// Lumière 3d : l'aperçu animé d'un réglage commun (logique pure). Le réglage balaie de son minimum
// à son maximum pendant qu'une lampe témoin joue, calculée par le vrai moteur (`gainPulsation`).

import { gainPulsation, phaseDeVie, type Commun } from './spatialFx'

export type CleCommun = Exclude<keyof Commun, 'auto'>
export const BORNES: Record<CleCommun, [number, number]> = {
  intensite: [10, 100], sensibilite: [0, 100], profondeur: [0, 100], attaque: [0, 100], retombee: [0, 100], plancher: [0, 60], vie: [0, 100],
}
export const PERIODE = 6            // secondes pour un aller du minimum au maximum, pauses comprises
export const TEMPS_PAR_S = 1.25     // tempo de la démonstration : 75 pulsations par minute, assez lent pour lire un fondu

/** Où en est le balayage à l'instant `t` (secondes) : 0 = minimum, 1 = maximum. Pause aux deux bouts. */
export function balayage(t: number): number {
  const u = (((t % PERIODE) + PERIODE) % PERIODE) / PERIODE
  if (u < 0.12) return 0
  if (u > 0.82) return 1
  return (u - 0.12) / 0.7
}

/** Les réglages de la démonstration : celui qu'on montre vaut `v`, les autres sont posés pour qu'on le voie agir. */
export function communDeDemo(cle: CleCommun, v: number): Commun {
  const base: Commun = { intensite: 100, sensibilite: 68, profondeur: 100, attaque: 0, retombee: 55, plancher: 0, vie: 0 }
  if (cle === 'attaque') return { ...base, attaque: v, retombee: 45 }
  if (cle === 'vie') return { ...base, vie: v, attaque: 40, retombee: 60 }     // monter puis repartir : on voit la pulsation vivre
  return { ...base, [cle]: v }
}

// Sensibilité : des sons de forces inégales, toujours les mêmes ; un son dépasse ou non le seuil.
export const SONS = [1, 0.34, 0.62, 0.22, 0.9, 0.45, 0.28, 0.7]
/** Force qu'un son doit dépasser pour compter comme un temps : haute à sensibilité 0, basse à 100. */
export function seuilDeDemo(sensibilite: number): number {
  return 0.95 - 0.8 * Math.max(0, Math.min(1, sensibilite / 100))
}

/** Lumière de la lampe témoin (0..1) à l'instant `t`, le réglage `cle` valant `v`. */
export function lampeDeDemo(cle: CleCommun, v: number, t: number): number {
  const temps = t * TEMPS_PAR_S
  if (cle === 'sensibilite') {
    const son = SONS[Math.floor(temps) % SONS.length]
    return son >= seuilDeDemo(v) ? (1 - (temps - Math.floor(temps))) ** 2 : 0
  }
  const c = communDeDemo(cle, v)
  return (c.intensite / 100) * gainPulsation(phaseDeVie(temps, c.vie).phase, c)
}

export const LEGENDES: Record<CleCommun, { label: string; quoi: string; mini: string; maxi: string }> = {
  intensite: { label: 'intensité', quoi: 'Le volume de lumière de tout ce qui joue.', mini: 'tamisé', maxi: 'plein feu' },
  sensibilite: { label: 'sensibilité à la musique', quoi: 'Ce que huebeat prend pour un temps. Ne sert que sur les vraies lampes.', mini: 'seuls les gros coups comptent', maxi: 'le moindre son déclenche' },
  profondeur: { label: 'force de la respiration', quoi: 'À quel point la lumière respire avec la musique.', mini: 'lumière continue, l’effet seul', maxi: 'tout retombe entre deux temps' },
  attaque: { label: 'la lumière arrive', quoi: 'Le temps qu’elle met à monter au début de chaque pulsation.', mini: 'd’un coup', maxi: 'lentement, comme une vague' },
  retombee: { label: 'la lumière repart', quoi: 'Le temps qu’elle met à retomber ensuite.', mini: 'vite, un flash', maxi: 'lentement, une traîne' },
  vie: { label: 'durée d’une pulsation', quoi: 'Sur combien de temps une pulsation monte puis repart : un temps, deux, une mesure ou deux. Arrive et repart se partagent cette durée.', mini: 'un flash par temps', maxi: 'une vague qui dure deux mesures' },
  plancher: { label: 'lumière entre deux temps', quoi: 'Ce qui reste allumé au creux de la respiration.', mini: 'noir complet', maxi: 'toujours bien éclairé' },
}

// ---- ce que huebeat entend : niveaux du son, seuil à dépasser, temps pris ----
export type Ecoute = { sensibilite?: number | null; actif: boolean; pas_ms: number; plancher: number; niveaux: number[]; seuils: number[]; pris: number[] }

/** Hauteur (0..1) de chaque son et du seuil sur une même échelle, la plus haute valeur de la fenêtre valant 1.
 * Un son « passe » s'il atteint le seuil ; `pris` dit ceux que huebeat a vraiment comptés comme un temps (il en
 * écarte quand deux coups sont trop rapprochés). */
export function echelleEcoute(e: Pick<Ecoute, 'niveaux' | 'seuils' | 'pris'>): { barres: { h: number; passe: boolean; pris: boolean }[]; seuil: number[]; temps: number } {
  const n = Math.min(e.niveaux.length, e.seuils.length, e.pris.length)
  const haut = Math.max(1e-9, ...e.niveaux.slice(0, n), ...e.seuils.slice(0, n)) * 1.08
  const barres = Array.from({ length: n }, (_, i) => ({ h: e.niveaux[i] / haut, passe: e.seuils[i] > 0 && e.niveaux[i] >= e.seuils[i], pris: e.pris[i] === 1 }))
  return { barres, seuil: e.seuils.slice(0, n).map((s) => s / haut), temps: barres.filter((b) => b.pris).length }
}
