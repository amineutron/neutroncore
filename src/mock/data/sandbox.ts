// Bac a sable de prompts de demonstration : quelques phrases connues, des modeles fictifs, historique en memoire.
// Rien d'execute, rien de reel. A enregistrer dans src/mock/routes.ts (voir INTEGRATION.md).
import type { MockHandler } from '../router'
import type { HistoryEntry, Level, Rules } from '../../lib/sandbox'

const CASES: Record<string, { level: Level; label: string; reason: string; tool: string; args: Record<string, unknown>; auto: boolean }> = {
  'allume la télé': { level: 'sur', label: 'sans risque : executable seul', reason: 'outil sans confirmation, arguments dans les plafonds', tool: 'tv.power_on', args: {}, auto: true },
  'arrête la vm test': { level: 'confirmation', label: 'action sensible : confirmation humaine obligatoire', reason: 'l’outil figure dans la liste des outils dangereux de lyra', tool: 'fedora.vm_stop', args: { vm_name: 'test' }, auto: false },
}

const rules = (text: string): Rules => {
  const c = CASES[text.trim().toLowerCase()]
  return c
    ? { level: c.level, label: c.label, reason: c.reason, tool: c.tool, arguments: c.args, warnings: [], automatable: c.auto, confidence: 0.9, missing_args: [] }
    : { level: 'inconnu', label: 'aucune regle ne reconnait la phrase', reason: 'lyra ne reconnait pas cette phrase', tool: '', arguments: {}, warnings: ['Aucune règle ne reconnaît cette phrase.'], automatable: false, confidence: null, missing_args: [] }
}

let history: HistoryEntry[] = []
const push = (e: Omit<HistoryEntry, 'ts'>) => { history = [...history, { ...e, ts: Date.now() / 1000 }].slice(-200) }

const MODELS = [
  { name: 'qwen2.5-coder:7b', size_mb: 4400, need_mb: 6300, default: true },
  { name: 'llama3.2:3b', size_mb: 1900, need_mb: 3200, default: true },
  { name: 'qwen2.5-coder:14b', size_mb: 8700, need_mb: 11700, default: false },
]

export const sandbox: [string, string, MockHandler][] = [
  ['GET', '/lyra/sandbox', () => ({ models: MODELS, ollama: true, vram: { used_mb: 1400, total_mb: 12288, free_mb: 10888 }, history, max_text: 200 })],
  ['POST', '/lyra/sandbox/analyze', ({ body }) => {
    const text = String((body as { text?: string })?.text ?? '').trim()
    const r = rules(text)
    push({ kind: 'rules', text, level: r.level, tool: r.tool, arguments: r.arguments })
    return { success: true, text, rules: r }
  }],
  ['POST', '/lyra/sandbox/compare', ({ body }) => {
    const { text, models } = body as { text: string; models: string[] }
    const r = rules(text)
    const runs = models.map((m, i) => {
      const big = MODELS.find((x) => x.name === m)?.need_mb ?? 0
      if (big > 10888) return { model: m, skipped: true, reason: 'VRAM libre insuffisante : 10888 Mo libres, ' + big + ' Mo necessaires' }
      return { model: m, skipped: false, ms: 1800 + i * 1500, raw: '', proposal: { valid: !!r.tool, tool: r.tool, arguments: r.arguments, note: r.tool ? '' : 'le modele ne propose aucun outil' }, agreement: r.tool ? 'accord' : 'sans reference' }
    })
    push({ kind: 'compare', text, level: r.level, tool: r.tool, runs: runs.map((x) => ({ model: x.model, ms: x.ms, skipped: x.skipped, tool: x.proposal?.tool ?? '', agreement: x.agreement ?? '' })) })
    return { success: true, text, rules: r, runs }
  }],
  ['DELETE', '/lyra/sandbox/history', () => { history = []; return { success: true } }],
  ['GET', '/lyra/stt', () => ({ available: false, max_bytes: 0, engine: 'demo' })],
]
