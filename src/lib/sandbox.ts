// Bac a sable de prompts : types de l'API /lyra/sandbox et logique d'affichage pure.
// Rien ici n'execute quoi que ce soit : l'ecran n'appelle que /lyra/sandbox/*.

export type Level = 'sur' | 'confirmation' | 'destructif' | 'manuel' | 'incomplet' | 'compose' | 'refuse' | 'inconnu' | 'injoignable'

export type Rules = {
  level: Level; label: string; reason: string; tool: string; arguments: Record<string, unknown>
  warnings: string[]; automatable: boolean; confidence: number | null; missing_args: string[]
}
export type Vram = { used_mb: number; total_mb: number; free_mb: number }
export type Model = { name: string; size_mb: number; need_mb: number; default: boolean }
export type Proposal = { valid: boolean; tool: string; arguments: Record<string, unknown>; note: string }
export type Run = {
  model: string; skipped: boolean; reason?: string; ms?: number; error?: string; raw?: string
  proposal?: Proposal; agreement?: string
}
export type HistoryEntry = {
  ts: number; kind: 'rules' | 'compare'; text: string; level: Level; tool: string; arguments?: Record<string, unknown>
  runs?: { model: string; ms?: number; skipped: boolean; tool: string; agreement: string }[]
}
export type Overview = { models: Model[]; ollama: boolean; vram: Vram | null; history: HistoryEntry[]; max_text: number }

export type Tone = 'ok' | 'warn' | 'crit' | 'gold'

export function levelTone(level: Level): Tone {
  switch (level) {
    case 'sur': return 'ok'
    case 'destructif': case 'confirmation': return 'crit'
    case 'injoignable': case 'refuse': return 'crit'
    default: return 'warn'
  }
}

export function fmtMs(ms: number | undefined): string {
  if (ms === undefined) return '-'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export function fmtArgs(args: Record<string, unknown> | undefined): string {
  const entries = Object.entries(args ?? {})
  return entries.length ? entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ') : 'aucun'
}

// Le modele le plus rapide parmi ceux qui ont repondu avec une proposition valide.
export function fastest(runs: Run[]): string | null {
  const valid = runs.filter((r) => !r.skipped && !r.error && r.proposal?.valid && r.ms !== undefined)
  if (!valid.length) return null
  return valid.reduce((a, b) => ((b.ms as number) < (a.ms as number) ? b : a)).model
}

// Modeles coches au depart : la selection retenue (si elle existe encore), sinon les modeles par defaut.
export function initialSelection(models: Model[], saved: string[]): string[] {
  const names = new Set(models.map((m) => m.name))
  const keep = saved.filter((n) => names.has(n))
  return keep.length ? keep : models.filter((m) => m.default).map((m) => m.name)
}

// Un modele tient-il dans la VRAM libre ? (meme regle que l'API, pour griser avant d'essayer)
export function fits(model: Model, vram: Vram | null): boolean {
  return vram !== null && vram.free_mb >= model.need_mb
}

export type Filters = { level: 'tous' | 'a-risque' | 'sur'; kind: 'tous' | 'rules' | 'compare' }

export function filterHistory(items: HistoryEntry[], f: Filters): HistoryEntry[] {
  return items
    .filter((e) => (f.kind === 'tous' ? true : e.kind === f.kind))
    .filter((e) => (f.level === 'tous' ? true : f.level === 'sur' ? e.level === 'sur' : e.level !== 'sur'))
    .slice()
    .reverse()
}
