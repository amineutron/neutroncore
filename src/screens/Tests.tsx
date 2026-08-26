import { useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { usePoll } from '../lib/poll'
import { Btn, Card, Chip, Eyebrow, Loader, PageTitle } from '../components/ui'

type Kind = { kind: string; label: string; desc: string; targets: string[] }
type SummaryRow = { label: string; value: string; tone: 'ok' | 'warn' | 'crit' | 'neutral' }
type Run = {
  id: string; kind: string; targets: string[]
  status: 'running' | 'ok' | 'fail'; rc: number | null
  started: number; ended: number | null; output?: string
  summary?: SummaryRow[]
}

// chips de synthèse (classification faite côté backend, testée anti-faux-positifs)
function SummaryChips({ rows }: { rows: SummaryRow[] }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
      {rows.map((r, i) => (
        <span key={i} className={`chip ${r.tone === 'neutral' ? '' : r.tone}`}>
          {r.label} : {r.value}
        </span>
      ))}
    </span>
  )
}

function fmtDur(run: Run): string {
  const end = run.ended ?? Date.now() / 1000
  const s = Math.round(end - run.started)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}

export function Tests() {
  const catalog = usePoll<{ kinds: Kind[] }>(() => apiGet('/tests/catalog'), 60000)
  const runs = usePoll<{ runs: Run[] }>(() => apiGet('/tests/runs'), 3000)
  // cibles cochées par suite (vide = toutes)
  const [sel, setSel] = useState<Record<string, string[]>>({})
  const [outputRun, setOutputRun] = useState<Run | null>(null)
  const [err, setErr] = useState('')

  const anyRunning = (runs.data?.runs ?? []).some((r) => r.status === 'running')

  const toggle = (kind: string, target: string) =>
    setSel((s) => {
      const cur = s[kind] ?? []
      return { ...s, [kind]: cur.includes(target) ? cur.filter((t) => t !== target) : [...cur, target] }
    })

  async function launch(kind: string) {
    setErr('')
    try {
      await apiPost('/tests/run', { kind, targets: sel[kind] ?? [] })
      runs.refresh()
    } catch (e) {
      setErr((e as Error).message.includes('409') ? 'Un run est déjà en cours — attends la fin.' : (e as Error).message)
    }
  }

  async function showOutput(id: string) {
    try { setOutputRun(await apiGet<Run>(`/tests/runs/${id}`)) } catch { /* run purgé */ }
  }

  return (
    <>
      <PageTitle help="tests" title="tests" desc="Lancer les suites de test — en entier, ou sur les cibles sélectionnées." />
      {err && <div style={{ marginBottom: 12 }}><Chip tone="crit">{err}</Chip></div>}
      {catalog.data === null && <Loader label="chargement du catalogue…" />}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div>
          {(catalog.data?.kinds ?? []).map((k) => {
            const chosen = sel[k.kind] ?? []
            const last = (runs.data?.runs ?? []).find((r) => r.kind === k.kind)
            return (
              <Card key={k.kind} title={k.label} lite={k.desc} style={{ marginBottom: 12 }}>
                {k.targets.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {k.targets.map((t) => (
                      <span
                        key={t}
                        className={`chip ${chosen.includes(t) ? 'gold' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggle(k.kind, t)}
                      >
                        {chosen.includes(t) ? '[x] ' : '[ ] '}{t}
                      </span>
                    ))}
                    {k.targets.length > 3 && chosen.length < k.targets.length && (
                      <span className="chip" style={{ cursor: 'pointer' }}
                        onClick={() => setSel((s) => ({ ...s, [k.kind]: [...k.targets] }))}>
                        tout sélectionner
                      </span>
                    )}
                    {chosen.length > 0 && (
                      <span className="chip" style={{ cursor: 'pointer' }}
                        onClick={() => setSel((s) => ({ ...s, [k.kind]: [] }))}>
                        tout désélectionner
                      </span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Btn sm solid disabled={anyRunning} onClick={() => launch(k.kind)}>
                    lancer {chosen.length > 0 ? `(${chosen.length} cible${chosen.length > 1 ? 's' : ''})` : k.targets.length > 0 ? '(tout)' : ''}
                  </Btn>
                  {last && (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`dot ${last.status === 'running' ? 'warn' : last.status === 'ok' ? 'ok' : 'crit'}`} />
                      {last.status === 'running' ? `en cours · ${fmtDur(last)}` : `${last.status === 'ok' ? 'réussi' : 'échec'} · ${fmtDur(last)}`}
                      {last.status !== 'running' && (
                        <span className="x" style={{ cursor: 'pointer', color: 'var(--gold)' }} onClick={() => showOutput(last.id)}>sortie</span>
                      )}
                    </span>
                  )}
                </div>
                {last && last.status !== 'running' && (last.summary?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 8 }}><SummaryChips rows={last.summary!} /></div>
                )}
              </Card>
            )
          })}
        </div>
        <div>
          <Eyebrow>historique des runs</Eyebrow>
          <Card>
            {runs.data === null && <Loader label="chargement…" />}
            {(runs.data?.runs ?? []).slice(0, 10).map((r) => (
              <div key={r.id} className="logline" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: r.status !== 'running' ? 'pointer' : 'default' }}
                onClick={() => r.status !== 'running' && showOutput(r.id)}>
                <span className={`dot ${r.status === 'running' ? 'warn' : r.status === 'ok' ? 'ok' : 'crit'}`} />
                <b>{r.kind}</b>
                <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.targets.length > 0 ? r.targets.join(', ') : 'tout'}
                </span>
                <span style={{ color: 'var(--faint)' }}>{fmtDur(r)}</span>
              </div>
            ))}
            {runs.data !== null && (runs.data?.runs ?? []).length === 0 && (
              <span style={{ color: 'var(--faint)', fontSize: 12 }}>Aucun run pour l'instant — lance une suite à gauche.</span>
            )}
          </Card>
        </div>
      </div>
      {outputRun && (
        <div className="pre-modal" onClick={() => setOutputRun(null)}>
          <div className="inner" onClick={(e) => e.stopPropagation()}>
            <div className="head">
              {outputRun.kind} — {outputRun.status === 'ok' ? 'réussi' : 'échec'} ({fmtDur(outputRun)})
              <span style={{ flex: 1 }} />
              <span className="x" onClick={() => setOutputRun(null)}>fermer</span>
            </div>
            <pre>{outputRun.output || '(sortie vide)'}</pre>
            {(outputRun.summary?.length ?? 0) > 0 && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line2)' }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>synthèse</div>
                <SummaryChips rows={outputRun.summary!} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
