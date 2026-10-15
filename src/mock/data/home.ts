// Maison de démo : TV, ampli, lumières Hue, Lyra.
import type { MockHandler } from '../router'
import { AUTOMATION_CATALOGUE } from './automationCatalogue'

const LIGHTS: Record<string, { name: string; on: boolean; bri: number; reachable: boolean; color: string }> = {
  1: { name: 'Plafonnier', on: true, bri: 180, reachable: true, color: '#ffd483' },
  2: { name: 'Lampe canapé', on: true, bri: 120, reachable: true, color: '#f6c177' },
  3: { name: 'Bandeau TV', on: true, bri: 200, reachable: true, color: '#eb6f92' },
  4: { name: 'Bureau', on: false, bri: 254, reachable: true, color: '#ffffff' },
  5: { name: 'Couloir', on: false, bri: 90, reachable: false, color: '#ffd483' },
}
const SCENES = [
  { id: 's-soir', name: 'Soirée', group: '81', colors: ['#f6c177', '#eb6f92'] },
  { id: 's-film', name: 'Cinéma', group: '81', colors: ['#3b2a4d', '#eb6f92'] },
  { id: 's-lecture', name: 'Lecture', group: '81', colors: ['#fff1d6', '#ffd483'] },
  { id: 's-focus', name: 'Concentration', group: '81', colors: ['#dff3ff', '#ffffff'] },
  { id: 's-nuit', name: 'Veilleuse', group: '81', colors: ['#6a3b1f', '#2a1810'] },
]

// volume de l'ampli : la démo retient la consigne pour que la barre la relise
let denonVolume = 42.5

type DemoBlock = { type: string; params: Record<string, unknown>; negate?: boolean }
type DemoStep = { action: string; params: Record<string, unknown>; on_error?: string; retry?: number }
type DemoStepResult = { action: string; label: string; ok: boolean; error: string; ms: number; attempts: number; not_run?: boolean }
type DemoRun = { at: number; trigger: string; why: string; success: boolean; failed: number; detail: string; skipped?: boolean; branch?: string; steps?: DemoStepResult[]; duration_s?: number }
type DemoAutomation = {
  id: string; name: string; enabled: boolean; trigger: DemoBlock; conditions: DemoBlock[]; match: string
  actions: DemoStep[]; otherwise: DemoStep[]; cooldown_min: number; max_per_day: number
  report: { on: string; to: string; success: string; failure: string }; last_run: string | null; history: DemoRun[]
}
const minutesAgo = (m: number) => Date.now() / 1000 - m * 60
const REPORT = { on: 'failure', to: 'app', success: '', failure: '' }
const done = (action: string, label: string, ms: number, ok = true, error = '', attempts = 1): DemoStepResult => ({ action, label, ok, error, ms, attempts })
let demoAutomations: DemoAutomation[] = [
  { id: 'a-dl', name: 'téléchargement prêt', enabled: true, cooldown_min: 1, max_per_day: 0, match: 'all', last_run: null,
    trigger: { type: 'download_done', params: { contains: '' } }, conditions: [{ type: 'tv_is', params: { state: 'on' } }],
    actions: [{ action: 'notify.app', params: { message: 'Prêt à regarder : {titre}' } }],
    otherwise: [{ action: 'notify.phone', params: { message: '{titre} est prêt', title: 'neutroncore', priority: 'normale' } }],
    report: { on: 'failure', to: 'app', success: '', failure: '{nom} : {echecs}' },
    history: [
      { at: minutesAgo(38), trigger: 'download_done', why: 'debian-13.1.0-amd64-netinst.iso', success: true, failed: 0, detail: '', branch: 'else', duration_s: 0.4,
        steps: [done('notify.phone', 'notification sur le téléphone', 412)] },
      { at: minutesAgo(26 * 60), trigger: 'download_done', why: 'archlinux-2026.09.01-x86_64.iso', success: true, failed: 0, detail: '', branch: 'then', duration_s: 0,
        steps: [done('notify.app', "notification dans l'app", 3)] },
    ] },
  { id: 'a-lit', name: 'au lit', enabled: true, cooldown_min: 5, max_per_day: 0, match: 'all', last_run: null, report: REPORT,
    trigger: { type: 'time', params: { time: '23:30', days: [0, 1, 2, 3, 6] } }, conditions: [{ type: 'tv_is', params: { state: 'off' } }],
    actions: [{ action: 'hue.off', params: {} }, { action: 'pc.screens', params: { on: false } }], otherwise: [],
    history: [
      { at: minutesAgo(20 * 60), trigger: 'time', why: 'condition non remplie : il fallait la tv éteinte', success: true, failed: 0, detail: '', skipped: true },
      { at: minutesAgo(44 * 60), trigger: 'time', why: 'heure prévue', success: true, failed: 0, detail: '', branch: 'then', duration_s: 1.2,
        steps: [done('hue.off', 'lumières : tout éteindre', 38), done('pc.screens', 'écrans du pc : allumer / éteindre', 1140)] },
    ] },
  { id: 'a-plex', name: 'plex tombé', enabled: false, cooldown_min: 15, max_per_day: 3, match: 'all', last_run: null,
    report: { on: 'always', to: 'both', success: 'Plex relancé en {duree}', failure: 'Plex ne redémarre pas : {echecs}' },
    trigger: { type: 'service', params: { name: 'plex', state: 'down' } }, conditions: [],
    actions: [{ action: 'service.start', params: { name: 'plex' }, retry: 2, on_error: 'stop' }, { action: 'notify.app', params: { message: 'plex a été relancé' } }], otherwise: [],
    history: [
      { at: minutesAgo(3 * 1440), trigger: 'service', why: 'plex : down', success: false, failed: 1, detail: 'démarrer un service : délai dépassé', branch: 'then', duration_s: 94,
        steps: [done('service.start', 'démarrer un service', 94000, false, 'délai dépassé', 3), { ...done('notify.app', "notification dans l'app", 0, false, 'non exécutée : une action précédente a arrêté la suite', 0), not_run: true }] },
    ] },
  { id: 'a-gpu', name: 'gpu trop chaud', enabled: true, cooldown_min: 60, max_per_day: 0, match: 'all', last_run: null, report: REPORT,
    trigger: { type: 'resource', params: { metric: 'gpu_temp', above: 82, for_min: 5 } }, conditions: [],
    actions: [{ action: 'notify.phone', params: { message: 'GPU : {titre}', title: '', priority: 'haute' } }], otherwise: [], history: [] },
  { id: 'r-film', name: 'soirée film', enabled: true, cooldown_min: 5, max_per_day: 0, match: 'all', last_run: null, report: REPORT,
    trigger: { type: 'manual', params: {} }, conditions: [], otherwise: [], history: [],
    actions: [
      { action: 'hue.scene', params: { scene_id: SCENES[0].id } }, { action: 'tv.power', params: { on: true }, retry: 1 },
      { action: 'wait', params: { seconds: 5 } }, { action: 'tv.app', params: { app: 'plex' } }, { action: 'denon.source', params: { source: 'TV' } },
    ] },
  { id: 'r-pause', name: 'pause', enabled: true, cooldown_min: 5, max_per_day: 0, match: 'all', last_run: null, report: REPORT,
    trigger: { type: 'manual', params: {} }, conditions: [], otherwise: [], history: [],
    actions: [{ action: 'tv.key', params: { key: 'Pause' } }, { action: 'hue.brightness', params: { brightness: 160 } }] },
]
let demoLast: { id: string; at: number; success: boolean; failed: number; steps: DemoStepResult[] } | null = null
let demoPlan = {
  roomDims: { w: 500, h: 600, d: 270 },
  configs: {
    1: { pos: { x: -61, y: 225, z: -80 }, name: 'Lampadaire', haloId: 'l3' }, 2: { pos: { x: 221, y: 93, z: -80 }, name: 'Chevet', haloId: 'l4' },
    3: { pos: { x: -125, y: -270, z: -25 }, name: 'Play gauche', haloId: 'l1' }, 4: { pos: { x: 40, y: -270, z: -25 }, name: 'Play droite', haloId: 'l2' },
  },
  strip: { segments: 3, segs: [
    { pos: { x: 7, y: 184 }, angle: -90, length: 67 }, { pos: { x: 46, y: 118 }, angle: 0, length: 67 }, { pos: { x: 142, y: 116 }, angle: 0, length: 67 },
  ] },
  tv: { pos: { x: -42, y: -282, z: 116 }, readOnly: true },
}

export const home: [string, string, MockHandler][] = [
  ['GET', '/tv/status', () => ({ power: 'On', volume: 18, muted: false, ambilight_mode: 'FOLLOW_VIDEO', ambilight_on: true,
    denon_volume: denonVolume, denon_muted: false, denon_reachable: true, denon_power: 'on', denon_source: 'TV' })],
  ['POST', '/tv/denon/volume', ({ body }) => {
    const level = Number((body as { level?: unknown } | undefined)?.level)
    if (Number.isFinite(level)) denonVolume = Math.max(0, Math.min(98, Math.round(level)))
    return { success: true, demo: true, volume: denonVolume }
  }],
  // caméra : éteinte en démonstration (pas de webcam), réglages et fonds préfaits visibles
  ['GET', '/camera', () => ({
    moteur: { actif: false, demarre: false }, fonds: [], limites: { taille_fond: 314572800, formats: ['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm', '.mkv', '.mov'] },
    reglages: { fond: { mode: 'flou', nom: '', flou: 55 }, detourage: { durete: 60, marge: 0, stabilite: 40 }, veille: false, modele: 'auto', virtuelle: true, cadence: 30 },
    prefaits: [{ nom: 'aubergine', label: 'aubergine', couleurs: ['#0e0a10', '#3a1f3d'], angle: 135 }, { nom: 'or', label: 'or et braise', couleurs: ['#2a1a0c', '#f6c177'], angle: 160 },
      { nom: 'nuit', label: 'nuit bleue', couleurs: ['#070b16', '#2b4a7a'], angle: 120 }],
  })],
  ['GET', '/hue/lights', () => ({ lights: LIGHTS })],
  ['GET', '/plan', () => ({ ...demoPlan, rev: 'demo' })],
  ['GET', '/plan/ruban-hue', () => ({ success: true, nom: 'gradient lightstrip', pixels: 13, segments: [1, 1, 3, 3, 3, 1, 1].map((n) => n / 13) })],
  ['PUT', '/plan', ({ body }) => {
    const b = body as { roomDims: typeof demoPlan.roomDims; configs: Record<string, { pos: { x: number; y: number; z: number } }>; strip?: { segs: { pos: { x: number; y: number }; angle: number }[] } }
    const segs = demoPlan.strip.segs.map((sg, i) => ({ ...sg, ...(b.strip?.segs[i] ?? {}) }))
    demoPlan = { ...demoPlan, roomDims: b.roomDims, strip: { ...demoPlan.strip, segs }, configs: Object.fromEntries(Object.entries(demoPlan.configs).map(([id, c]) => [id, { ...c, pos: b.configs[id]?.pos ?? c.pos }])) as typeof demoPlan.configs }
    return { success: true, demo: true, rev: 'demo' }
  }],
  ['GET', '/screens/measured', () => ({ ok: true, left: ['#1d3a6e', '#22407a', '#162c55'], top: ['#7a3b1e', '#8a4a22', '#6e2f18'], right: ['#5a1d4e', '#6b2460', '#481640'], bottom: [] })],
  ['GET', '/automations', () => ({ automations: demoAutomations, catalogue: AUTOMATION_CATALOGUE, running: null, last: demoLast, invalid: 0 })],
  ['PUT', '/automations/:id', ({ params, body }) => {
    const a = (body as { automation: Omit<DemoAutomation, 'id' | 'last_run' | 'history'> }).automation
    const id = params.id === 'new' ? `a-${Date.now()}` : params.id
    const old = demoAutomations.find((x) => x.id === id)
    demoAutomations = [...demoAutomations.filter((x) => x.id !== id), { ...a, id, last_run: null, history: old?.history ?? [] }].sort((x, y) => x.name.localeCompare(y.name))
    return { success: true, id }
  }],
  ['DELETE', '/automations/:id', ({ params }) => { demoAutomations = demoAutomations.filter((x) => x.id !== params.id); return { success: true } }],
  ['POST', '/automations/analyze', ({ body }) => {
    // démo : trois phrases connues, le reste est « non reconnu » comme le ferait une règle absente
    const text = String((body as { text?: string } | undefined)?.text ?? '').trim()
    const t = text.toLowerCase()
    const no = (reason: string) => ({ success: true, phrase: text, ok: false, tool: '', arguments: {}, reason, warnings: [] })
    if (/\b(et|puis|ensuite)\b/.test(t)) return no('une phrase par action : ajoute une action « demander à lyra » pour chacune')
    if (/\bvm\b/.test(t)) return no('action sensible : elle demande une confirmation, impossible sans personne devant l’écran')
    const known: [RegExp, string, Record<string, string | number>][] = [
      [/allume.*t[ée]l[ée]/, 'tv.power_on', {}], [/[ée]tein.*t[ée]l[ée]/, 'tv.power_off', {}],
      [/[ée]tein.*lumi/, 'hue.turn_off_group', { group_id: 81 }], [/sc[èe]ne (\w+)/, 'hue.activate_scene_by_name', {}],
    ]
    const hit = known.find(([re]) => re.test(t))
    if (!hit) return no('lyra ne reconnaît pas cette phrase (seules les commandes directes sont acceptées ici)')
    const scene = hit[1] === 'hue.activate_scene_by_name' ? { scene_name: (t.match(/sc[èe]ne (\w+)/) ?? [])[1] ?? '' } : hit[2]
    return { success: true, phrase: text, ok: true, tool: hit[1], arguments: scene, reason: '', warnings: [] }
  }],
  ['POST', '/automations/event/:name', () => ({ success: true, triggered: 0 })],
  ['POST', '/automations/:id/run', ({ params, body }) => {
    const a = demoAutomations.find((x) => x.id === params.id)
    const branch = (body as { branch?: string } | undefined)?.branch === 'else' ? 'else' : 'then'
    const steps = ((branch === 'else' ? a?.otherwise : a?.actions) ?? []).map((x, i) => done(x.action, x.action, 20 + i * 35))
    const now = Date.now() / 1000
    demoLast = { id: params.id, at: now, success: true, failed: 0, steps }
    demoAutomations = demoAutomations.map((x) => (x.id === params.id
      ? { ...x, history: [{ at: now, trigger: 'manual', why: '', success: true, failed: 0, detail: '', branch, steps, duration_s: 0.2 }, ...x.history] } : x))
    return { success: true, started: true, steps: steps.length }
  }],
  ['GET', '/hue/scenes', () => ({ scenes: SCENES.map(({ id, name, group }) => ({ id, name, group })) })],
  ['GET', '/hue/scenes/:id/preview', ({ params }) => {
    const s = SCENES.find((x) => x.id === params.id) ?? SCENES[0]
    return { colors: s.colors, lightstates: { 1: s.colors[0], 2: s.colors[0], 3: s.colors[1], 4: s.colors[0], 5: s.colors[1] } }
  }],
  ['GET', '/hue/positions', () => ({ positions: { 1: [-0.8, -0.4, -0.7], 2: [1, -0.6, 0.1], 3: [0.1, -1, 0.4], 4: [-1, 1, 0.4], 5: [-0.8, -0.2, -1] } })],
  ['GET', '/hue/beat/status', () => ({ running: false, active: false, pid: null, raw: 'hue_beat: inactif.' })],
  ['GET', '/ironman/status', () => ({ active: false, state: 'idle' })],
  ['GET', '/lyra/status', () => ({ reachable: true, status: 'ready', heartbeat_age: 4 })],
  ['GET', '/lyra/settings', () => ({ voice: 'fr_FR-siwis-medium', speaker_id: 0, speed: 1,
    voices: ['fr_FR-siwis-medium', 'fr_FR-tom-medium', 'fr_FR-upmc-medium'], note: 'démo : réglage non appliqué' })],
  ['GET', '/lyra/catalog', () => ({ servers: [] })],
]
