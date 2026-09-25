import { describe, expect, it } from 'vitest'
import { compileRoutes, matchRoute, mockRequest, MockNotFound } from './router'
import { ROUTES } from './routes'
import { STATUS } from '../components/AgendaParts'

const routes = compileRoutes([
  ['GET', '/launcher/sessions/recent', () => 'recent'],
  ['GET', '/launcher/sessions/:id/messages', ({ params, query }) => `${params.id}:${query.get('limit')}`],
  ['GET', '/launcher/sessions', () => 'list'],
])

describe('matchRoute', () => {
  it('route statique avant paramètre, dans l ordre de déclaration', () => {
    expect(matchRoute(routes, 'GET', '/launcher/sessions/recent')?.handler({ params: {}, query: new URLSearchParams(), body: undefined })).toBe('recent')
  })
  it('extrait les paramètres et décode les segments', () => {
    expect(matchRoute(routes, 'GET', '/launcher/sessions/a%20b/messages')?.params).toEqual({ id: 'a b' })
  })
  it('méthode et longueur doivent correspondre', () => {
    expect(matchRoute(routes, 'POST', '/launcher/sessions')).toBeNull()
    expect(matchRoute(routes, 'GET', '/launcher/sessions/x')).toBeNull()
  })
})

describe('mockRequest', () => {
  it('passe la query string au handler', () => {
    expect(mockRequest(routes, 'GET', '/launcher/sessions/s1/messages?limit=80')).toBe('s1:80')
  })
  it('une action sans route dédiée est simulée', () => {
    expect(mockRequest(routes, 'POST', '/tv/power', { on: true })).toMatchObject({ success: true, demo: true })
  })
  it('une lecture inconnue lève MockNotFound', () => {
    expect(() => mockRequest(routes, 'GET', '/nope')).toThrow(MockNotFound)
  })
})

// Chaque lecture faite par l'interface a une réponse de démo (liste relevée dans src/ le 2026-09-25).
const GETS = [
  '/agenda?start=2026-09-21&end=2026-10-05', '/agenda/rotation', '/arr/calendar', '/arr/incoming', '/arr/movies',
  '/arr/overview', '/arr/series', '/hue/beat/status', '/hue/lights', '/hue/positions', '/hue/scenes',
  '/hue/scenes/s-soir/preview', '/ironman/status', '/launcher', '/launcher/browse?path=/home/user/dev',
  '/launcher/claude-quota', '/launcher/claude-stats', '/launcher/sessions', '/launcher/sessions/notif-settings',
  '/launcher/sessions/recent', '/launcher/sessions/demo-1/messages?limit=80', '/lyra/catalog', '/lyra/settings',
  '/lyra/status', '/projects', '/projects/stats', '/projects/updates', '/qbit/stats', '/qbit/torrents', '/requests',
  '/requests/declined-auto', '/requests/options', '/requests/search?q=metro', '/requests/seasons/1',
  '/requests/watchlist', '/roadmap/projects', '/screens', '/services', '/services/vms', '/subtitles/status',
  '/system/alerts', '/system/backups', '/system/journal?unit=lyra-daemon&lines=40', '/system/resources',
  '/system/timers', '/system/updates', '/tests/catalog', '/tests/runs', '/tests/runs/run-2', '/tracking/sessions',
  '/tv/status', '/auth/token?action=tv_power',
]

describe('routes de démo', () => {
  it.each(GETS)('GET %s répond', (url) => {
    expect(mockRequest(ROUTES, 'GET', url)).toBeTruthy()
  })
  it('la recherche filtre le catalogue de démo', () => {
    const r = mockRequest(ROUTES, 'GET', '/requests/search?q=metro') as { results: { title: string }[] }
    expect(r.results.length).toBeGreaterThan(0)
    expect(r.results.every((x) => x.title.toLowerCase().includes('metro'))).toBe(true)
  })
  it('aucune donnée personnelle dans les réponses', () => {
    const all = JSON.stringify(GETS.map((u) => mockRequest(ROUTES, 'GET', u)))
    expect(all).not.toMatch(/\/home\/(?!user\/)[a-z]+\//)
    expect(all).not.toMatch(/192\.168\.(?!122\.)\d+\.\d+/)
    expect(all).not.toMatch(/amineutron@|gmail|hotmail|tailscale|100\.\d+\.\d+\.\d+/i)
  })
})

describe('cohérence avec les types de l interface', () => {
  // Régression : un statut d'agenda inconnu (« planned ») faisait planter l'écran agenda.
  it('les occurrences d agenda utilisent des statuts et sources connus', () => {
    const r = mockRequest(ROUTES, 'GET', '/agenda?start=a&end=b') as { occurrences: { status: string; source: string }[] }
    for (const o of r.occurrences) {
      expect(Object.keys(STATUS)).toContain(o.status)
      expect(['auto', 'manual']).toContain(o.source)
    }
  })
  // Régression : une date ISO laissait vides les pastilles Borg et Timeshift (l'écran lit « jour date heure »).
  it('les sauvegardes utilisent le format de date systemd', () => {
    const r = mockRequest(ROUTES, 'GET', '/system/backups') as Record<string, { last_run: string | null }>
    for (const unit of ['borg', 'rotation', 'timeshift']) {
      expect(r[unit].last_run).toMatch(/^[A-Z][a-z]{2} \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} /)
    }
  })
})
