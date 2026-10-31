// Sorties (épisodes Sonarr, films Radarr) dans l'agenda : réglages, filtre mémorisé, libellés.

export const SORTIES_CATEGORY = 'sorties'
export const SORTIES_KEY = 'neutroncore_agenda_sorties' // guard:allow cle localStorage

export type SortiesSettings = {
  series: boolean; films: boolean; cinema: boolean; numerique: boolean; physique: boolean
  non_surveilles: boolean; rappel_ntfy: boolean; rappel_heure: number
}
export type SortiesSettingsResp = { settings: SortiesSettings; ntfy_configure: boolean }

export const SORTIES_DEFAULTS: SortiesSettings = {
  series: true, films: true, cinema: true, numerique: true, physique: true,
  non_surveilles: false, rappel_ntfy: false, rappel_heure: 9,
}

export const TOGGLES: { key: keyof Omit<SortiesSettings, 'rappel_heure'>; label: string; group: 'quoi' | 'films' | 'autre' }[] = [
  { key: 'series', label: 'épisodes de séries', group: 'quoi' },
  { key: 'films', label: 'films', group: 'quoi' },
  { key: 'cinema', label: 'sortie en salle', group: 'films' },
  { key: 'numerique', label: 'sortie numérique', group: 'films' },
  { key: 'physique', label: 'sortie disque', group: 'films' },
  { key: 'non_surveilles', label: 'aussi ce qui n\'est pas surveillé', group: 'autre' },
]

/** Le filtre « sorties » de l'agenda est désactivé tant que l'utilisateur ne l'a pas allumé. */
export function loadSortiesOn(): boolean {
  try { return localStorage.getItem(SORTIES_KEY) === '1' } catch { return false }
}

export function saveSortiesOn(on: boolean): void {
  try { localStorage.setItem(SORTIES_KEY, on ? '1' : '0') } catch { /* stockage indisponible */ }
}

/** Retire les sorties de la liste quand le filtre est coupé (les autres catégories ne bougent pas). */
export function applySortiesFilter<T extends { category: string }>(occs: T[], on: boolean): T[] {
  return on ? occs : occs.filter((o) => o.category !== SORTIES_CATEGORY)
}

/** Heure à afficher : rien pour une sortie « toute la journée » (films : seule la date est connue). */
export function timeLabel(o: { start: string; all_day?: boolean }): string {
  return o.all_day ? '' : o.start.slice(11, 16)
}
