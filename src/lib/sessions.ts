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
  atelier?: string        // projet de l'atelier 3d sur lequel cette session boucle : elle vit dans l'atelier, pas dans le lanceur
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
  atelier?: string
}

export type ChatMsg = {
  who: 'me' | 'claude'; text: string; at: string | null; tools?: string[]
  tools_at?: (string | null)[]   // heure de chaque commande, dans le même ordre que `tools`
  from?: string | null           // début du tour : le moment où la demande est arrivée
  think_s?: number               // temps de réflexion cumulé du tour, en secondes
}

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

/** Texte d'un message de l'utilisateur, débarrassé de l'emballage technique de Claude Code :
 * une commande (`<command-name>/x</command-name><command-args>…</command-args>`) devient « /x … »,
 * les blocs que l'utilisateur n'a pas écrits (rappels système, sortie de commande locale) sont retirés. */
export function userText(text: string): string {
  // résumé automatique écrit par Claude Code quand le contexte déborde : pas un message de l'utilisateur
  if (text.trimStart().startsWith('This session is being continued from a previous conversation')) return ''
  // compte rendu d'un sous-agent ou d'une autre session, remis à Claude : l'utilisateur ne l'a pas écrit
  if (/^(Another Claude session sent a message|\[SYSTEM NOTIFICATION)/.test(text.trimStart())) return ''
  const nom = /<command-name>\s*([^<]*?)\s*<\/command-name>/.exec(text)?.[1] ?? ''
  const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(text)?.[1].trim() ?? ''
  const reste = text
    .replace(/<(command-message|command-name|command-args|system-reminder|local-command-stdout|local-command-stderr|local-command-caveat|task-notification|agent-message)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    // une longue réponse envoyée au terminal y arrive comme un collage : on garde le texte, pas la balise
    // (les balises sont retirées une à une : un long message est tronqué avant sa balise de fin)
    .replace(/<\/?pasted_content\b[^>]*>/g, '')
    .trim()
  return [nom ? [nom, args].filter(Boolean).join(' ') : '', reste].filter(Boolean).join('\n\n')
}

/** Le lanceur ne liste pas les boucles de l'atelier 3d : elles ont leur écran. */
export const horsAtelier = <T extends { atelier?: string }>(sessions: T[]): T[] => sessions.filter((s) => !s.atelier)

/** Durée courte et lisible : « 8 s », « 3 min 20 », « 1 h 05 ». */
export function fmtDuree(secondes: number): string {
  const s = Math.max(0, Math.round(secondes))
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, '0')}` : ''}`
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}

/** Durée d'un tour de Claude en secondes, de l'arrivée de la demande à son dernier message. null si on ne sait pas. */
export function dureeTour(m: Pick<ChatMsg, 'at' | 'from'>): number | null {
  if (!m.at || !m.from) return null
  const d = (new Date(m.at).getTime() - new Date(m.from).getTime()) / 1000
  return Number.isFinite(d) && d >= 1 ? d : null
}

/** Nom d'outil lisible : « mcp__playwright__browser_click » devient « playwright · click ». */
export function nomOutil(nom: string): string {
  const m = /^mcp__(.+?)__(.+)$/.exec(nom)
  if (!m) return nom
  const serveur = m[1].replace(/^claude_ai_|^plugin_[^_]+_/, '').replace(/_/g, ' ')
  return `${serveur} · ${m[2].replace(/^browser_/, '').replace(/_/g, ' ')}`
}

export type Commande = { nom: string; arg: string; at: string | null }
/** Les commandes d'un tour, la plus récente d'abord. */
export function commandes(m: Pick<ChatMsg, 'tools' | 'tools_at'>): Commande[] {
  return (m.tools ?? []).map((t, i) => {
    const sep = t.indexOf(': ')
    return { nom: nomOutil(sep > 0 ? t.slice(0, sep) : t), arg: sep > 0 ? t.slice(sep + 2) : '', at: m.tools_at?.[i] ?? null }
  }).reverse()
}

/** Décompte par outil, le plus utilisé d'abord : « Bash ×8, Edit ×3 ». Au-delà de `max` outils : « +N ». */
export function resumeCommandes(cmds: Commande[], max = 3): string {
  const compte = new Map<string, number>()
  for (const c of cmds) compte.set(c.nom, (compte.get(c.nom) ?? 0) + 1)
  const tri = [...compte.entries()].sort((a, b) => b[1] - a[1])
  const dits = tri.slice(0, max).map(([n, k]) => (k > 1 ? `${n} ×${k}` : n))
  return [...dits, ...(tri.length > max ? [`+${tri.length - max}`] : [])].join(', ')
}

/** Ajoute les nouveaux messages ; si le dernier affiché et le premier reçu sont tous deux de Claude
 * (tour encore en cours), ils sont fusionnés : texte, commandes et durées. */
export function mergeTail(prev: ChatMsg[], fresh: ChatMsg[]): ChatMsg[] {
  const last = prev[prev.length - 1]
  const first = fresh[0]
  if (!last || !first || last.who !== 'claude' || first.who !== 'claude') return [...prev, ...fresh]
  const somme = (a?: number, b?: number) => (a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0))
  const merged: ChatMsg = {
    ...last,
    text: [last.text, first.text].filter(Boolean).join('\n'),
    at: first.at ?? last.at,
    from: last.from ?? last.at,
    tools: [...(last.tools ?? []), ...(first.tools ?? [])],
    // une commande sans heure garde sa place : les deux listes restent alignées
    tools_at: [...(last.tools ?? []).map((_, i) => last.tools_at?.[i] ?? null), ...(first.tools ?? []).map((_, i) => first.tools_at?.[i] ?? null)],
    think_s: somme(last.think_s, first.think_s),
  }
  return [...prev.slice(0, -1), merged, ...fresh.slice(1)]
}

/** Ordre d'affichage stable des sessions : chacune garde sa place d'un relevé à l'autre. Seules remontent en tête
 * une session qui vient de se mettre à attendre une réponse et une session qui vient d'apparaître. Une session
 * qui n'attend plus (elle passe « en pause » ou reprend) ne bouge pas : la faire redescendre déplacerait la page
 * pour rien. `precedent` = ordre affiché, `attendaient` = celles qui attendaient déjà ; `sessions` arrive dans
 * l'ordre du serveur, qui sert au premier affichage. */
export function ordreStable(precedent: string[], attendaient: string[], sessions: { sessionId: string; urgent: boolean }[]): string[] {
  const presentes = new Set(sessions.map((s) => s.sessionId))
  const connues = new Set(precedent)
  const deja = new Set(attendaient)
  const enTete = sessions.filter((s) => !connues.has(s.sessionId) || (s.urgent && !deja.has(s.sessionId))).map((s) => s.sessionId)
  const montees = new Set(enTete)
  return [...enTete, ...precedent.filter((id) => presentes.has(id) && !montees.has(id))]
}
