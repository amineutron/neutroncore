// Maison de démo : TV, ampli, lumières Hue, Lyra.
import type { MockHandler } from '../router'

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

const ROUTINE_CATALOGUE = [
  { action: 'hue.scene', label: 'scène hue', params: [{ name: 'scene_id', type: 'id' }] },
  { action: 'hue.off', label: 'lumières : tout éteindre', params: [] },
  { action: 'hue.brightness', label: 'lumières : intensité', params: [{ name: 'brightness', type: 'int', min: 1, max: 254 }] },
  { action: 'tv.power', label: 'tv : allumer / éteindre', params: [{ name: 'on', type: 'bool' }] },
  { action: 'tv.app', label: 'tv : ouvrir une application', params: [{ name: 'app', type: 'choice', choices: ['plex', 'youtube', 'netflix', 'disney', 'prime'] }] },
  { action: 'tv.ambilight', label: 'tv : ambilight', params: [{ name: 'mode', type: 'choice', choices: ['FOLLOW_VIDEO', 'FOLLOW_AUDIO', 'LOUNGE_LIGHT', 'OFF'] }] },
  { action: 'denon.volume', label: 'ampli : volume', params: [{ name: 'level', type: 'int', min: 0, max: 60 }] },
  { action: 'denon.source', label: 'ampli : entrée', params: [{ name: 'source', type: 'choice', choices: ['TV', 'BD', 'GAME', 'SAT/CBL', 'DVD', 'MPLAY'] }] },
  { action: 'wait', label: 'attendre', params: [{ name: 'seconds', type: 'int', min: 1, max: 60 }] },
]
type DemoRoutine = { id: string; name: string; enabled: boolean; schedule: { time: string; days: number[] } | null; steps: { action: string; params: Record<string, unknown> }[]; last_run: string | null }
let demoRoutines: DemoRoutine[] = [
  { id: 'r-film', name: 'soirée film', enabled: true, schedule: null, last_run: null, steps: [
    { action: 'hue.scene', params: { scene_id: SCENES[0].id } }, { action: 'tv.power', params: { on: true } },
    { action: 'wait', params: { seconds: 5 } }, { action: 'tv.app', params: { app: 'plex' } }, { action: 'denon.source', params: { source: 'TV' } },
  ] },
  { id: 'r-lit', name: 'au lit', enabled: true, schedule: { time: '23:30', days: [0, 1, 2, 3, 6] }, last_run: null, steps: [
    { action: 'tv.power', params: { on: false } }, { action: 'hue.off', params: {} },
  ] },
]
let demoLast: { id: string; success: boolean; failed: number; steps: { action: string; label: string; ok: boolean; error: string }[] } | null = null
let demoPlan = {
  roomDims: { w: 500, h: 600, d: 270 },
  configs: {
    1: { pos: { x: -61, y: 225, z: -80 }, name: 'Lampadaire', haloId: 'l3' }, 2: { pos: { x: 221, y: 93, z: -80 }, name: 'Chevet', haloId: 'l4' },
    3: { pos: { x: -125, y: -270, z: -25 }, name: 'Play gauche', haloId: 'l1' }, 4: { pos: { x: 40, y: -270, z: -25 }, name: 'Play droite', haloId: 'l2' },
  },
  strip: { pos: { x: 7, y: 184 }, stripEnd: { x: 142, y: 116 }, segments: 3, readOnly: true },
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
  ['GET', '/hue/lights', () => ({ lights: LIGHTS })],
  ['GET', '/plan', () => demoPlan],
  ['PUT', '/plan', ({ body }) => {
    const b = body as { roomDims: typeof demoPlan.roomDims; configs: Record<string, { pos: { x: number; y: number; z: number } }> }
    demoPlan = { ...demoPlan, roomDims: b.roomDims, configs: Object.fromEntries(Object.entries(demoPlan.configs).map(([id, c]) => [id, { ...c, pos: b.configs[id]?.pos ?? c.pos }])) as typeof demoPlan.configs }
    return { success: true, demo: true }
  }],
  ['GET', '/screens/measured', () => ({ ok: true, left: ['#1d3a6e', '#22407a', '#162c55'], top: ['#7a3b1e', '#8a4a22', '#6e2f18'], right: ['#5a1d4e', '#6b2460', '#481640'], bottom: [] })],
  ['GET', '/routines', () => ({ routines: demoRoutines, catalogue: ROUTINE_CATALOGUE, running: null, last: demoLast, invalid: 0 })],
  ['PUT', '/routines/:id', ({ params, body }) => {
    const r = (body as { routine: Omit<DemoRoutine, 'id' | 'last_run'> }).routine
    const id = params.id === 'new' ? `r-${Date.now()}` : params.id
    demoRoutines = [...demoRoutines.filter((x) => x.id !== id), { ...r, id, last_run: null }].sort((a, b) => a.name.localeCompare(b.name))
    return { success: true, id }
  }],
  ['DELETE', '/routines/:id', ({ params }) => { demoRoutines = demoRoutines.filter((x) => x.id !== params.id); return { success: true } }],
  ['POST', '/routines/:id/run', ({ params }) => {
    const r = demoRoutines.find((x) => x.id === params.id)
    demoLast = { id: params.id, success: true, failed: 0, steps: (r?.steps ?? []).map((x) => ({ action: x.action, label: x.action, ok: true, error: '' })) }
    return { success: true, started: true, steps: r?.steps.length ?? 0 }
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
