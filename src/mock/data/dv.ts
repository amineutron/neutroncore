// Conversions Dolby Vision de démo (GET /dv, relance). Tout est fictif.
import type { MockHandler } from '../router'
import { isoAgo } from './time'

const STEPS = ['extraction HEVC', 'demux BL/EL', 'extraction RPU + conv P8', 'injection RPU P8 dans BL', 'reconstruction timestamps', 'remuxage MKV final']
const status = (n: number, at: number) => (n < at ? 'done' : n === at ? 'running' : 'pending') as 'done' | 'running' | 'pending'
const steps = (at: number) => STEPS.map((name, i) => ({
  n: i + 1, name, status: status(i + 1, at), seconds: i + 1 < at ? 600 + i * 240 : i + 1 === at ? 410 : null,
  note: i + 1 === at ? 'frame: 91200 / 186113 (49.0%)  speed: 2.4x' : '',
}))

const live = (id: string, title: string, state: 'running' | 'waiting', at: number, progress: number) => ({
  id, title, state, profile: 'P7 -> P8', size: '58.3 GB', file: `${title}.mkv`, phase: state === 'waiting' ? 'detection DV' : `${at}/6`,
  steps: state === 'waiting' ? steps(0).map((s) => ({ ...s, status: 'pending' as const, seconds: null, note: '' })) : steps(at),
  current_step: state === 'running' ? at : null, progress, elapsed_s: state === 'running' ? 3100 : 40,
  eta_s: state === 'running' ? 3300 : null,
})

const hist = (key: string, title: string, outcome: 'converted' | 'failed', ago: number, secs: number) => ({
  key, title, profile: 7, mode: 'dv' as const, outcome, started: isoAgo(ago + secs / 60).slice(0, 19), ended: isoAgo(ago).slice(0, 19), seconds: secs,
  steps: [{ n: 1, seconds: secs * 0.35 }, { n: 2, seconds: secs * 0.2 }, { n: 3, seconds: secs * 0.25 }, { n: 4, seconds: secs * 0.1 }, { n: 5, seconds: secs * 0.05 }, { n: 6, seconds: secs * 0.05 }],
})

let relaunched: string[] = []

export const dv: [string, string, MockHandler][] = [
  ['GET', '/dv', () => ({
    now: isoAgo(0).slice(0, 19), tracking_ok: true, journal_ok: true,
    current: [live('c0ffee01', 'Film de demonstration A', 'running', 2, 24.5)],
    queue: [live('c0ffee02', 'Film de demonstration B', 'waiting', 0, 0)],
    history: [hist('h1', 'Film de demonstration C', 'converted', 1500, 3400), hist('h2', 'Film de demonstration D', 'failed', 4300, 2100),
      hist('h3', 'Film de demonstration E', 'converted', 10000, 3900)],
    failures: relaunched.includes('f1') ? [] : [{
      key: 'f1', title: 'Film de demonstration D', file: 'Film de demonstration D.mkv', profile: 7, when: isoAgo(4300).slice(0, 19),
      step: 1, step_name: 'extraction HEVC', cause: 'ffmpeg s\'est arrêté en erreur à l\'étape 1/6 (extraction HEVC) : fichier source abîmé, disque plein ou carte graphique occupée',
      raw: 'Commande echouee: ffmpeg', session_id: 'c0ffee03', ambiguous: false, can_relaunch: true, relaunch_reason: '',
      excerpt: ['20:22:28 Profile 7 problematique -> conversion P8 en cours...', '20:22:28 Etape 1/6 : extraction HEVC...', '20:56:56 Commande echouee: ffmpeg'],
    }],
    stats: { converted: 2, failed: 1, skipped: 12, average_s: 3650, longest_s: 3900, last_conversion: isoAgo(1500).slice(0, 19), journal_since: isoAgo(60 * 24 * 30).slice(0, 19) },
  })],
  ['POST', '/dv/echecs/:key/relancer', ({ params }) => { relaunched = [...relaunched, params.key]; return { requested: params.key, file: 'demo.mkv' } }],
]
