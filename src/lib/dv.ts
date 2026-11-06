// Suivi des conversions Dolby Vision : types de GET /dv et logique pure de l'écran.

export type DvStep = { n: number; name: string; status: 'pending' | 'running' | 'done' | 'error'; note: string; seconds: number | null }
export type DvLive = {
  id: string; title: string; state: 'waiting' | 'running' | 'done' | 'failed' | 'paused'
  profile: string; size: string; file: string; phase: string; steps: DvStep[]
  current_step: number | null; progress: number; elapsed_s: number | null; eta_s: number | null
}
export type DvHistoryItem = {
  key: string; title: string; profile: number | null; mode: 'dv' | 'p5'; outcome: 'converted' | 'failed'
  started: string; ended: string | null; seconds: number | null; steps: { n: number; seconds: number | null }[]
}
export type DvFailure = {
  key: string; title: string; file: string; profile: number | null; when: string | null
  step: number | null; step_name: string | null; cause: string; raw: string | null
  session_id: string | null; ambiguous: boolean; excerpt: string[]
  can_relaunch: boolean; relaunch_reason: string
}
export type DvStats = {
  converted: number; failed: number; skipped: number; average_s: number | null
  longest_s: number | null; last_conversion: string | null; journal_since: string | null
}
export type DvOverview = {
  now: string; tracking_ok: boolean; journal_ok: boolean
  current: DvLive[]; queue: DvLive[]; history: DvHistoryItem[]; failures: DvFailure[]; stats: DvStats
}

export type HistoryFilter = 'tout' | 'convertis' | 'échecs'
export const HISTORY_FILTERS: HistoryFilter[] = ['tout', 'convertis', 'échecs']
export const FILTER_KEY = 'neutroncore_dv_filtre'
export const DAYS_KEY = 'neutroncore_dv_jours'
export const DAYS_CHOICES = [7, 30, 90, 365]

/** 42 s, 12 min 03 s, 1 h 05 min ; null -> « - » */
export function fmtSeconds(s: number | null | undefined): string {
  if (s == null) return '-'
  if (s < 60) return `${Math.round(s)} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

/** Durée compacte pour les tableaux étroits : « 34 min 28 s » devient « 34m28 », « 1 h 05 min » « 1h05 ». */
export function fmtCourt(s: number | null | undefined): string {
  if (s == null) return '-'
  if (s < 60) return `${Math.round(s)} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${String(Math.floor(s % 60)).padStart(2, '0')}`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/** La répartition par étape n'a de sens que pour une conversion réussie : un échec n'a pas de barre. */
export function showShareBar(outcome: string): boolean {
  return outcome === 'converted'
}

export function filterHistory(items: DvHistoryItem[], f: HistoryFilter): DvHistoryItem[] {
  if (f === 'convertis') return items.filter((h) => h.outcome === 'converted')
  if (f === 'échecs') return items.filter((h) => h.outcome === 'failed')
  return items
}

/** Part de chaque étape dans la durée totale (barre empilée de l'historique) ; étapes sans durée ignorées. */
export function stepShares(steps: { n: number; seconds: number | null }[]): { n: number; pct: number }[] {
  const known = steps.filter((s) => s.seconds != null && s.seconds > 0)
  const total = known.reduce((a, s) => a + (s.seconds as number), 0)
  return total > 0 ? known.map((s) => ({ n: s.n, pct: ((s.seconds as number) / total) * 100 })) : []
}

export const STATE_LABEL: Record<DvLive['state'], string> = {
  waiting: 'en attente', running: 'en cours', done: 'terminée', failed: 'en échec', paused: 'en pause',
}

export function stepTone(status: DvStep['status']): 'ok' | 'gold' | 'crit' | undefined {
  if (status === 'done') return 'ok'
  if (status === 'running') return 'gold'
  if (status === 'error') return 'crit'
  return undefined
}

export function profileLabel(p: number | null): string {
  return p == null ? 'DV' : p === 5 ? 'P5 vers HDR10' : `P${p} vers P8`
}

/** Lecture d'une préférence texte validée contre une liste ; stockage indisponible ou valeur inconnue -> défaut. */
export function readChoice<T extends string | number>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    const found = allowed.find((a) => String(a) === raw)
    return found ?? fallback
  } catch { return fallback }
}

export function saveChoice(key: string, value: string | number): void {
  try { localStorage.setItem(key, String(value)) } catch { /* stockage indisponible */ }
}
