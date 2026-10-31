// Minuteurs : logique pure (affichage du compte à rebours, évènements à annoncer, filtres retenus).
// Le serveur calcule `restant_s` à l'instant `maintenant` ; l'écran décompte localement entre deux relevés
// en corrigeant le décalage d'horloge (`offset`), puis se recale au relevé suivant.

export type Notif = { centre: boolean; navigateur: boolean; ntfy: boolean; sonnerie: boolean }
export type Pomodoro = { travail_min: number; pause_min: number; longue_min: number; cycles: number; cycle?: number; phase?: 'travail' | 'pause' | 'longue' }
export type Minuteur = {
  id: string; nom: string; type: 'minuteur' | 'pomodoro'; etat: 'actif' | 'pause' | 'fini'
  duree_s: number; fin: number; restant_s: number; progression: number; cree: number
  notif: Notif; sonnerie: string; pomodoro: Pomodoro | null
}
export type Evenement = { n: number; timer: string; nom: string; kind: 'fin' | 'phase'; message: string; at: number; rattrape: boolean; notif: Notif }
export type Reglages = { notif: Notif; sonnerie: string; sortie: string; duree_sonnerie_s: number; pomodoro: Pomodoro }
export type Etat = {
  maintenant: number; minuteurs: Minuteur[]; evenements: Evenement[]; seq: number; reglages: Reglages
  sonnerie_en_cours: { titre?: string } | null
}

/** 3725 -> « 1:02:05 », 65 -> « 01:05 », arrondi vers le haut (un minuteur à 0,4 s affiche 00:01). */
export function compteARebours(secondes: number): string {
  const s = Math.max(0, Math.ceil(secondes))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`
}

/** « 25 min », « 1 h 30 », « 45 s » : durée parlée, pour les titres et les puces. */
export function dureeParlee(secondes: number): string {
  const s = Math.round(secondes)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
  if (m > 0) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`
  return `${s} s`
}

/** Restant affiché maintenant : état du relevé + temps écoulé sur CETTE horloge, sans dépendre de l'heure du serveur. */
export function restantMaintenant(t: Pick<Minuteur, 'etat' | 'restant_s'>, relevéA: number, maintenantMs: number): number {
  if (t.etat !== 'actif') return t.restant_s
  return Math.max(0, t.restant_s - (maintenantMs - relevéA) / 1000)
}

export function phaseParlee(t: Minuteur): string {
  const p = t.pomodoro
  if (!p) return ''
  if (p.phase === 'pause') return `pause · cycle ${p.cycle}/${p.cycles}`
  if (p.phase === 'longue') return 'longue pause'
  return `travail · cycle ${p.cycle}/${p.cycles}`
}

/** Le minuteur actif qui finit le plus tôt (puce du hub). */
export function plusProche(liste: Minuteur[]): Minuteur | null {
  const actifs = liste.filter((t) => t.etat === 'actif')
  return actifs.length ? actifs.reduce((a, b) => (b.restant_s < a.restant_s ? b : a)) : null
}

/** Évènements que cet écran n'a pas encore annoncés. Premier relevé (dernier vu inconnu) : aucun, pour ne pas
 *  rejouer le passé à chaque ouverture ; l'appelant mémorise `seq`. */
export function aAnnoncer(evenements: Evenement[], dernierVu: number | null): Evenement[] {
  if (dernierVu === null) return []
  return evenements.filter((e) => e.n > dernierVu)
}

/** Le minuteur affiché en grand : celui que l'utilisateur a touché s'il existe encore, sinon le plus proche de la fin
 *  parmi les actifs, puis un en pause, puis un terminé. Liste vide = null. */
export function choisirPrincipal(liste: Minuteur[], choisi: string | null): Minuteur | null {
  const voulu = choisi ? liste.find((t) => t.id === choisi) : undefined
  if (voulu) return voulu
  return plusProche(liste) ?? liste.find((t) => t.etat === 'pause') ?? liste.find((t) => t.etat === 'fini') ?? null
}

/** Part écoulée (0 à 1) d'un minuteur au restant donné, bornée. */
export function partEcoulee(t: Pick<Minuteur, 'etat' | 'duree_s'>, reste: number): number {
  if (t.etat === 'fini') return 1
  if (!t.duree_s) return 0
  return Math.min(1, Math.max(0, 1 - reste / t.duree_s))
}

/** Durées proposées en un geste. */
export const PRESETS: { label: string; secondes: number }[] = [
  { label: '1 min', secondes: 60 }, { label: '5 min', secondes: 300 }, { label: '10 min', secondes: 600 },
  { label: '15 min', secondes: 900 }, { label: '30 min', secondes: 1800 }, { label: '1 h', secondes: 3600 },
]

/** Saisie « 10 », « 10 min », « 1h30 », « 90s » -> secondes, ou null (miroir simple de lib/minuteurs.lire_phrase). */
export function lireDuree(saisie: string): number | null {
  const t = saisie.trim().toLowerCase().replace(',', '.')
  if (!t) return null
  const hm = t.match(/^(\d{1,2})\s*h\s*(\d{1,2})$/)
  if (hm) return Number(hm[1]) * 3600 + Number(hm[2]) * 60
  if (/^\d+$/.test(t)) return Number(t) > 0 ? Number(t) * 60 : null
  let total = 0
  let reste = t
  const re = /(\d+(?:\.\d+)?)\s*(heures?|h|minutes?|mins?|mn|secondes?|secs?|s)\b/g
  for (const m of t.matchAll(re)) {
    total += Number(m[1]) * (m[2].startsWith('h') ? 3600 : m[2].startsWith('m') ? 60 : 1)
    reste = reste.replace(m[0], '')
  }
  return total > 0 && !reste.trim() ? Math.round(total) : null
}

// ---- réglages d'affichage retenus -------------------------------------------------

export type Filtres = { onglet: 'minuteurs' | 'notes'; finis: boolean; type: 'tous' | 'minuteur' | 'pomodoro' }
const CLE = 'neutroncore_minuteurs_filtres'
export const FILTRES_DEFAUT: Filtres = { onglet: 'minuteurs', finis: true, type: 'tous' }

export function lireFiltres(brut: string | null): Filtres {
  try {
    const d = JSON.parse(brut ?? '{}') as Partial<Filtres>
    return {
      onglet: d.onglet === 'notes' ? 'notes' : 'minuteurs',
      finis: typeof d.finis === 'boolean' ? d.finis : true,
      type: d.type === 'minuteur' || d.type === 'pomodoro' ? d.type : 'tous',
    }
  } catch {
    return FILTRES_DEFAUT
  }
}

export function chargerFiltres(): Filtres {
  try { return lireFiltres(localStorage.getItem(CLE)) } catch { return FILTRES_DEFAUT }
}

export function sauverFiltres(f: Filtres): void {
  try { localStorage.setItem(CLE, JSON.stringify(f)) } catch { /* stockage indisponible */ }
}

export function filtrer(liste: Minuteur[], f: Filtres): Minuteur[] {
  return liste.filter((t) => (f.finis || t.etat !== 'fini') && (f.type === 'tous' || t.type === f.type))
}

/** Clé sessionStorage : la palette ouvre l'écran directement sur la saisie d'une note. */
export const CLE_NOTE_RAPIDE = 'neutroncore_note_rapide'
