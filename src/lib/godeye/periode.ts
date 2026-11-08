// God Eye : « depuis combien de temps » les données sont prises, par rapport à maintenant (logique pure, testée dans periode.test.ts).
import type { Filtres } from './filtres'

/** Durées proposées pour les séismes, en heures. */
export const HEURES_SEISMES: readonly number[] = [1, 6, 24, 72, 168, 720]
const HEURES_INFOS_MAX = 72

/** « 1 h », « 6 h », « 3 jours », « 7 jours », « 30 jours ». */
export function libelleHeures(h: number): string {
  if (h < 24) return `${h} h`
  const j = Math.round(h / 24)
  return j === 1 ? '24 h' : `${j} jours`
}

/** Flux de séismes de l'USGS qui couvre la durée demandée (le plus court qui suffit) ; le filtrage fin se fait ensuite côté écran. */
export function fluxSeismes(heures: number): 'heure' | 'jour' | 'semaine' | 'mois' {
  return heures <= 1 ? 'heure' : heures <= 24 ? 'jour' : heures <= 168 ? 'semaine' : 'mois'
}

/** Raccourcis « tout depuis » : une seule durée appliquée aux actualités, aux séismes et aux événements. */
export const DEPUIS: readonly { heures: number; nom: string }[] = [
  { heures: 1, nom: '1 h' }, { heures: 6, nom: '6 h' }, { heures: 24, nom: '24 h' }, { heures: 72, nom: '3 jours' }, { heures: 168, nom: '7 jours' },
]

const joursEvenements = (heures: number): number => Math.max(1, Math.ceil(heures / 24))

/** Applique la même durée à toutes les sources datées (les actualités plafonnent à 3 jours : c'est ce que gardent les flux). */
export function appliquerDepuis(f: Filtres, heures: number): Filtres {
  return {
    ...f,
    infos: { ...f.infos, heures: Math.min(HEURES_INFOS_MAX, heures) },
    seismes: { ...f.seismes, heures },
    evenements: { ...f.evenements, jours: joursEvenements(heures) },
  }
}

/** Raccourci qui décrit exactement les filtres actuels, ou null (« personnalisé »). */
export function depuisCourant(f: Filtres): number | null {
  for (const d of DEPUIS) {
    if (f.infos.heures === Math.min(HEURES_INFOS_MAX, d.heures) && f.seismes.heures === d.heures && f.evenements.jours === joursEvenements(d.heures)) return d.heures
  }
  return null
}
