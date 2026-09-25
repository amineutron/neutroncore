// Médias de démo : films du domaine public, téléchargements = images ISO Linux.
import type { MockHandler } from '../router'
import { isoAgo, isoIn } from './time'

const GB = 1024 ** 3
const movie = (id: number, title: string, year: number, quality: string, sizeGb: number, days: number, hasFile = true) => ({
  id, title, year, monitored: true, has_file: hasFile, quality: hasFile ? quality : '', size: hasFile ? Math.round(sizeGb * GB) : 0,
  added: isoAgo(days * 1440), status: 'released', tmdb_id: 1000 + id, poster: '',
})
const MOVIES = [
  movie(1, 'Metropolis', 1927, 'Bluray-1080p', 9.8, 1), movie(2, 'Nosferatu', 1922, 'Bluray-1080p', 7.2, 2),
  movie(3, 'The General', 1926, 'Bluray-1080p', 6.1, 4), movie(4, 'Night of the Living Dead', 1968, 'Bluray-2160p', 21.4, 6),
  movie(5, 'His Girl Friday', 1940, 'Bluray-1080p', 8.3, 9), movie(6, 'Charade', 1963, 'Bluray-1080p', 10.2, 12),
  movie(7, 'Le Voyage dans la Lune', 1902, 'WEBDL-1080p', 0.6, 15), movie(8, 'The Kid', 1921, 'Bluray-1080p', 4.9, 18),
  movie(9, 'Sherlock Jr.', 1924, 'Bluray-1080p', 3.8, 21), movie(10, 'Plan 9 from Outer Space', 1957, '', 0, 2, false),
]
const series = (id: number, title: string, year: number, have: number, total: number, sizeGb: number, days: number, status = 'ended') => ({
  id, title, year, monitored: true, status, episode_count: total, episode_file_count: have, size: Math.round(sizeGb * GB),
  added: isoAgo(days * 1440), tvdb_id: 2000 + id, poster: '',
})
const SERIES = [
  series(1, 'The Twilight Zone', 1959, 156, 156, 180, 3), series(2, 'Flash Gordon', 1954, 20, 39, 22, 1),
  series(3, 'The Lone Ranger', 1949, 221, 221, 96, 30), series(4, 'Sherlock Holmes', 1954, 39, 39, 31, 45),
]

export const media: [string, string, MockHandler][] = [
  ['GET', '/arr/overview', () => ({
    movie_count: 48, series_count: 12, missing_movies: 1,
    recent_movies: MOVIES.slice(0, 8), recent_series: SERIES,
    disks: [{ path: '/', free: 212 * GB, total: 931 * GB }, { path: '/data', free: 1310 * GB, total: 3726 * GB }],
  })],
  ['GET', '/arr/movies', () => ({ movies: MOVIES })],
  ['GET', '/arr/series', () => ({ series: SERIES })],
  ['GET', '/arr/calendar', () => ({ events: [
    { kind: 'episode', title: 'Flash Gordon', date: isoIn(26 * 60), detail: 'S01E21 — The Forbidden Planet', has_file: false },
    { kind: 'episode', title: 'Flash Gordon', date: isoIn(4 * 1440), detail: 'S01E22 — The Brain Machine', has_file: false },
    { kind: 'movie', title: 'Plan 9 from Outer Space', date: isoIn(6 * 1440), detail: 'sortie film', has_file: false },
  ] })],
  ['GET', '/arr/incoming', () => ({
    movies: [{ id: 10, kind: 'movie', title: 'Plan 9 from Outer Space', year: 1957, release: 'released', state: 'downloading',
      queue: { count: 1, progress: 64, downloading: 1, queued: 0, import_pending: 0, import_blocked: 0, warnings: [] } }],
    series: [{ id: 2, kind: 'tv', title: 'Flash Gordon', year: 1954, have: 20, total: 39, state: 'downloading',
      queue: { count: 3, progress: 41, downloading: 2, queued: 1, import_pending: 0, import_blocked: 0, warnings: [] } }],
  })],
  ['GET', '/qbit/stats', () => ({ dl_speed: 11_800_000, dl_speed_fmt: '11.3 MB/s', ul_speed: 640_000, ul_speed_fmt: '625 KB/s',
    dl_total: 412 * GB, ul_total: 97 * GB, connection_status: 'connected' })],
  ['GET', '/qbit/torrents', () => {
    const t = (hash: string, name: string, state: string, progress: number, size: string, dl: string, eta: string, seeds: number) =>
      ({ hash, name, state, progress, size: 0, size_fmt: size, dl_speed: 0, dl_speed_fmt: dl, ul_speed: 0, ul_speed_fmt: '0 B/s',
        eta: 0, eta_fmt: eta, num_seeds: seeds, num_leechs: 3 })
    const torrents = [
      t('a1', 'fedora-workstation-43-x86_64.iso', 'downloading', 72, '2.3 GB', '8.1 MB/s', '1 min', 214),
      t('a2', 'debian-13.1.0-amd64-netinst.iso', 'downloading', 38, '754 MB', '3.2 MB/s', '2 min', 88),
      t('a3', 'ubuntu-24.04.3-desktop-amd64.iso', 'uploading', 100, '6.0 GB', '0 B/s', '∞', 512),
      t('a4', 'archlinux-2026.09.01-x86_64.iso', 'stalledDL', 12, '1.2 GB', '0 B/s', '∞', 0),
    ]
    return { torrents, count: torrents.length }
  }],
  ['GET', '/subtitles/status', () => ({
    bazarr_ok: true,
    wanted_episodes: [{ series: 'Flash Gordon', episode: '1x12', title: 'The Frozen Men' }, { series: 'Flash Gordon', episode: '1x13', title: 'Deadline at Noon' }],
    wanted_episodes_total: 2, wanted_movies: [{ title: 'Charade' }], wanted_movies_total: 1,
    ai: { active: [{ title: 'Charade', type: 'movie', created: isoAgo(3 * 1440), last_search: isoAgo(90) }],
      active_total: 1, replaced_total: 6, budget_spent: 0.4, budget_total: 5, budget_date: isoAgo(3 * 1440).slice(0, 10) },
  })],
]
