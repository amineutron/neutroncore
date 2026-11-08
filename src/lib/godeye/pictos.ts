// God Eye : pictogrammes de la carte (logique pure, testée dans pictos.test.ts).
// Chaque pictogramme est un tracé SVG sur une grille 24 x 24 centrée en (12, 12) : le même texte sert au dessin sur la toile
// (Path2D) et à la légende (balise <path>). Aucun accès à la toile ici.
import { THEMES, type Objet } from './modele'

export type PictoId =
  | 'avion' | 'avion-mil' | 'helico' | 'navire' | 'satellite' | 'station' | 'sat-nav' | 'sat-meteo'
  | 'seisme' | 'incendie' | 'volcan' | 'tempete' | 'inondation' | 'secheresse' | 'glissement' | 'glace' | 'chaleur' | 'brume' | 'flocon' | 'alerte'
  | 'guerre' | 'diplomatie' | 'economie' | 'cyber' | 'securite' | 'catastrophe' | 'monde'

/** `trait` : tracé dessiné au trait (épaisseur en unités de grille) ; sinon rempli. `pair` : trous (règle pair-impair). */
export type Picto = { d: string; trait?: number; oriente?: boolean }

export const PICTOS: Record<PictoId, Picto> = {
  avion: { oriente: true, d: 'M12 1.5l1.9 6.8 8.1 5.2v2.3l-8.1-2.4-.5 5.1 2.6 2v1.5L12 21l-4 1v-1.5l2.6-2-.5-5.1L2 15.8v-2.3l8.1-5.2z' },
  'avion-mil': { oriente: true, d: 'M12 1l2.6 8L22 19v2l-8.4-2.6L13 22l2 1v.7L12 23l-3 .7V23l2-1-.6-3.6L2 21v-2l7.4-10z' },
  helico: { oriente: true, d: 'M3 4h18v1.5H3zM11.2 5.5h1.6V8h-1.6zM8.5 8h7a2 2 0 0 1 2 2v3.5a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3V10a2 2 0 0 1 2-2zM11.2 16.5h1.6v4.5h-1.6zM9 20.3h6V22H9z' },
  navire: { oriente: true, d: 'M12 1.5c3.2 3.5 4.4 7.6 4.4 12V22H7.6v-8.5c0-4.4 1.2-8.5 4.4-12zM10 13h4v3.6h-4z' },
  satellite: { d: 'M9.8 9.8h4.4v4.4H9.8zM1.5 10.8h6.8v2.4H1.5zM15.7 10.8h6.8v2.4h-6.8zM11.3 5h1.4v4.8h-1.4zM11.3 14.2h1.4V19h-1.4z' },
  station: { d: 'M10.9 5h2.2v14h-2.2zM2 6.5h6.8v4.2H2zM15.2 6.5H22v4.2h-6.8zM2 13.3h6.8v4.2H2zM15.2 13.3H22v4.2h-6.8zM8.8 11h6.4v2H8.8z' },
  'sat-nav': { d: 'M12 2.5l9.5 9.5-9.5 9.5L2.5 12zM12 7.3L7.3 12l4.7 4.7 4.7-4.7z' },
  'sat-meteo': { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 6a6 6 0 0 1 0 12 6 6 0 0 1 0-12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  seisme: { trait: 2, d: 'M1.5 12.5h4.2l2.3-7 3.6 13 3-9.5 1.6 3.5h6.3' },
  incendie: { d: 'M12 1.8c.9 4.2 5.6 6.2 5.6 11.4a5.6 5.6 0 0 1-11.2 0c0-2.3 1-3.9 2.2-5 0 2.2.9 3.2 2 3.4-.7-4 .4-6.7 1.4-9.8z' },
  volcan: { d: 'M1.5 21.5L9 9l1.6 1.8L12 9l1.4 1.8L15 9l7.5 12.5zM9.6 2.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM13.6 1.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM12 5.6a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z' },
  tempete: { d: 'M13.5 1.5L4.5 13.5h6L9.5 22.5l10-13.5h-6.2z' },
  inondation: { trait: 2, d: 'M2 7q2.5-3 5 0t5 0 5 0 5 0M2 12.5q2.5-3 5 0t5 0 5 0 5 0M2 18q2.5-3 5 0t5 0 5 0 5 0' },
  secheresse: { trait: 1.8, d: 'M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1' },
  glissement: { d: 'M2 21L13 5l3.5 5L22 7v14zM6 16.5a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 0 0-2.4 0z' },
  glace: { d: 'M1.5 21l6.2-11 4 6.2L15 11l7.5 10zM4 22.5h16v-1H4z' },
  chaleur: { d: 'M9.8 4.5a2.2 2.2 0 0 1 4.4 0v9.2a4.6 4.6 0 1 1-4.4 0zM11.2 7h1.6v8.4h-1.6z' },
  brume: { trait: 1.9, d: 'M3 7.5h18M5.5 12h13M3 16.5h18' },
  flocon: { trait: 1.8, d: 'M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5' },
  alerte: { d: 'M12 2L22.5 20.5h-21zM11 9h2v6h-2zM11 16.5h2v2h-2z' },
  guerre: { d: 'M12 1.5l2.4 6.6 6.9-.9-4.5 5.3 4.5 5.4-6.9-.9L12 23l-2.4-6.6-6.9.9 4.5-5.4-4.5-5.3 6.9.9z' },
  diplomatie: { d: 'M4.5 2h2v20h-2zM7.5 3.5h12l-3.2 4.2 3.2 4.3h-12z' },
  economie: { d: 'M3.5 21v-8h4.2v8zM9.9 21V4.5h4.2V21zM16.3 21v-11h4.2v11z' },
  cyber: { d: 'M12 1.8l8.5 3.2v6.2c0 5.2-3.6 9.2-8.5 11-4.9-1.8-8.5-5.8-8.5-11V5zM11 7v5.5h-2L12 17l3-4.5h-2V7z' },
  securite: { d: 'M12 1.8L22 20.5H2zM11 8.5h2v6h-2zM11 16h2v2h-2z' },
  catastrophe: { d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM11 6.5h2V13h-2zM11 15h2v2.2h-2z' },
  monde: { trait: 1.6, d: 'M21.5 12a9.5 9.5 0 1 1-19 0 9.5 9.5 0 0 1 19 0zM2.5 12h19M12 2.5c3 2.6 4.4 5.8 4.4 9.5S15 18.9 12 21.5M12 2.5C9 5.1 7.6 8.3 7.6 12S9 18.9 12 21.5' },
}

const EVENEMENT_PICTO: Record<string, PictoId> = {
  wildfires: 'incendie', volcanoes: 'volcan', severeStorms: 'tempete', floods: 'inondation', drought: 'secheresse',
  landslides: 'glissement', seaLakeIce: 'glace', tempExtremes: 'chaleur', dustHaze: 'brume', snow: 'flocon',
}
const SAT_PICTO: Record<string, PictoId> = { stations: 'station', 'gps-ops': 'sat-nav', galileo: 'sat-nav', beidou: 'sat-nav', 'glo-ops': 'sat-nav', weather: 'sat-meteo' }

/** Pictogramme d'un objet de la carte, déduit de sa couche et de son sous-type. Jamais d'exception : repli sur un tracé neutre. */
export function pictoDe(o: Pick<Objet, 'couche' | 'sorte'>): PictoId {
  switch (o.couche) {
    case 'avions': return o.sorte === 'militaire' ? 'avion-mil' : o.sorte === 'helico' ? 'helico' : 'avion'
    case 'navires': return 'navire'
    case 'satellites': return SAT_PICTO[o.sorte ?? ''] ?? 'satellite'
    case 'seismes': return 'seisme'
    case 'evenements': return EVENEMENT_PICTO[o.sorte ?? ''] ?? 'alerte'
    case 'cyber': return 'cyber'
    case 'infos': { const t = THEMES.find((x) => x.id === o.sorte)?.id; return t ?? 'monde' }
  }
}

/** Niveau de détail selon le nombre d'objets visibles : 2 = pastille + pictogramme, 1 = pictogramme seul, 0 = forme simple (foule). */
export const niveauDetail = (visibles: number): 0 | 1 | 2 => (visibles <= 160 ? 2 : visibles <= 700 ? 1 : 0)

/** Demi-taille en pixels du pictogramme d'un objet (lisible sans masquer la carte : bornée). */
export const tailleDemi = (o: Pick<Objet, 'rayon' | 'couche'>, lod: 0 | 1 | 2): number =>
  Math.round(Math.min(14, Math.max(lod === 2 ? 9 : 7, o.rayon * (lod === 2 ? 1.7 : 1.5))) * 10) / 10
