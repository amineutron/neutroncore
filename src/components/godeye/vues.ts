import type { Ref } from 'react'
import type { Boite, Objet } from '../../lib/godeye/modele'
import type { Vue } from '../../lib/vueMonde'

/** Ce que l'écran peut demander à une vue (globe 3D ou carte à plat) : lire/appliquer le cadrage, projeter un point, connaître sa taille. */
export type VueHandle = {
  lireVue: () => Vue
  appliquerVue: (v: Vue) => void
  /** Position en pixels d'un point de la Terre dans la scène, ou null s'il n'est pas visible (hors cadre ou derrière l'horizon). */
  projeter: (lon: number, lat: number) => { x: number; y: number } | null
  taille: () => { w: number; h: number }
}

export type PropsVue = {
  objets: readonly Objet[]
  choisi: string | null
  onChoisir: (id: string | null) => void
  /** Trace au sol à montrer (satellite choisi), en [lon, lat]. */
  trace: [number, number][][] | null
  /** Appelé au repos (250 ms après le dernier geste) avec le cadrage et la zone visible en degrés. */
  onVue: (vue: Vue, boite: Boite) => void
  /** Objets proposés pour les étiquettes flottantes, et nombre maximal à afficher. */
  etiquettes: readonly Objet[]
  maxEtiquettes: number
  bloques?: () => { x: number; y: number; w: number; h: number }[]
  ref?: Ref<VueHandle>
}
