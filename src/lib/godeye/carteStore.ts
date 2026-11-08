// God Eye : petit magasin des réglages de la carte (quadrillage), partagé entre le panneau de réglages et les deux vues
// sans passer par les props de l'écran. Persisté en localStorage.
import { useSyncExternalStore } from 'react'
import { CLE_CARTE, lireReglagesCarte, REGLAGES_CARTE_DEFAUT, type ReglagesCarte } from './apparence'

let courant: ReglagesCarte = REGLAGES_CARTE_DEFAUT
try { courant = lireReglagesCarte(localStorage.getItem(CLE_CARTE)) } catch { /* stockage indisponible : défauts */ }
const ecouteurs = new Set<() => void>()

export const lireCarte = (): ReglagesCarte => courant

export function ecrireCarte(suite: Partial<ReglagesCarte>): void {
  courant = { ...courant, ...suite }
  try { localStorage.setItem(CLE_CARTE, JSON.stringify(courant)) } catch { /* non retenu */ }
  ecouteurs.forEach((f) => f())
}

export function useReglagesCarte(): ReglagesCarte {
  return useSyncExternalStore((f) => { ecouteurs.add(f); return () => { ecouteurs.delete(f) } }, lireCarte)
}
