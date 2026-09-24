// Types et helpers du bloc « sessions » du lanceur (sessions Claude Code)

export type SessionState = '' | 'parked' | 'closing'
export type SessionMeta = {
  alias?: string; comment?: string; color?: string; pinned?: boolean; icon?: string; icon_bg?: string; synced_name?: string
  state?: SessionState; closing_steps?: string[]; closing_at?: number
  home_hidden?: boolean   // masquee de l'accueil et du mode tele
}

export type LiveSession = {
  sessionId: string; pid: number; name: string; cwd: string; repo: string | null
  status: string; startedAt: number; updatedAt: number; controllable: boolean
  meta: SessionMeta; waiting: boolean; wait_message: string; stopped_at: number | null
  age_s: number; last_user: string; last_claude: string; last_at: string | null
  state: SessionState; close_ready: boolean
  pending: Pending | null
}

// Demande en attente (permission d'outil, plan, question) avec les touches à
// envoyer au dialogue du terminal pour chaque choix.
export type PendingOption = { label: string; keys: string[]; hint: string }
export type Pending = {
  kind: 'permission' | 'plan' | 'question'; tool: string; title: string; detail: string
  options: PendingOption[]
  questions?: { question: string; header: string; multi: boolean; options: { label: string; description: string }[] }[]
}

// Etapes de cloture propre (miroir de lib/claude_sessions.CLOSING_STEPS cote API)
export const CLOSING_STEPS: { id: string; label: string; desc: string }[] = [
  { id: 'summary', label: 'résumé dans docs/SESSIONS.md', desc: 'objectif, ce qui a été fait, ce qui reste — 10 lignes max' },
  { id: 'readme', label: 'vérifier README / CLAUDE.md', desc: 'propose les corrections si la doc ne colle plus au code' },
  { id: 'git', label: 'état git + commit proposé', desc: 'demande si le dépôt est privé ou public (scan secrets/IP si public), puis message de commit, sans commiter seul' },
  { id: 'memory', label: 'mémoire (pièges, décisions)', desc: 'ce qui n’est pas dérivable du code' },
]
export const CLOSING_DEFAULT = ['summary', 'readme', 'git']

export type RecentSession = {
  sessionId: string; cwd: string; repo: string; title: string
  last_user: string; last_claude: string; updatedAt: number; meta: SessionMeta
}

export type ChatMsg = { who: 'me' | 'claude'; text: string; at: string | null; tools?: string[] }

export const PALETTE = ['#f6c177', '#eb6f92', '#82d69c', '#6ea8fe', '#9d7bf5', '#f0b45e', '#4ade80', '#9c8ea6']

export const OTHERS_KEY = 'neutroncore_sessions_others'

export function fmtAge(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
  return `${Math.floor(s / 86400)} j`
}

export function fmtClock(ts: number | string | null | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function displayName(s: { name: string; meta: SessionMeta }): string {
  return s.meta.alias || s.name
}

export function glyph(name: string): string {
  return name.split(/[-_ ]/).map((w) => w[0]).join('').slice(0, 2)
}

export function tone(s: LiveSession): 'wait' | 'busy' | 'idle' {
  if (s.waiting && s.state !== 'parked') return 'wait'
  return s.status === 'running' || s.status === 'busy' ? 'busy' : 'idle'
}

// Etat de la mascotte d'une session : l'activite reelle d'abord, puis l'etat
// choisi dans l'app (veille = dort, fermeture = execute, prete = succes).
// Exception : une session en veille qui attend reste endormie (pas d'alerte).
export type GlyphState = 'idle' | 'sleep' | 'busy' | 'work' | 'ok' | 'err'
export function glyphState(s: Pick<LiveSession, 'waiting' | 'status' | 'state' | 'close_ready'>): GlyphState {
  if (s.waiting) return s.state === 'parked' ? 'sleep' : 'err'
  if (s.status === 'running' || s.status === 'busy') return s.state === 'closing' ? 'work' : 'busy'
  if (s.state === 'parked') return 'sleep'
  if (s.state === 'closing') return s.close_ready ? 'ok' : 'work'
  return 'idle'
}

export function stateLabel(s: Pick<LiveSession, 'waiting' | 'status' | 'state' | 'close_ready'>): string {
  const g = glyphState(s)
  if (s.waiting && s.state === 'parked') return 'en veille · attend ta réponse'
  return { err: 'attend ta réponse', busy: 'travaille', work: 'clôture en cours', ok: 'prête à fermer', sleep: 'en veille', idle: 'en pause' }[g]
}
