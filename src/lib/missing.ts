// Manquants (films & séries) : regroupement des épisodes par série pour
// proposer une seule relance par série plutôt qu'une ligne par épisode.

export type MissingMovie = { id: number; title: string; year: number; status: string }
export type MissingEpisode = { series_id: number | null; series: string; detail: string; title: string; air_date: string }
export type MissingSeries = { id: number | null; title: string; episodes: MissingEpisode[]; range: string }

// « S04E07 → S04E08 » ; un seul épisode : son code seul
function rangeOf(episodes: MissingEpisode[]): string {
  const codes = episodes.map((e) => e.detail).sort()
  return codes.length > 1 ? `${codes[0]} → ${codes[codes.length - 1]}` : codes[0] ?? ''
}

export function groupBySeries(episodes: MissingEpisode[]): MissingSeries[] {
  const groups = new Map<string, MissingEpisode[]>()
  for (const e of episodes) {
    const key = e.series_id != null ? `id:${e.series_id}` : `t:${e.series}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  return [...groups.values()]
    .map((eps) => ({ id: eps[0].series_id, title: eps[0].series || 'série inconnue', episodes: eps, range: rangeOf(eps) }))
    .sort((a, b) => b.episodes.length - a.episodes.length || a.title.localeCompare(b.title))
}

// un film pas encore sorti n'est pas « en retard » : inutile de relancer une recherche
const NOT_OUT = new Set(['announced', 'inCinemas', 'tba'])
export function isReleased(m: MissingMovie): boolean {
  return !NOT_OUT.has(m.status)
}

export function releaseLabel(status: string): string {
  if (status === 'announced' || status === 'tba') return 'annoncé'
  if (status === 'inCinemas') return 'au cinéma'
  return 'sorti'
}
