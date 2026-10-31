import { Chip } from '../ui'
import { fastest, fmtArgs, fmtMs, levelTone, type Rules, type Run } from '../../lib/sandbox'

const MONO = { fontFamily: 'var(--mono)', fontSize: 12 } as const

export function RulesResult({ rules }: { rules: Rules }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div><Chip tone={levelTone(rules.level)}>{rules.level}</Chip> <span style={{ color: 'var(--muted)', fontSize: 12 }}>{rules.label}</span></div>
      <div style={MONO}>outil : <b>{rules.tool || 'aucun'}</b></div>
      <div style={MONO}>arguments : {fmtArgs(rules.arguments)}</div>
      {rules.confidence !== null && rules.confidence !== undefined && <div style={MONO}>confiance de la règle : {rules.confidence}</div>}
      <div style={{ ...MONO, color: 'var(--muted)' }}>raison : {rules.reason}</div>
      <div style={{ ...MONO, color: rules.automatable ? 'var(--ok)' : 'var(--muted)' }}>
        {rules.automatable ? 'acceptée dans une automatisation (action « demander à lyra »)' : 'refusée dans une automatisation'}
      </div>
      {rules.warnings.map((w) => <div key={w} style={{ ...MONO, color: 'var(--warn)' }}>{w}</div>)}
    </div>
  )
}

export function Comparison({ runs, ruleTool }: { runs: Run[]; ruleTool: string }) {
  const best = fastest(runs)
  return (
    <div className="scroll-x">
      <table style={{ ...MONO, width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
        <thead><tr style={{ textAlign: 'left', color: 'var(--muted)' }}><th>modèle</th><th>temps</th><th>outil proposé</th><th>arguments</th><th>vs règle ({ruleTool || 'aucune'})</th></tr></thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.model} style={{ borderTop: '1px solid var(--line2)' }}>
              <td>{r.model}{best === r.model && <> <Chip tone="gold">plus rapide</Chip></>}</td>
              {r.skipped ? <td colSpan={4} style={{ color: 'var(--warn)' }}>non lancé : {r.reason}</td> : (
                <>
                  <td>{fmtMs(r.ms)}</td>
                  <td>{r.proposal?.valid ? r.proposal.tool : <span style={{ color: 'var(--crit)' }}>{r.proposal?.note || r.error}</span>}</td>
                  <td>{r.proposal?.valid ? fmtArgs(r.proposal.arguments) : '-'}</td>
                  <td><Chip tone={r.agreement === 'accord' ? 'ok' : r.agreement === 'desaccord' ? 'crit' : 'warn'}>{r.agreement}</Chip></td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ ...MONO, color: 'var(--faint)', marginTop: 6 }}>la proposition d’un modèle n’est ni classée ni exécutée : seules les règles du démon décident.</div>
    </div>
  )
}
