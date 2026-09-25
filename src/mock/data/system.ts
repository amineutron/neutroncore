// Système de démo : services, VM, ressources, sauvegardes, timers, tests, agenda.
import type { MockHandler } from '../router'
import { dayAt, isoAgo, localStamp, systemdAgo, unixAgo, unixIn } from './time'

const GB = 1024 ** 3
const svc = (name: string, display: string, status = 'up', type = 'http') => ({ name, display_name: display, status, type, url: null, extra: {} })

function agendaOccurrences() {
  const occ = []
  for (let d = -4; d <= 7; d++) {
    const start = dayAt(d, 3)
    const past = d < 0 || (d === 0 && new Date().getHours() >= 4)
    occ.push({
      id: `auto-timeshift@${localStamp(start)}`, event_id: 'auto-timeshift', source: 'auto', title: 'snapshot timeshift',
      category: 'sauvegardes', start: localStamp(start), end: localStamp(dayAt(d, 3, 30)), recurrence: 'daily',
      event_start: '2026-01-01T03:00', duration_min: 30, description: 'Snapshot système Timeshift', notify: false,
      unit: 'timeshift-backup.service', log: 'timeshift-backup.service', status: past ? 'done' : 'upcoming',
      run: past ? { time: localStamp(dayAt(d, 3, 2)), result: 'done', started: localStamp(dayAt(d, 3, 1)), duration_s: 74 } : null,
      can_retry: false, can_dismiss: false, can_restore: false,
    })
  }
  occ.push({
    id: 'evt-demo@1', event_id: 'evt-demo', source: 'manual', title: 'mise à jour du NAS', category: 'maintenance',
    start: localStamp(dayAt(2, 20)), end: localStamp(dayAt(2, 21)), recurrence: 'none', event_start: localStamp(dayAt(2, 20)),
    duration_min: 60, description: 'Redémarrage prévu après les mises à jour.', notify: true, unit: '', log: '',
    status: 'upcoming', run: null, can_retry: false, can_dismiss: true, can_restore: false,
  })
  return occ
}

const RUNS = [
  { id: 'run-1', kind: 'smoke', targets: ['all'], status: 'ok', rc: 0, started: unixAgo(95), ended: unixAgo(94),
    summary: [{ label: 'serveurs MCP', value: '7/7', tone: 'ok' }], output: 'smoke MCP : 7 serveurs répondent à tools/list' },
  { id: 'run-2', kind: 'pytest', targets: ['lyra'], status: 'fail', rc: 1, started: unixAgo(300), ended: unixAgo(297),
    summary: [{ label: 'réussis', value: '981', tone: 'ok' }, { label: 'échecs', value: '1', tone: 'crit' }],
    output: 'FAILED tests/test_demo.py::test_exemple - AssertionError (données de démo)' },
]

export const system: [string, string, MockHandler][] = [
  ['GET', '/services', () => ({ services: [
    svc('lyra', 'Lyra', 'up', 'process'), svc('tracking', 'MCP Tracking'), svc('plex', 'Plex'), svc('radarr', 'Radarr'),
    svc('sonarr', 'Sonarr'), svc('qbittorrent', 'qBittorrent'), svc('bazarr', 'Bazarr'), svc('ollama', 'Ollama', 'down'),
  ] })],
  ['GET', '/services/vms', () => ({ vms: [
    { name: 'vm_fedora-test', display_name: 'VM: fedora-test', status: 'up', type: 'vm', url: null, extra: { vm_state: 'actif' } },
    { name: 'vm_debian-lab', display_name: 'VM: debian-lab', status: 'down', type: 'vm', url: null, extra: { vm_state: 'arrêtée' } },
    { name: 'vm_win-sandbox', display_name: 'VM: win-sandbox', status: 'down', type: 'vm', url: null, extra: { vm_state: 'arrêtée' } },
  ], fetched_at: isoAgo(0).slice(0, 19), stale: false, error: null })],
  ['GET', '/system/resources', () => ({
    cpu_pct: 18.4, ram: { total: 64 * GB, available: 38 * GB, used: 26 * GB },
    gpu: { vram_used: 4.2 * GB, vram_total: 12 * GB, utilization: 23, temperature: 51 },
    disks: [{ path: '/', total: 931 * GB, free: 212 * GB, used_pct: 77.2 }, { path: '/data', total: 3726 * GB, free: 1310 * GB, used_pct: 64.8 },
      { path: '/backups', total: 1863 * GB, free: 944 * GB, used_pct: 49.3 }],
  })],
  ['GET', '/system/alerts', () => ({ alerts: [
    { level: 'warn', title: 'Ollama arrêté', detail: 'Le service LLM local ne répond pas (données de démo).', action: 'outils' },
  ] })],
  ['GET', '/system/backups', () => ({
    borg: { state: 'ok', last_run: systemdAgo(3 * 1440), result: 'success', exit_status: '0' },
    rotation: { state: 'ok', last_run: systemdAgo(9 * 1440), result: 'success', exit_status: '0', age_days: 9 },
    timeshift: { state: 'ok', last_run: systemdAgo(10 * 60), result: 'success', exit_status: '0' },
  })],
  ['GET', '/system/timers', () => ({ timers: [
    { unit: 'timeshift-backup.timer', activates: 'timeshift-backup.service', next: unixIn(14 * 60), last: unixAgo(10 * 60) },
    { unit: 'borg-backup.timer', activates: 'borg-backup.service', next: unixIn(4 * 1440), last: unixAgo(3 * 1440) },
    { unit: 'download-guard.timer', activates: 'download-guard.service', next: unixIn(3), last: unixAgo(2) },
  ], failed_units: [] })],
  ['GET', '/system/updates', () => ({ status: 'ok', checked_at: unixAgo(120), risky_count: 1, updates: [
    { name: 'kernel', version: '6.18.14-200.fc43', risky: true }, { name: 'firefox', version: '145.0-1.fc43', risky: false },
    { name: 'python3', version: '3.14.1-1.fc43', risky: false },
  ] })],
  ['GET', '/system/journal', ({ query }) => ({ unit: query.get('unit') ?? '', error: '', lines: [
    `${isoAgo(9).slice(11, 19)} démarrage du service (démo)`, `${isoAgo(8).slice(11, 19)} 19 outils MCP chargés`,
    `${isoAgo(1).slice(11, 19)} requête traitée en 42 ms`,
  ] })],
  ['GET', '/screens', () => ({ monitors: [
    { name: 'DP-1', width: 2560, height: 1440, x: 0, y: 0, scale: 1, dpms: true },
    { name: 'HDMI-A-1', width: 1920, height: 1080, x: 2560, y: 0, scale: 1, dpms: true },
  ], tv_ok: true, ambilight: { on: true, style: 'FOLLOW_VIDEO' }, ambihue: false })],
  ['GET', '/tests/catalog', () => ({ kinds: [
    { kind: 'smoke', label: 'smoke MCP', desc: 'spawn + initialize + tools/list de chaque serveur', targets: ['all'] },
    { kind: 'pytest', label: 'tests unitaires', desc: 'pytest du projet choisi', targets: ['lyra', 'mcp-tracking'] },
  ] })],
  ['GET', '/tests/runs', () => ({ runs: RUNS })],
  ['GET', '/tests/runs/:id', ({ params }) => RUNS.find((r) => r.id === params.id) ?? RUNS[0]],
  ['GET', '/agenda', () => ({ now: localStamp(new Date()), categories: ['sauvegardes', 'maintenance'], occurrences: agendaOccurrences() })],
  ['GET', '/agenda/rotation', () => ({ state: 'idle', running: false, mounted: false, ready: true, age_days: 9, last_run: isoAgo(9 * 1440),
    result: 'success', can_start: true, can_stop: false, reason: '', log: [], started_at: null, finished_at: null, duration_s: null })],
]
