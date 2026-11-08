// God Eye sur la télé du tableau de bord : plan (carte plate), rotation (globe qui tourne seul) ou zone surveillée précise.
// Logique pure testée dans tele.test.ts.
import { VUE_DEPART, type Vue } from '../vueMonde'
import { cadreEtape, type ZoneVue } from './rotation'

export type ModeTele = 'plan' | 'rotation' | 'zone'
export type ReglageTele = { mode: ModeTele; zone_id: string; vitesse: number; resume: boolean }
export const CLE_TELE = 'neutroncore_tv_godeye'
export const MODES_TELE: { id: ModeTele; nom: string }[] = [{ id: 'plan', nom: 'plan' }, { id: 'rotation', nom: 'rotation' }, { id: 'zone', nom: 'zone' }]
export const VITESSES_TELE: { v: number; nom: string }[] = [{ v: 0.5, nom: 'lente' }, { v: 1, nom: 'normale' }, { v: 2.5, nom: 'rapide' }]
export const TELE_DEFAUT: ReglageTele = { mode: 'rotation', zone_id: '', vitesse: 1, resume: false }
const DEGRES_PAR_S = 5

export function lireTele(brut: string | null): ReglageTele {
  let o: Record<string, unknown> = {}
  try { const j = JSON.parse(brut ?? 'null'); if (j && typeof j === 'object') o = j as Record<string, unknown> } catch { /* illisible : défauts */ }
  const v = typeof o.vitesse === 'number' && Number.isFinite(o.vitesse) ? Math.min(4, Math.max(0.25, o.vitesse)) : TELE_DEFAUT.vitesse
  return {
    mode: o.mode === 'plan' || o.mode === 'zone' ? o.mode : 'rotation',
    zone_id: typeof o.zone_id === 'string' && /^[\w-]{0,40}$/.test(o.zone_id) ? o.zone_id : '',
    vitesse: v, resume: o.resume === true,
  }
}

/** Degrés par seconde de la Terre pour une vitesse (1 = normale). */
export const vitesseDegres = (v: number): number => DEGRES_PAR_S * v

/** Cadrage de départ du mode ; une zone introuvable ou coupée retombe sur le monde (et le dit via `zoneAbsente`). */
export function cadreTele(r: ReglageTele, zones: readonly ZoneVue[]): { vue: Vue; zoneAbsente: boolean } {
  if (r.mode !== 'zone') return { vue: VUE_DEPART, zoneAbsente: false }
  const v = cadreEtape({ type: 'zone', zone_id: r.zone_id }, zones)
  return v ? { vue: v, zoneAbsente: false } : { vue: VUE_DEPART, zoneAbsente: true }
}

/** Le globe n'est utilisé qu'en mode rotation ; plan et zone sont des cartes à plat (lisibles de loin). */
export const globePourMode = (m: ModeTele): boolean => m === 'rotation'
