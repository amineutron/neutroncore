import { useState } from 'react'
import { apiPost, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { profileLabel, type DvFailure } from '../../lib/dv'
import { Btn, Card, Chip } from '../ui'

const when = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '-')

function Failure({ f, onDone }: { f: DvFailure; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [open, setOpen] = useState(false)

  async function relaunch() {
    const ok = await confirmDialog({
      title: `relancer la conversion de ${f.title} ?`,
      body: 'dv_convert.py repart depuis la première étape sur ce fichier. L\'original n\'est remplacé qu\'en cas de succès (une sauvegarde est gardée).',
      ok: 'relancer',
    })
    if (!ok) return
    setBusy(true)
    try {
      await apiPost(`/dv/echecs/${encodeURIComponent(f.key)}/relancer`, undefined, await withConfirm('dv_relancer'))
      setSent(true)
      toast(`conversion relancée : ${f.title}`)
      onDone()
    } catch (e) {
      toast(`relance impossible : ${(e as Error).message}`, 'crit')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>{f.title}</b>
        <Chip>{profileLabel(f.profile)}</Chip>
        {f.step != null && <Chip tone="warn">étape {f.step}{f.step_name ? ` : ${f.step_name}` : ''}</Chip>}
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{when(f.when)}</span>
        <span style={{ flex: 1 }} />
        {sent ? <Chip tone="ok">relancée</Chip> : f.can_relaunch
          ? <Btn sm solid disabled={busy} onClick={relaunch}>{busy ? 'relance...' : 'relancer'}</Btn>
          : <span title={f.relaunch_reason}><Chip>relance indisponible</Chip></span>}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 12.5 }}>{f.cause}</p>
      {!f.can_relaunch && f.relaunch_reason && <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>{f.relaunch_reason}</p>}
      {f.ambiguous && (
        <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--warn)' }}>
          Plusieurs conversions tournaient en même temps : le journal ne nomme pas le film fautif, l'attribution est approximative.
        </p>
      )}
      {f.excerpt.length > 0 && (
        <>
          <button className="chip" style={{ marginTop: 6 }} onClick={() => setOpen(!open)}>{open ? 'masquer le journal' : 'voir le journal'}</button>
          {open && <pre className="mono" style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{f.excerpt.join('\n')}</pre>}
        </>
      )}
    </div>
  )
}

export function DvFailures({ items, days, onDone }: { items: DvFailure[]; days: number; onDone: () => void }) {
  return (
    <Card title="échecs" lite={`${items.length} sur ${days} j`}>
      {items.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 12, margin: 0 }}>Aucun échec sur cette période.</p>}
      {items.map((f) => <Failure key={f.key} f={f} onDone={onDone} />)}
    </Card>
  )
}
