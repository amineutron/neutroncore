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

export const home: [string, string, MockHandler][] = [
  ['GET', '/tv/status', () => ({ power: 'On', volume: 18, muted: false, ambilight_mode: 'FOLLOW_VIDEO', ambilight_on: true,
    denon_volume: denonVolume, denon_muted: false, denon_reachable: true, denon_power: 'on', denon_source: 'TV' })],
  ['POST', '/tv/denon/volume', ({ body }) => {
    const level = Number((body as { level?: unknown } | undefined)?.level)
    if (Number.isFinite(level)) denonVolume = Math.max(0, Math.min(98, Math.round(level)))
    return { success: true, demo: true, volume: denonVolume }
  }],
  ['GET', '/hue/lights', () => ({ lights: LIGHTS })],
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
