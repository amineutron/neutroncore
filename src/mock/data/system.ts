// Système de démo : services, VM, ressources, sauvegardes, timers, tests, agenda.
import type { MockHandler } from '../router'
import { dayAt, isoAgo, localStamp, systemdAgo, unixAgo, unixIn } from './time'
import { sortiesDemo } from './sorties'

const GB = 1024 ** 3
const CONTROLLABLE = ['lyra', 'n8n', 'tracking', 'plex', 'radarr', 'sonarr', 'bazarr']
const svc = (name: string, display: string, status = 'up', type = 'http') =>
  ({ name, display_name: display, status, type, url: null, extra: {}, controllable: CONTROLLABLE.includes(name) })

// Rappels : la banque recopie lib/sonneries.BANQUE de l'API (mêmes identifiants) ; sorties son inventées
const RAPPELS = {
  sonneries: [
    { id: 'aube', nom: 'aube', categorie: 'douces', origine: 'neutroncore' },
    { id: 'doux', nom: 'réveil doux', categorie: 'douces', origine: 'neutroncore' },
    { id: 'bulles', nom: 'bulles', categorie: 'douces', origine: 'neutroncore' },
    { id: 'brise', nom: 'brise', categorie: 'douces', origine: 'neutroncore' },
    { id: 'boite', nom: 'boîte à musique', categorie: 'douces', origine: 'neutroncore' },
    { id: 'carillon', nom: 'carillon', categorie: 'mélodies', origine: 'neutroncore' },
    { id: 'marimba', nom: 'marimba du matin', categorie: 'mélodies', origine: 'neutroncore' },
    { id: 'xylophone', nom: 'xylophone', categorie: 'mélodies', origine: 'neutroncore' },
    { id: 'harpe', nom: 'harpe', categorie: 'mélodies', origine: 'neutroncore' },
    { id: 'cloches', nom: "cloches d'église", categorie: 'mélodies', origine: 'neutroncore' },
    { id: 'comptine', nom: 'comptine', categorie: 'mélodies', origine: 'neutroncore' },
    { id: 'vibraphone', nom: 'vibraphone', categorie: 'mélodies', origine: 'neutroncore' },
    { id: 'bipbip', nom: 'bip bip', categorie: 'classiques', origine: 'neutroncore' },
    { id: 'numerique', nom: 'réveil numérique', categorie: 'classiques', origine: 'neutroncore' },
    { id: 'mecanique', nom: 'réveil à marteau', categorie: 'classiques', origine: 'neutroncore' },
    { id: 'sonar', nom: 'sonar', categorie: 'classiques', origine: 'neutroncore' },
    { id: 'retro', nom: 'téléphone rétro', categorie: 'classiques', origine: 'neutroncore' },
    { id: 'montee', nom: 'sirène montante', categorie: 'énergiques', origine: 'neutroncore' },
    { id: 'alerte', nom: 'alerte', categorie: 'énergiques', origine: 'neutroncore' },
    { id: 'electro', nom: 'arpège électro', categorie: 'énergiques', origine: 'neutroncore' },
    { id: 'fanfare', nom: 'fanfare', categorie: 'énergiques', origine: 'neutroncore' },
    { id: 'pulsation', nom: 'pulsation', categorie: 'énergiques', origine: 'neutroncore' },
    { id: 'classique', nom: 'réveil classique', categorie: 'classiques', origine: 'systeme' },
    { id: 'perso-chant-du-coq', nom: 'chant du coq', categorie: 'mes sons', origine: 'perso' },
  ],
  sorties: [
    { id: 'tele', nom: 'la télé', tele: true, present: true, volume: 74, muet: false },
    { id: 'defaut', nom: 'sortie par défaut du PC', tele: false, present: true, volume: 54, muet: false },
    { id: 'alsa_output.demo-casque', nom: 'casque', tele: false, present: true, volume: 54, muet: false },
  ],
  en_cours: null, prochains: [], derniers: [],
}

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
    rappel: { minutes_avant: 15, moyens: ['tele', 'sonnerie'], sonnerie: 'carillon', sortie: 'tele', duree_min: 5, progressif: true },
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

const notif = (id: string, minutes: number, source: string, level: string, title: string, detail: string, action: string, read = false, count = 1) =>
  ({ id, at: Date.now() / 1000 - minutes * 60, source, level, title, detail, action, ref: source === 'session' ? 'demo-1' : '', key: id, count, read })
let demoNotifs = [
  notif('n1', 4, 'session', 'warn', 'neutroncore · attend ta réponse', 'Claude demande une permission (données de démo).', 'lanceur'),
  notif('n2', 22, 'system', 'warn', 'Ollama arrêté', 'Le service LLM local ne répond pas.', 'outils'),
  notif('n3', 95, 'session', 'info', 'lyra · réponse prête', '', 'lanceur', true, 3),
  notif('n4', 26 * 60, 'system', 'ok', 'résolu : /data presque plein — 91 %', '', 'films', true),
  notif('n5', 27 * 60, 'system', 'crit', '/data presque plein — 93 %', '212 Go libres.', 'films', true),
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
    { kind: 'unit', key: 'unit:ollama.service', level: 'warn', title: 'Ollama arrêté', detail: 'Le service LLM local ne répond pas (données de démo).', action: 'outils' },
    { kind: 'disk', key: 'disk:/data', level: 'warn', title: '/data presque plein — 91 %', detail: '335 Go libres. Touche pour voir ce qui prend la place.', action: 'disque', ref: '/data' },
  ] })],
  // ce qui remplit le disque (components/DiskPanel.tsx) : analyse figée, sans `du`
  ['GET', '/system/disque', () => ({ disques: [
    { path: '/', total: 931 * GB, free: 212 * GB, used_pct: 77.2, analyse_at: unixAgo(90), en_cours: false },
    { path: '/data', total: 3726 * GB, free: 335 * GB, used_pct: 91, analyse_at: unixAgo(90), en_cours: false },
    { path: '/backups', total: 1863 * GB, free: 944 * GB, used_pct: 49.3, analyse_at: null, en_cours: false },
  ] })],
  ['GET', '/system/disque/analyse', ({ query }) => ({ chemin: query.get('chemin') ?? '/data', en_cours: false, depuis: null, resultat: {
    total: 3391 * GB, critere: 'acces', at: unixAgo(90), duree_s: 214, illisibles: 0,
    gros: [
      { chemin: 'media/films/4k', octets: 1480 * GB, jours: 2, profondeur: 3 }, { chemin: 'media/series', octets: 920 * GB, jours: 0, profondeur: 2 },
      { chemin: 'telechargements/termines', octets: 410 * GB, jours: 35, profondeur: 2 }, { chemin: 'vms/images', octets: 268 * GB, jours: 140, profondeur: 2 },
      { chemin: 'media/musique', octets: 96 * GB, jours: 12, profondeur: 2 },
    ],
    oublies: [
      { chemin: 'vms/images', octets: 268 * GB, jours: 140, profondeur: 2 }, { chemin: 'archives/2024', octets: 74 * GB, jours: 410, profondeur: 2 },
      { chemin: 'telechargements/iso', octets: 22 * GB, jours: 260, profondeur: 2 },
    ],
  } })],
  ['POST', '/system/disque/analyser', () => ({ success: true, en_cours: true, deja: false })],
  ['GET', '/notifications', () => ({ unread: demoNotifs.filter((n) => !n.read).length, total: demoNotifs.length, entries: demoNotifs })],
  ['POST', '/notifications/read', () => { demoNotifs = demoNotifs.map((n) => ({ ...n, read: true })); return { success: true, unread: 0 } }],
  ['DELETE', '/notifications', () => { demoNotifs = []; return { success: true } }],
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
  ['GET', '/agenda', ({ query }) => {
    const avecSorties = query.get('sorties') === '1'
    return { now: localStamp(new Date()), categories: ['sauvegardes', 'maintenance', ...(avecSorties ? ['sorties'] : [])],
      occurrences: [...agendaOccurrences(), ...(avecSorties ? sortiesDemo() : [])] }
  }],
  ['GET', '/agenda/rappels', () => RAPPELS],
  ['GET', '/agenda/rappels/en-cours', () => ({ en_cours: null })],
  ['POST', '/agenda/rappels/essayer', () => ({ success: true, resultats: { tele: 'ok', sonnerie: 'ok' } })],
  ['POST', '/agenda/rappels/ecouter', () => ({ success: true, remarque: 'mode démo : rien ne sonne' })],
  ['GET', '/agenda/rotation', () => ({ state: 'idle', running: false, mounted: false, ready: true, age_days: 9, last_run: isoAgo(9 * 1440),
    result: 'success', can_start: true, can_stop: false, reason: '', log: [], started_at: null, finished_at: null, duration_s: null })],
]
