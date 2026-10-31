import { useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPost } from '../lib/api'
import { confirmDialog, toast } from '../lib/dialog'
import { initialSelection, fits, type Filters, type Overview, type Rules, type Run } from '../lib/sandbox'
import '../components/ctl.css'
import { Bar, Btn, Card, Chip, Loader, PageTitle } from '../components/ui'
import { Comparison, RulesResult } from '../components/sandbox/Results'
import { History } from '../components/sandbox/History'

const MODELS_KEY = 'neutroncore_sandbox_models' // guard:allow cle localStorage
const FILTERS_KEY = 'neutroncore_sandbox_filters' // guard:allow cle localStorage
const DEFAULT_FILTERS: Filters = { level: 'tous', kind: 'tous' }

function load<T>(key: string, fallback: T): T {
  try { return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback } catch { return fallback }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* stockage indisponible : le reglage n'est pas retenu */ }
}

type Out = { text: string; rules: Rules; runs?: Run[] }

export function Sandbox() {
  const [ov, setOv] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [filters, setFilters] = useState<Filters>(() => load(FILTERS_KEY, DEFAULT_FILTERS))
  const [out, setOut] = useState<Out | null>(null)
  const [busy, setBusy] = useState<'' | 'rules' | 'compare'>('')

  async function refresh() {
    try {
      const o = await apiGet<Overview>('/lyra/sandbox')
      setOv(o)
      setPicked((p) => (p.length ? p : initialSelection(o.models, load<string[]>(MODELS_KEY, []))))
    } catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { void refresh() }, [])
  useEffect(() => save(FILTERS_KEY, filters), [filters])

  const toggle = (name: string) => setPicked((p) => {
    const next = p.includes(name) ? p.filter((n) => n !== name) : [...p, name].slice(0, 4)
    save(MODELS_KEY, next)
    return next
  })

  async function run(kind: 'rules' | 'compare') {
    if (!text.trim() || busy) return
    setBusy(kind); setError('')
    try {
      const r = await apiPost<{ success: boolean; error?: string; text: string; rules: Rules; runs?: Run[] }>(
        kind === 'rules' ? '/lyra/sandbox/analyze' : '/lyra/sandbox/compare',
        kind === 'rules' ? { text } : { text, models: picked })
      if (!r.success) setError(r.error ?? 'essai impossible')
      else setOut({ text: r.text, rules: r.rules, runs: r.runs })
      await refresh()
    } catch (e) { setError((e as Error).message) } finally { setBusy('') }
  }

  async function clear() {
    if (!await confirmDialog({ title: 'vider l’historique', body: 'Les essais enregistrés seront effacés.', ok: 'vider', danger: true })) return
    await apiDelete('/lyra/sandbox/history')
    toast('historique vidé')
    await refresh()
  }

  const vram = ov?.vram ?? null
  const usedPct = vram ? Math.round((vram.used_mb / vram.total_mb) * 100) : 0
  return (
    <>
      <PageTitle help="sandbox" title="bac à sable" desc="Teste une phrase contre les règles de Lyra et compare des modèles locaux. Rien n’est jamais exécuté ici." />
      <div className="nc-scope nc-stack">
      {error && <div className="card" style={{ color: 'var(--crit)', fontFamily: 'var(--mono)', fontSize: 12 }}>{error}</div>}
      <Card title="phrase à tester">
        <div style={{ display: 'grid', gap: 10 }}>
          <input aria-label="Phrase à tester" placeholder="allume la télé" value={text} maxLength={ov?.max_text ?? 200}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void run('rules') }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Btn solid disabled={!text.trim() || !!busy} onClick={() => void run('rules')}>{busy === 'rules' ? 'analyse…' : 'analyser (règles)'}</Btn>
            <Btn disabled={!text.trim() || !!busy || !picked.length || !ov?.ollama} onClick={() => void run('compare')}>{busy === 'compare' ? 'modèles en cours…' : `comparer ${picked.length} modèle(s)`}</Btn>
            <Chip tone="ok">analyse seule : aucune exécution</Chip>
          </div>
        </div>
      </Card>
      <Card title="modèles locaux (ollama)">
        {!ov ? <Loader /> : !ov.ollama ? <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--warn)' }}>ollama injoignable : seule l’analyse par les règles est disponible</span> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {vram && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>VRAM libre {vram.free_mb} Mo sur {vram.total_mb}<Bar pct={usedPct} tone={usedPct > 85 ? 'crit' : usedPct > 60 ? 'warn' : 'ok'} /></div>}
            {!vram && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--warn)' }}>VRAM illisible : aucun modèle ne sera chargé</span>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ov.models.map((m) => (
                <label key={m.name} className="chip" style={{ cursor: 'pointer', opacity: fits(m, vram) ? 1 : 0.5 }} title={`${m.size_mb} Mo, environ ${m.need_mb} Mo en VRAM`}>
                  <input type="checkbox" checked={picked.includes(m.name)} onChange={() => toggle(m.name)} /> {m.name} ({Math.round(m.need_mb / 100) / 10} Go)
                </label>
              ))}
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)' }}>vérifié avant chaque chargement, déchargé juste après la réponse (4 modèles au plus)</span>
          </div>
        )}
      </Card>
      {out && (
        <Card title={`résultat : « ${out.text} »`}>
          <div style={{ display: 'grid', gap: 14 }}>
            <RulesResult rules={out.rules} />
            {out.runs && <Comparison runs={out.runs} ruleTool={out.rules.tool} />}
          </div>
        </Card>
      )}
      <Card title="historique des essais">
        <History items={ov?.history ?? []} filters={filters} onFilters={setFilters} onPick={setText} onClear={() => void clear()} />
      </Card>
      </div>
    </>
  )
}
