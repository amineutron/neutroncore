// Demandes et tâches de fond de démo.
import type { MockHandler } from '../router'
import { isoAgo } from './time'

const CATALOG = [
  { tmdb_id: 19, kind: 'movie', title: 'Metropolis', year: '1927', overview: 'Dans une cité futuriste, un fils d’industriel découvre la ville basse.', poster: '', already_available: true },
  { tmdb_id: 3082, kind: 'movie', title: 'Modern Times', year: '1936', overview: 'Charlot face aux cadences de l’usine.', poster: '', already_available: false },
  { tmdb_id: 901, kind: 'movie', title: 'City Lights', year: '1931', overview: 'Un vagabond, une fleuriste aveugle, un millionnaire.', poster: '', already_available: false },
  { tmdb_id: 36, kind: 'tv', title: 'Metropolis Stories', year: '1960', overview: 'Anthologie de science-fiction (fictive, pour la démo).', poster: '', already_available: false },
  { tmdb_id: 4, kind: 'tv', title: 'Flash Gordon', year: '1954', overview: 'Aventures spatiales en noir et blanc.', poster: '', already_available: true },
]

const session = (id: string, name: string, template: string, status: string, processed: number, total: number, unit: string,
  minutesAgo: number, extra: Record<string, string>, logs: string[] = []) => ({
  id, name, template, status, processed, total, unit, items: [], extra, history: [], pid: null, pid_starttime: null,
  created_at: isoAgo(minutesAgo), updated_at: isoAgo(1), finished_at: status === 'done' ? isoAgo(2) : null,
  logs: logs.map((message, i) => ({ timestamp: isoAgo(minutesAgo - i * 3), message })),
})

export const requests: [string, string, MockHandler][] = [
  ['GET', '/requests', () => ({ requests: [
    { id: 41, title: 'Modern Times', status: 'pending', media_status: 'pending', kind: 'movie', created_at: isoAgo(180) },
  ], total: 1 })],
  ['GET', '/requests/declined-auto', () => ({ declined: [
    { request_id: 12, title: 'Häxan', kind: 'movie', reason: 'aucune release trouvée après 14 jours', declined_at: isoAgo(5 * 1440) },
  ], stalled_watching: 1, available: true })],
  ['GET', '/requests/options', () => ({
    movie_profiles: [{ id: 1, name: 'HD-1080p' }, { id: 2, name: 'Ultra-HD' }],
    tv_profiles: [{ id: 1, name: 'HD-1080p' }], languages: ['Français', 'Anglais', 'VOSTFR'],
  })],
  ['GET', '/requests/watchlist', () => ({ items: [{
    id: 'w1', tmdb_id: 3082, kind: 'movie', title: 'Modern Times', quality: 'HD-1080p', language: 'Français',
    current: { present: false, quality: '', languages: [] }, mismatch: false,
  }] })],
  ['GET', '/requests/search', ({ query }) => {
    const q = (query.get('q') ?? '').toLowerCase()
    return { results: CATALOG.filter((c) => c.title.toLowerCase().includes(q)) }
  }],
  ['GET', '/requests/seasons/:id', () => ({ seasons: [{ number: 1, episodes: 39, name: 'Saison 1' }] })],
  ['GET', '/tracking/sessions', () => [
    session('d1', 'fedora-workstation-43-x86_64.iso', 'download', 'running', 1656, 2300, ' Mo', 6,
      { speed: '8.1 MB/s', eta: '1 min', seeds: '214', phase: 'download' }, ['démarré', 'métadonnées reçues']),
    session('d2', 'Flash Gordon S01E21', 'series_episode', 'running', 120, 380, ' Mo', 12,
      { speed: '2.4 MB/s', eta: '2 min', group: 'Flash Gordon' }),
    session('d3', 'Flash Gordon S01E22', 'series_episode', 'running', 40, 380, ' Mo', 12,
      { speed: '1.1 MB/s', eta: '5 min', group: 'Flash Gordon' }),
    session('c1', 'Metropolis — conversion Dolby Vision', 'movie', 'running', 4, 6, ' étapes', 25,
      { profile: '8.1', step: 'remux' }, ['extraction RPU', 'conversion profil 8.1', 'remux en cours']),
    session('l1', 'Lyra — transcription de réunion', 'lyra_task', 'done', 3, 3, ' phases', 50, {}, ['STT', 'résumé', 'terminé']),
  ].map((s) => (s.extra.group ? { ...s, group: s.extra.group } : s))],
]
