// Rappels de l'agenda : par quoi on est prévenu (logique pure, testée).
// Le planificateur et la sonnerie sont côté API (routers/rappels.py).

export type Moyen = 'app' | 'telephone' | 'tele' | 'sonnerie'

export type Rappel = {
  minutes_avant: number
  moyens: Moyen[]
  sonnerie: string
  sortie: string          // 'tele', 'defaut' ou le nom d'une sortie son du PC
  duree_min: number
  progressif: boolean
  volume: number | null    // son de la télé (l'ampli en ARC) pendant la sonnerie ; null = inchangé
  volume_sortie: number | null   // volume (%) de la sortie son du PC pendant la sonnerie ; null = inchangé
}

export type Sonnerie = { id: string; nom: string; categorie: string; origine: 'systeme' | 'neutroncore' | 'perso' }
export type Sortie = { id: string; nom: string; tele: boolean; present: boolean; volume?: number | null; muet?: boolean }
export type EnCours = { type: 'rappel' | 'ecoute'; titre: string; occ?: string; depuis: number; sortie: string } | null
export type RappelsEtat = {
  sonneries: Sonnerie[]
  sorties: Sortie[]
  en_cours: EnCours
  prochains: { occ: string; titre: string; debut: string; at: string; moyens: Moyen[]; verif: { at: number; problemes: string[] } | null }[]
  derniers: { occ: string; titre: string; at: number; resultats: Record<string, string> }[]
}

export const MOYENS: { id: Moyen; label: string }[] = [
  { id: 'app', label: 'notification dans l’app' },
  { id: 'telephone', label: 'notification sur le téléphone' },
  { id: 'tele', label: 'allumer la télé sur le PC' },
  { id: 'sonnerie', label: 'sonnerie' },
]
const COURT: Record<string, string> = { app: 'app', telephone: 'téléphone', tele: 'télé', sonnerie: 'sonnerie', volume: 'volume', 'volume sortie': 'volume de la sortie' }

export const AVANT = [0, 5, 10, 15, 30, 60, 120, 1440]
export const DUREES = [1, 2, 5, 10, 15, 30]
export const VOLUMES_SORTIE = [30, 40, 50, 60, 70, 80, 90, 100]
export const VOLUMES = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]   // plafond de l'ampli côté API : 60
export const NAVIGATEUR = 'navigateur'      // pré-écoute seulement : l'appareil qui affiche l'app

export function rappelVide(): Rappel {
  return { minutes_avant: 0, moyens: [], sonnerie: 'classique', sortie: 'tele', duree_min: 5, progressif: true, volume: null, volume_sortie: null }
}

export function avantLibelle(min: number): string {
  if (min === 0) return 'à l’heure'
  if (min % 1440 === 0) return `${min / 1440} jour${min > 1440 ? 's' : ''} avant`
  if (min % 60 === 0) return `${min / 60} h avant`
  return `${min} min avant`
}

/** Coche ou décoche un moyen. Cocher la télé fait sonner sur la télé (c'est l'esprit du réveil) ;
 *  la décocher remet la sonnerie sur la sortie par défaut si elle y était. */
export function basculerMoyen(r: Rappel, m: Moyen, on: boolean): Rappel {
  const moyens = MOYENS.map((x) => x.id).filter((id) => (id === m ? on : r.moyens.includes(id)))
  let sortie = r.sortie
  if (m === 'tele' && on && r.sortie === 'defaut') sortie = 'tele'
  if (m === 'tele' && !on && r.sortie === 'tele') sortie = 'defaut'
  return { ...r, moyens, sortie }
}

/** Ce qu'on envoie à l'API : null quand aucun moyen n'est coché. */
export function versApi(r: Rappel | null): Rappel | null {
  return r && r.moyens.length ? r : null
}

/** Puce de l'occurrence : « 10 min avant · télé + sonnerie ». */
export function resume(r: Rappel | null | undefined): string {
  if (!r || !r.moyens?.length) return ''
  return `${avantLibelle(r.minutes_avant)} · ${r.moyens.map((m) => COURT[m] ?? m).join(' + ')}`
}

/** Libellé d'un résultat de rappel donné (« télé injoignable », « ok »). */
export function resultatsTexte(res: Record<string, string>): string {
  return Object.entries(res).map(([m, v]) => `${COURT[m] ?? m} : ${v}`).join(' · ')
}

const ORDRE_CATEGORIES = ['douces', 'mélodies', 'classiques', 'énergiques']
export const MES_SONS = 'mes sons'

/** Catégories de la banque dans un ordre fixe, puis les autres ; « mes sons » toujours en dernier
 *  (même vide : c'est là qu'on importe). */
export function categoriesBanque(sonneries: Sonnerie[]): string[] {
  const vues = new Set(sonneries.map((s) => s.categorie))
  const autres = [...vues].filter((c) => !ORDRE_CATEGORIES.includes(c) && c !== MES_SONS).sort()
  return [...ORDRE_CATEGORIES.filter((c) => vues.has(c)), ...autres, MES_SONS]
}

export function filtrerBanque(sonneries: Sonnerie[], categorie: string): Sonnerie[] {
  return categorie === 'toutes' ? sonneries : sonneries.filter((s) => s.categorie === categorie)
}
