// Lumière 3d, mode simple : trois curseurs en mots (douceur, durée des flashs, contraste) qui calculent
// les vrais réglages communs, et la ligne d'état qui dit en une phrase ce que font les lampes. Logique pure.

import type { Commun } from './spatialFx'

export type Curseurs = { douceur: number; duree: number; contraste: number }
export type CleSimple = keyof Curseurs
export type PartieCommun = Pick<Commun, 'attaque' | 'retombee' | 'vie' | 'profondeur' | 'plancher'>

const borne = (v: number): number => Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0))
const ent = (v: number): number => Math.round(borne(v))

/** Le curseur « vie » n'a que quatre crans (1, 2, 4, 8 temps), répartis sur 0..100. */
export const CRANS_DUREE = [0, 33, 67, 100]
const cran = (v: number): number => Math.round(borne(v) / 100 * 3)
export const MOTS_DUREE = ['un temps : des flashs secs', 'deux temps', 'une mesure (4 temps)', 'deux mesures (8 temps)']

/** Des trois curseurs vers les réglages communs. Douceur : la lumière monte et retombe moins brusquement.
 * Durée : combien de temps vit une pulsation (4 crans). Contraste : creux entre deux flashs (profondeur) et
 * lumière qu'il reste dedans (plancher, l'inverse). */
export function versCommun(c: Curseurs): PartieCommun {
  const douceur = borne(c.douceur), contraste = borne(c.contraste)
  return {
    attaque: ent(douceur * 0.8),
    retombee: ent(15 + douceur * 0.7),
    vie: CRANS_DUREE[cran(c.duree)],
    profondeur: ent(contraste),
    plancher: ent((100 - contraste) * 0.3),
  }
}

/** L'inverse : la position des curseurs d'après des réglages communs existants (éventuellement réglés à la main). */
export function depuisCommun(c: Pick<Commun, 'attaque' | 'retombee' | 'vie' | 'profondeur'>): Curseurs {
  const duAttaque = borne(c.attaque / 0.8), deRetombee = borne((c.retombee - 15) / 0.7)
  return { douceur: ent((duAttaque + deRetombee) / 2), duree: CRANS_DUREE[cran(c.vie ?? 0)], contraste: ent(c.profondeur) }
}

export const MOTS_SIMPLE: Record<CleSimple, (v: number) => string> = {
  douceur: (v) => (v < 15 ? 'sec : la lumière claque' : v < 50 ? 'plutôt vive' : v < 85 ? 'douce' : 'très douce, qui flotte'),
  duree: (v) => MOTS_DUREE[cran(v)],
  contraste: (v) => (v < 10 ? 'aucun : lumière continue' : v < 50 ? 'léger' : v < 90 ? 'marqué' : 'total : on retombe au noir'),
}

const GOUVERNE: Record<CleSimple, (keyof PartieCommun)[]> = { douceur: ['attaque', 'retombee'], duree: ['vie'], contraste: ['profondeur', 'plancher'] }

/** Réglages communs à envoyer quand on touche un curseur : seulement ceux qu'il gouverne (un réglage fin fait à la
 * main sur le reste est respecté). En 3d, douceur et durée ne se voient que si la lumière respire : on enclenche
 * alors un contraste moyen ; `reveil` le dit, pour prévenir. */
export function patchCurseur(commun: Commun, cle: CleSimple, valeur: number, deuxD: boolean): { patch: Partial<PartieCommun>; reveil: boolean } {
  const reveil = !deuxD && cle !== 'contraste' && commun.profondeur === 0
  const calcule = versCommun({ ...depuisCommun(commun), [cle]: valeur, ...(reveil ? { contraste: 70 } : {}) })
  const cles = [...GOUVERNE[cle], ...(reveil ? GOUVERNE.contraste : [])]
  return { patch: Object.fromEntries(cles.map((k) => [k, calcule[k]])) as Partial<PartieCommun>, reveil }
}

// ---------------------------------------------------------------- mode simple / avancé retenu sur l'appareil
export type ModeEcran = 'simple' | 'avance'
export const CLE_MODE = 'neutroncore_lumiere_mode'
type Stockage = Pick<Storage, 'getItem' | 'setItem'>
const stockageDefaut = (): Stockage | null => { try { return localStorage } catch { return null } }

export function lireMode(s: Stockage | null = stockageDefaut()): ModeEcran {
  try { return s?.getItem(CLE_MODE) === 'avance' ? 'avance' : 'simple' } catch { return 'simple' }
}
export function ecrireMode(m: ModeEcran, s: Stockage | null = stockageDefaut()): void {
  try { s?.setItem(CLE_MODE, m) } catch { /* stockage indisponible : le choix vaut pour cette visite seulement */ }
}

// ---------------------------------------------------------------- ligne d'état
export type EntreeEtat = {
  huebeatActif: boolean; silence: boolean; bpm?: number
  canaux: number; manquants: string[]; erreurCanaux?: string
  enDirect: boolean; reelVoulu: boolean; scene?: string; apercu: boolean
}
export type Pastille = { texte: string; ton: 'ok' | 'warn' | 'info' }
export type LigneEtat = { phrase: string; pastilles: Pastille[]; avertissements: Pastille[] }

/** « 7 lampes reliées, son entendu, tempo 108, rien ne joue » + les avertissements éventuels. */
export function ligneEtat(e: EntreeEtat): LigneEtat {
  const lampes: Pastille = e.canaux > 0 ? { texte: `${e.canaux} ${e.canaux > 1 ? 'lampes reliées' : 'lampe reliée'}`, ton: 'ok' } : { texte: 'aucune lampe reliée', ton: 'warn' }
  const son: Pastille = !e.huebeatActif ? { texte: 'son non écouté', ton: 'info' } : e.silence ? { texte: 'silence', ton: 'warn' } : { texte: 'son entendu', ton: 'ok' }
  const tempo: Pastille = !e.huebeatActif ? { texte: 'tempo non suivi', ton: 'info' } : e.bpm ? { texte: `tempo ${Math.round(e.bpm)}`, ton: 'ok' } : { texte: 'tempo pas trouvé', ton: 'warn' }
  const joue: Pastille = e.enDirect ? { texte: e.scene ? `joue « ${e.scene} »` : 'joue en direct', ton: 'ok' } : e.apercu ? { texte: 'aperçu seulement', ton: 'info' } : { texte: 'rien ne joue', ton: 'info' }
  const pastilles = [lampes, son, tempo, joue]
  const avertissements: Pastille[] = []
  if (!e.huebeatActif) avertissements.push({ texte: e.reelVoulu ? 'huebeat est arrêté : les lampes ne reçoivent rien' : 'huebeat est arrêté : le grand bouton le démarre', ton: e.reelVoulu ? 'warn' : 'info' })
  if (e.erreurCanaux) avertissements.push({ texte: e.erreurCanaux, ton: 'warn' })
  if (e.manquants.length) avertissements.push({ texte: `sans place dans le plan : ${e.manquants.join(', ')}`, ton: 'warn' })
  return { phrase: pastilles.map((p) => p.texte).join(', '), pastilles, avertissements }
}
