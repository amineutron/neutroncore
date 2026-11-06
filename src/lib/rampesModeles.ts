// Rampes de départ proposées à la création (pures, testées). Les lampes sont choisies ensuite par l'utilisateur.
import { BRI_MAX, courbeGamma, courbeLineaire, type Piste, type Point, type Rampe } from './rampes'

export type Modele = { id: string; nom: string; desc: string; fabrique: (lampes: string[]) => Omit<Rampe, 'id'> }

const montee = (d: number, de: number, a: number): Point[] => courbeGamma(d, de, a)
const descente = (d: number, de: number, a: number): Point[] => courbeGamma(d, de, a, 0.5)        // gamma < 1 : tombe vite puis traîne, comme un coucher de soleil

const piste = (lampes: string[], bri: Point[], kelvin: Point[]): Piste => ({ lampes, bri, kelvin })

export const MODELES: Modele[] = [
  {
    id: 'coucher', nom: 'coucher de soleil', desc: '45 min : la lumière baisse et rougit jusqu’à presque rien',
    fabrique: (l) => ({ nom: 'coucher de soleil', duree_s: 2700, pas_s: 10, boucle: false,
      pistes: [piste(l, descente(2700, 200, 8), courbeLineaire(2700, 3800, 2200, 'doux'))] }),
  },
  {
    id: 'respiration', nom: 'respiration', desc: '1 min en boucle : la lumière monte et redescend doucement',
    fabrique: (l) => ({ nom: 'respiration', duree_s: 60, pas_s: 3, boucle: true,
      pistes: [piste(l, [{ t: 0, v: 40, forme: 'doux' }, { t: 30, v: 180, forme: 'doux' }, { t: 60, v: 40, forme: 'lineaire' }], [])] }),
  },
  {
    id: 'bougie', nom: 'bougie', desc: 'ambiance chaude et vivante, 2 min en boucle',
    fabrique: (l) => ({ nom: 'bougie', duree_s: 120, pas_s: 4, boucle: true,
      pistes: [piste(l, [60, 95, 70, 110, 80, 100, 65, 60].map((v, i, a) => ({ t: (i * 120) / (a.length - 1), v, forme: 'doux' as const })), courbeLineaire(120, 2200, 2400))] }),
  },
  {
    id: 'aube-courte', nom: 'aube courte', desc: '10 min : de la nuit au jour, sans la télé',
    fabrique: (l) => ({ nom: 'aube courte', duree_s: 600, pas_s: 5, boucle: false,
      pistes: [piste(l, montee(600, 1, BRI_MAX), courbeLineaire(600, 2200, 5000, 'doux'))] }),
  },
]

export function depuisModele(id: string, lampes: string[]): Omit<Rampe, 'id'> | null {
  return MODELES.find((m) => m.id === id)?.fabrique(lampes) ?? null
}
