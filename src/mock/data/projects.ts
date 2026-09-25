// Projets git et feuille de route de démo (dépôts publics, actions fictives).
import type { MockHandler } from '../router'
import { isoAgo, unixAgo } from './time'

const GH = 'https://github.com/amineutron'
type Status = 'pending' | 'running' | 'blocked' | 'done'
type Action = [number, string, Status, { waiting?: boolean; human?: boolean; blocked_by?: number[] }?]

function roadmapProject(key: string, name: string, objective: string, phases: { key: string; title: string; horizon: string; actions: Action[] }[]) {
  const item = ([number, title, status, o = {}]: Action) => ({
    number, key: `${key}-${number}`, title, status, waiting: Boolean(o.waiting), owner: o.human ? 'utilisateur' : 'claude',
    effort: 'S', url: `${GH}/${key}/issues/${number}`, updated_at: isoAgo(number * 300), blocked_by: o.blocked_by ?? [], needs_human: Boolean(o.human),
  })
  const builtPhases = phases.map((p) => {
    const items = p.actions.map(item)
    const done = items.filter((i) => i.status === 'done').length
    return { key: p.key, title: p.title, horizon: p.horizon, done, total: items.length, percent: Math.round((100 * done) / items.length),
      running: items.filter((i) => i.status === 'running').length, blocked: items.filter((i) => i.status === 'blocked').length,
      waiting: items.filter((i) => i.waiting).length, items }
  })
  const all = builtPhases.flatMap((p) => p.items.map((i, index) => ({ ...i, phase: p.key, index })))
  const done = all.filter((i) => i.status === 'done').length
  const waiting = all.filter((i) => i.waiting)
  const blocked = all.filter((i) => i.status === 'blocked')
  const running = all.filter((i) => i.status === 'running')
  return {
    key, name, state: 'actif', objective, owner: 'amineutron', started: '2026-09-09', readme: `${GH}/${key}#readme`, how_to_run: '',
    repos: [{ name: key, url: `${GH}/${key}`, readme: `${GH}/${key}#readme` }], docs: [], services: [], decisions: [], kpis: [],
    issues_repo: `amineutron/${key}`, repo: `amineutron/${key}`, generated_at: isoAgo(5),
    stage: done === all.length ? 'done' : blocked.length ? 'blocked' : waiting.length ? 'waiting' : running.length ? 'working' : 'idle',
    totals: { done, total: all.length, percent: Math.round((100 * done) / all.length), waiting: waiting.length, blocked: blocked.length,
      human: all.filter((i) => i.needs_human).length },
    phases: builtPhases, timeline: all, next: all.filter((i) => i.status !== 'done').slice(0, 3), waiting, blocked, unassigned: [],
  }
}

const ROADMAP = [
  roadmapProject('lyra', 'Lyra', 'Assistant vocal DevOps 100 % local', [
    { key: 'v1-2', title: 'v1.2 : vérifiable et installable', horizon: 'Tests, CI, installeur', actions: [
      [1, 'Installeur validé sur 3 distributions', 'done'], [2, 'Flux de données documenté', 'done'],
      [6, 'CI complète : tests, lint, badges', 'running'], [16, 'Traduire la page du flux de données', 'pending'],
    ] },
  ]),
  roadmapProject('neutroncore', 'neutroncore', 'Hub du homelab : médias, tâches, maison, lanceur', [
    { key: 'v0-2', title: 'v0.2 : propre et visitable', horizon: 'Démo publique sans backend', actions: [
      [1, 'Titre et manifeste « neutroncore »', 'done'], [2, 'Captures refaites', 'done'], [3, 'README à jour', 'done'],
      [4, 'Mode démo sur GitHub Pages', 'running'],
    ] },
  ]),
  roadmapProject('pylips-mcp', 'pylips-mcp', 'Serveur MCP pour TV Philips', [
    { key: 'v0-2', title: 'v0.2 : autonome et installable', horizon: 'PyPI, uvx, CI', actions: [
      [2, 'Retirer la dépendance non packagée', 'done'], [4, 'Publication PyPI et uvx', 'done'],
      [7, 'Couleur fixe de l’Ambilight', 'pending', { waiting: true, human: true }],
    ] },
  ]),
]

const repo = (name: string, dirty: number, ahead: number, minutesAgo: number) =>
  ({ name, path: `/home/user/dev/${name}`, branch: 'main', dirty, has_remote: true, ahead, behind: 0, last_commit: unixAgo(minutesAgo) })

export const projects: [string, string, MockHandler][] = [
  ['GET', '/projects', () => ({ projects: [
    repo('neutroncore', 3, 1, 20), repo('lyra', 0, 0, 180), repo('mcp-tracking', 0, 0, 1440), repo('fedora-agents', 0, 0, 2880),
    repo('denon-mcp', 0, 0, 600), repo('notes', 2, 0, 9000),
  ] })],
  ['GET', '/projects/stats', () => ({ days: 7, active_projects: 5, total_projects: 6, commits: 64, pushed_commits: 63, files_touched: 188,
    busiest_day: 'jeu.', top: [{ name: 'lyra', commits: 24, pushed: 24 }, { name: 'neutroncore', commits: 19, pushed: 18 },
      { name: 'denon-mcp', commits: 9, pushed: 9 }] })],
  ['GET', '/projects/updates', () => ({ status: 'ok', checked_at: unixAgo(60), updates: 1, images: [
    { image: 'lscr.io/linuxserver/radarr:latest', state: 'update' }, { image: 'lscr.io/linuxserver/sonarr:latest', state: 'up-to-date' },
  ] })],
  ['GET', '/roadmap/projects', () => ({ generated_at: isoAgo(5), errors: {}, projects: ROADMAP })],
]
