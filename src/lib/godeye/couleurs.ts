// God Eye : une couleur par sujet, pour que la carte se lise d'un coup d'oeil (logique pure, testée dans globe.test.ts).
// Les teintes sont propres à God Eye (elles ne suivent pas le thème de l'app) : un rouge de guerre doit rester rouge partout.
import type { CoucheId, Objet, Theme } from './modele'

export const COULEURS_THEME: Record<Theme, string> = {
  guerre: '#ff5470', diplomatie: '#5aa9ff', economie: '#3ddc97', cyber: '#b48cff', securite: '#ff9f43', catastrophe: '#ffd43b', monde: '#9aa7ba',
}
export const COULEURS_COUCHE: Record<CoucheId, string> = {
  infos: '#5aa9ff', seismes: '#ff7a3d', avions: '#e8f0ff', satellites: '#6fe7ff', navires: '#3fb7e8', evenements: '#ffb347', cyber: '#b48cff',
}
const COULEURS_EVENEMENT: Record<string, string> = {
  wildfires: '#ff6a2b', volcanoes: '#ff3d3d', severeStorms: '#6aa8ff', floods: '#3a9bff', drought: '#d9a441', landslides: '#b08968',
  seaLakeIce: '#9fe3ff', tempExtremes: '#ff8fab', dustHaze: '#c8a97e', snow: '#dff3ff',
}
export const COULEUR_MILITAIRE = '#ffb454'
export const COULEUR_URGENCE = '#ff3b5c'

/** Couleur d'un point de la carte : le thème pour une actualité, la catégorie pour un événement, la gravité pour un séisme... */
export function couleurObjet(o: Pick<Objet, 'couche' | 'ton' | 'sorte'>): string {
  switch (o.couche) {
    case 'infos': return COULEURS_THEME[(o.sorte as Theme) ?? 'monde'] ?? COULEURS_THEME.monde
    case 'evenements': return COULEURS_EVENEMENT[o.sorte ?? ''] ?? COULEURS_COUCHE.evenements
    case 'seismes': return o.ton === 'crit' ? '#ff4d4d' : o.ton === 'warn' ? '#ff8a3d' : '#ffd23f'
    case 'avions': return o.ton === 'crit' ? COULEUR_URGENCE : o.sorte === 'militaire' ? COULEUR_MILITAIRE : COULEURS_COUCHE.avions
    case 'cyber': return o.ton === 'crit' ? COULEUR_URGENCE : o.ton === 'warn' ? '#ffb454' : '#6fe7b0'
    default: return COULEURS_COUCHE[o.couche]
  }
}

/** Teinte translucide (`alpha` de 0 à 1) d'une couleur #rrggbb, pour les halos et les fonds d'étiquettes. */
export function avecAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, alpha))})`
}
