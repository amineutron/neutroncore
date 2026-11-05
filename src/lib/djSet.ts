// DJ Light : la lecture d'un set (logique pure, testée dans djSet.test.ts).
// Un set est une suite de pas : une scène du pad, éventuellement un autre profil de couches, et ce qui la fait passer
// à la suivante : un nombre de mesures, un drop (après au moins une mesure), ou la main de l'utilisateur.
import { TEMPS_PAR_MESURE } from './spatialFx'
import type { PasDj, SetDj } from './djCouches'

/** Où en est un set : le pas en cours et le temps (en pulsations) où il a commencé. */
export type LectureSet = { set: string; index: number; depuis: number }

export const demarrerSet = (set: Pick<SetDj, 'id'>, beat: number, index = 0): LectureSet => ({ set: set.id, index, depuis: beat })

export const pasEnCours = (set: Pick<SetDj, 'pas'>, l: LectureSet): PasDj | undefined => set.pas[l.index]

/** Durée minimale d'un pas en pulsations ; pour « drop », une mesure avant d'écouter le drop. */
const dureeMini = (p: PasDj): number => (p.fin === 'drop' ? TEMPS_PAR_MESURE : p.mesures * TEMPS_PAR_MESURE)

/** Passe au pas suivant, ou null quand un set sans boucle est fini. */
export function suivant(set: Pick<SetDj, 'pas' | 'boucle' | 'id'>, l: LectureSet, beat: number): LectureSet | null {
  const i = l.index + 1
  if (i < set.pas.length) return { set: l.set, index: i, depuis: beat }
  return set.boucle && set.pas.length > 0 ? { set: l.set, index: 0, depuis: beat } : null
}

export function precedent(set: Pick<SetDj, 'pas'>, l: LectureSet, beat: number): LectureSet {
  return { set: l.set, index: l.index > 0 ? l.index - 1 : set.pas.length - 1, depuis: beat }
}

/** Le set après un instant de plus. `drop` : un drop vient d'être vu. `change` dit si on a changé de pas. */
export function avancerSet(set: Pick<SetDj, 'pas' | 'boucle' | 'id'>, l: LectureSet, beat: number, drop: boolean): { lecture: LectureSet | null; change: boolean } {
  const pas = pasEnCours(set, l)
  if (!pas) return { lecture: null, change: false }
  const ecoule = beat - l.depuis
  const fini = pas.fin === 'mesures' ? ecoule >= dureeMini(pas) : pas.fin === 'drop' ? drop && ecoule >= dureeMini(pas) : false
  if (!fini) return { lecture: l, change: false }
  return { lecture: suivant(set, l, beat), change: true }
}

/** Avancement du pas en cours, de 0 à 1 (1 pour un pas qui attend la main ou un drop). */
export function avancement(set: Pick<SetDj, 'pas'>, l: LectureSet, beat: number): number {
  const pas = pasEnCours(set, l)
  if (!pas || pas.fin === 'manuel') return 1
  return Math.min(1, Math.max(0, (beat - l.depuis) / Math.max(1, dureeMini(pas))))
}

/** Durée totale d'un set en mesures (les pas « drop » et « manuel » comptent leur minimum). */
export const mesuresTotales = (set: Pick<SetDj, 'pas'>): number => set.pas.reduce((t, p) => t + (p.fin === 'drop' ? 1 : p.mesures), 0)
