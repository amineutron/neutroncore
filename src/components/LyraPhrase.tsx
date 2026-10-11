import { useState } from 'react'
import { apiPost } from '../lib/api'
import { lyraCall, type LyraArgs, type LyraVerdict } from '../lib/automations'
import type { Step } from '../lib/routines'

// Action « demander à lyra » : on écrit la phrase, Lyra dit ce qu'elle en ferait,
// et c'est CET appel résolu qui est enregistré. Rien n'est réinterprété plus tard :
// tant que la phrase affichée n'est pas celle qui a été analysée, l'action est incomplète.
export function LyraPhrase({ step, label, onChange }: {
  step: Step; label: string; onChange: (patch: { phrase: string; tool: string; arguments: LyraArgs }) => void
}) {
  const [busy, setBusy] = useState(false)
  const [verdict, setVerdict] = useState<LyraVerdict | null>(null)
  const [error, setError] = useState('')
  const phrase = String(step.params.phrase ?? '')
  const tool = String(step.params.tool ?? '')
  const args = (typeof step.params.arguments === 'object' ? step.params.arguments : {}) as LyraArgs

  const analyze = async () => {
    setBusy(true); setError('')
    try {
      const r = await apiPost<LyraVerdict & { success: boolean; error?: string }>('/automations/analyze', { text: phrase.trim() })
      if (!r.success) { setVerdict(null); setError(r.error ?? 'analyse impossible'); return }
      setVerdict(r)
      onChange(r.ok ? { phrase: phrase.trim(), tool: r.tool, arguments: r.arguments } : { phrase, tool: '', arguments: {} })
    } catch (e) {
      setVerdict(null); setError(e instanceof Error ? e.message : 'analyse impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="lp">
      <input className="bp-text" value={phrase} maxLength={200} placeholder="une commande, ex. « allume la télé »" aria-label={`Phrase pour lyra : ${label}`}
        // la phrase change : l'ancien appel résolu ne vaut plus, il faut la faire analyser de nouveau
        onChange={(e) => { setVerdict(null); setError(''); onChange({ phrase: e.target.value, tool: '', arguments: {} }) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && phrase.trim() && !busy) { e.preventDefault(); void analyze() } }} />
      <button type="button" className="btn sm" disabled={busy || !phrase.trim()} onClick={() => void analyze()}>{busy ? '…' : tool ? 'réanalyser' : 'analyser'}</button>
      <span className="lp-out" role="status">
        {tool && <span className="lp-ok">lyra fera : <b>{lyraCall(tool, args)}</b></span>}
        {!tool && verdict && !verdict.ok && <span className="lp-ko">{verdict.reason}</span>}
        {!tool && !verdict && !error && phrase.trim() && <span className="lp-wait">à faire analyser avant d'enregistrer</span>}
        {error && <span className="lp-ko">{error}</span>}
        {(verdict?.warnings ?? []).filter(() => Boolean(tool)).map((w) => <span key={w} className="lp-warn">{w}</span>)}
      </span>
    </span>
  )
}
