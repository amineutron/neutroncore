// Lanceur et sessions Claude Code de démo (chemins génériques /home/user).
import type { MockHandler } from '../router'
import { isoAgo, isoIn, nowMs } from './time'

const DEV = '/home/user/dev'
const liveSession = (sessionId: string, name: string, repo: string, status: string, minutesAgo: number, extra: Record<string, unknown>) => ({
  sessionId, pid: 0, name, cwd: `${DEV}/${repo}`, repo, status, startedAt: nowMs() - minutesAgo * 60_000, updatedAt: nowMs() - 60_000,
  controllable: false, meta: {}, waiting: false, wait_message: '', stopped_at: null, age_s: minutesAgo * 60, pending: null,
  last_user: '', last_claude: '', last_at: isoAgo(1), user_turns: 3, state: '', close_ready: false, ...extra,
})

const MESSAGES = [
  { who: 'me', text: 'Ajoute un mode démo à l’app, avec des données fictives.', at: isoAgo(14), tools: [] },
  { who: 'claude', text: 'Je commence par un routeur fictif testé, puis les données par domaine.', at: isoAgo(13), tools: ['Read', 'Write'] },
  { who: 'claude', text: 'Tests verts : chaque écran a ses données de démo, et rien de réel n’est publié.', at: isoAgo(2), tools: ['Bash'] },
]

export const launcher: [string, string, MockHandler][] = [
  ['GET', '/launcher', () => ({
    favorites: ['lyra', 'neutroncore', 'mcp-tracking', 'fedora-agents'].map((n) => ({ name: n, path: `${DEV}/${n}`, exists: true })),
    folders: [DEV, '/home/user/Documents'], terminal: 'kitty',
  })],
  ['GET', '/launcher/browse', ({ query }) => {
    const path = query.get('path') || DEV
    return { path, parent: path.split('/').slice(0, -1).join('/') || '/', is_git: false,
      dirs: ['lyra', 'neutroncore', 'mcp-tracking', 'fedora-agents', 'notes'].map((n) => ({ name: n, path: `${path}/${n}`, is_git: n !== 'notes' })) }
  }],
  ['GET', '/launcher/sessions', () => ({ sessions: [
    liveSession('demo-1', 'mode démo', 'neutroncore', 'busy', 25, { last_user: 'Ajoute un mode démo', last_claude: 'Tests verts', meta: { color: '#f6c177' } }),
    liveSession('demo-2', 'audit MCP', 'lyra', 'idle', 90, { waiting: true, wait_message: 'Claude attend ta réponse', last_claude: 'Je lance la suite de tests ?' }),
  ], waiting: 1 })],
  ['GET', '/launcher/sessions/recent', () => ({ sessions: [
    { sessionId: 'old-1', cwd: `${DEV}/mcp-tracking`, repo: 'mcp-tracking', title: 'jeton local de l’API', last_user: 'on publie ?',
      last_claude: 'Release prête.', updatedAt: nowMs() - 26 * 3_600_000, meta: {} },
  ] })],
  ['GET', '/launcher/sessions/:id/messages', () => ({ messages: MESSAGES, offset: MESSAGES.length, truncated: false })],
  ['GET', '/launcher/sessions/notif-settings', () => ({
    settings: { enabled: true, accent: 'session', label: '{repo} · {name}', position: 'top-right', style: 'capsule', open_ms: 400,
      duration_ms: 6000, on_stop: true, phone_enabled: false, phone_priority: 3, phone_on_stop: false, phone_quiet: '23:00-07:00' },
    positions: ['top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left'],
    styles: ['capsule', 'card', 'minimal', 'glow', 'mascot'],
    phone: { server: '', topic: '', configured: false },
  })],
  ['GET', '/launcher/claude-quota', () => ({ available: true,
    five_hour: { utilization: 22, resets_at: isoIn(160) }, seven_day: { utilization: 35, resets_at: isoIn(3 * 1440) } })],
  ['GET', '/launcher/claude-stats', () => ({
    days: 7, sessions: 18, projects: 4,
    models: [{ model: 'claude-opus', messages: 1400, output_tokens: 9_200_000 }, { model: 'claude-sonnet', messages: 600, output_tokens: 2_100_000 }],
    total_output_tokens: 11_300_000,
    consumption: { all_time: [{ model: 'claude-opus', output_tokens: 9_200_000, input_tokens: 800_000, cache_read: 120_000_000 }],
      daily: Array.from({ length: 7 }, (_, i) => ({ date: isoAgo((6 - i) * 1440).slice(0, 10), models: { 'claude-opus': 900_000 + i * 120_000 } })),
      total_sessions_all_time: 142 },
    quota_note: 'données de démo',
  })],
]
