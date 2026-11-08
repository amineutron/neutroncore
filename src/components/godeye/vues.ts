import type { Ref } from 'react'
import type { Elements } from '../../lib/godeye/elements'
import type { Boite, Objet } from '../../lib/godeye/modele'
import type { Vue } from '../../lib/vueMonde'
import type { Polyligne } from '../../lib/godeye/trace'

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
  /** Âge de position des satellites, trace de l'objet sélectionné ou marqué (voir dessinTraces.ts). */
  polylignes?: readonly Polyligne[]
  /** Appelé au repos (250 ms après le dernier geste) avec le cadrage et la zone visible en degrés. */
  onVue: (vue: Vue, boite: Boite) => void
  /** Objets proposés pour les étiquettes flottantes, et nombre maximal à afficher. */
  etiquettes: readonly Objet[]
  maxEtiquettes: number
  /** Éléments que l'utilisateur a choisi d'afficher ou de masquer (halos, pictogrammes, frontières...). */
  elements: Elements
  /** Zones surveillées à dessiner (actives + brouillon en cours d'édition). */
  zones?: readonly import('../../lib/godeye/zones').ZoneBrouillon[]
  bloques?: () => { x: number; y: number; w: number; h: number }[]
  ref?: Ref<VueHandle>
}
