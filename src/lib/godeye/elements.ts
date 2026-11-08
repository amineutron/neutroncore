// God Eye : éléments affichés sur la scène, que l'on peut masquer un par un (logique pure, testée dans elements.test.ts).
export type ElementId = 'pictos' | 'halos' | 'etiquettes' | 'frontieres' | 'quadrillage' | 'bandeau' | 'legende' | 'regroupement' | 'nuit' | 'texture' | 'satellite'
export type Elements = Record<ElementId, boolean>
export const CLE_ELEMENTS = 'neutroncore_godeye_elements'

export const ELEMENTS: { id: ElementId; nom: string; aide: string }[] = [
  { id: 'pictos', nom: 'pictogrammes', aide: 'Un dessin par type d\'objet (avion, navire, séisme...). Décoché : formes simples, plus légères.' },
  { id: 'halos', nom: 'halos animés', aide: 'Les cercles qui battent autour des urgences, séismes et actualités graves.' },
  { id: 'etiquettes', nom: 'étiquettes flottantes', aide: 'Les titres posés à côté des objets importants.' },
  { id: 'frontieres', nom: 'frontières', aide: 'Les limites entre pays, visibles en zoomant.' },
  { id: 'quadrillage', nom: 'quadrillage', aide: 'Les méridiens et parallèles.' },
  { id: 'bandeau', nom: 'bandeau défilant', aide: 'La ligne « en direct » en bas de la scène.' },
  { id: 'legende', nom: 'légende', aide: 'La liste des pictogrammes sous la scène.' },
]

/** Options du rendu de la carte (section « carte » des réglages) : à part de la liste ci-dessus pour ne pas fausser le décompte des éléments masqués. */
export const ELEMENTS_CARTE: { id: ElementId; nom: string; aide: string; defaut: boolean }[] = [
  { id: 'regroupement', nom: 'regrouper les objets denses', aide: 'À faible zoom, les avions et navires serrés deviennent une pastille avec un compteur ; zoomer les déploie.', defaut: true },
  { id: 'nuit', nom: 'voile de nuit', aide: 'Assombrit la moitié de la Terre où il fait nuit en ce moment.', defaut: true },
  { id: 'texture', nom: 'texture de la Terre', aide: 'Terres et océans dessinés. Décoché : fond uni, seuls les contours restent.', defaut: true },
  { id: 'satellite', nom: 'vue type satellite', aide: 'Fond sombre avec un relief teinté, fabriqué sur place (aucune image téléchargée).', defaut: false },
]

export const ELEMENTS_DEFAUT: Elements = {
  pictos: true, halos: true, etiquettes: true, frontieres: true, quadrillage: true, bandeau: true, legende: true,
  regroupement: true, nuit: true, texture: true, satellite: false,
}

/** Relit les réglages enregistrés : tout ce qui manque ou est illisible reste affiché (on ne cache jamais par accident). */
export function lireElements(brut: string | null): Elements {
  let o: Record<string, unknown> = {}
  try { const j = JSON.parse(brut ?? 'null'); if (j && typeof j === 'object') o = j as Record<string, unknown> } catch { /* illisible : tout affiché */ }
  const base = Object.fromEntries(ELEMENTS.map((e) => [e.id, o[e.id] !== false]))
  const carte = Object.fromEntries(ELEMENTS_CARTE.map((e) => [e.id, typeof o[e.id] === 'boolean' ? o[e.id] : e.defaut]))
  return { ...base, ...carte } as Elements
}
