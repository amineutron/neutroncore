// God Eye : zone visible de la carte, en degrés (logique pure).
import { deprojeter, type Vue } from '../vueMonde'
import type { Boite } from './modele'

export const MONDE: Boite = { sud: -90, ouest: -180, nord: 90, est: 180 }

/** Zone couverte par la toile `w` x `h` pour cette vue, bornée au monde. */
export function boiteDeVue(vue: Vue, w: number, h: number): Boite {
  const [ouest, nord] = deprojeter(0, 0, vue, w, h)
  const [est, sud] = deprojeter(w, h, vue, w, h)
  return { sud: Math.max(-90, sud), nord: Math.min(90, nord), ouest: Math.max(-180, ouest), est: Math.min(180, est) }
}

/** Arrondit la zone vers l'extérieur sur un pas de `pas` degrés : un léger déplacement ne relance pas les sources. */
export function arrondir(b: Boite, pas = 5): Boite {
  return {
    sud: Math.max(-90, Math.floor(b.sud / pas) * pas), nord: Math.min(90, Math.ceil(b.nord / pas) * pas),
    ouest: Math.max(-180, Math.floor(b.ouest / pas) * pas), est: Math.min(180, Math.ceil(b.est / pas) * pas),
  }
}

export const cleBoite = (b: Boite): string => `${b.sud},${b.ouest},${b.nord},${b.est}`
export const requeteBoite = (b: Boite): string => `sud=${b.sud}&ouest=${b.ouest}&nord=${b.nord}&est=${b.est}`

/** Part du monde que couvre la zone (0 à 1) : au-delà de ~25 % on n'interroge plus par zone. */
export const partDuMonde = (b: Boite): number => ((b.nord - b.sud) * (b.est - b.ouest)) / (180 * 360)
