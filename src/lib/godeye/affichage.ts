// God Eye : réglages d'affichage (globe ou carte, rotation...) et choix des étiquettes flottantes (logique pure, testée dans affichage.test.ts).
import type { Objet } from './modele'
import { interet } from './une'

export type ModeVue = 'globe' | 'plat'
export type OngletId = 'fil' | 'filtres' | 'vues' | 'une'
export type AffichageStocke = { mode: ModeVue; rotation: boolean; jourNuit: boolean; tiroir: OngletId | null }
export const CLE_AFFICHAGE = 'neutroncore_godeye_affichage'

const ONGLETS_VALIDES: readonly string[] = ['fil', 'filtres', 'vues', 'une']

/** Relit les réglages d'affichage ; `calme` (préférence « réduire les animations ») coupe la rotation par défaut. */
export function lireAffichage(brut: string | null, calme = false): AffichageStocke {
  let o: Record<string, unknown> = {}
  try { const j = JSON.parse(brut ?? 'null'); if (j && typeof j === 'object') o = j as Record<string, unknown> } catch { /* réglage illisible : défauts */ }
  return {
    mode: o.mode === 'plat' ? 'plat' : 'globe',
    rotation: typeof o.rotation === 'boolean' ? o.rotation : !calme,
    jourNuit: o.jourNuit !== false,
    tiroir: typeof o.tiroir === 'string' && ONGLETS_VALIDES.includes(o.tiroir) ? (o.tiroir as OngletId) : null,
  }
}

/**
 * Objets proposés aux étiquettes flottantes : ce qui mérite un titre (urgences, militaires, séismes, événements, actualités, stations),
 * jamais les avions civils ni les navires ordinaires ; l'objet choisi est toujours présent. Borné à `max` pour rester léger.
 */
export function candidatsEtiquettes(objets: readonly Objet[], choisi: string | null, max = 70): Objet[] {
  const garde = (o: Objet): boolean => {
    if (o.id === choisi) return true
    switch (o.couche) {
      case 'avions': return o.ton !== 'info'
      case 'navires': return false
      case 'satellites': return o.sorte === 'stations'
      case 'cyber': return false
      default: return true
    }
  }
  return objets.filter(garde).map((o) => [o, interet(o)] as const).sort((a, b) => b[1] - a[1] || a[0].id.localeCompare(b[0].id)).slice(0, max).map(([o]) => o)
}

/** Nombre maximal d'étiquettes selon le zoom (1 = Terre entière) et la largeur de la scène : peu en vue lointaine, davantage de près, très peu sur téléphone. */
export function maxEtiquettes(zoom: number, largeur: number): number {
  const base = Math.round(5 + Math.max(1, Number.isFinite(zoom) ? zoom : 1) * 1.1)
  const plafond = largeur < 600 ? 5 : largeur < 1000 ? 10 : 18
  return Math.max(3, Math.min(plafond, base))
}

/** Rotation effective : elle se met en pause quand un élément est sélectionné, pour pouvoir le lire. */
export const rotationEffective = (rotation: boolean, choisi: string | null): boolean => rotation && choisi === null
