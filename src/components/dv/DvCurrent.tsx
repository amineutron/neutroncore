import { Bar, Card, Chip } from '../ui'
import { STATE_LABEL, fmtSeconds, type DvLive } from '../../lib/dv'

const GLYPH = { pending: '-', running: '>', done: '+', error: 'x' } as const

function Steps({ c }: { c: DvLive }) {
  return (
    <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 3 }}>
      {c.steps.map((s) => (
        <li key={s.n} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 8, fontSize: 12, alignItems: 'baseline',
          color: s.status === 'pending' ? 'var(--faint)' : 'var(--text)' }}>
          <span className="mono" style={{ color: s.status === 'running' ? 'var(--gold)' : undefined }}>{GLYPH[s.status]}</span>
          <span>{c.steps.length > 1 ? `${s.n}/${c.steps.length} ` : ''}{s.name}
            {s.status === 'running' && s.note && <span className="mono" style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 11 }}>{s.note}</span>}
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{s.status === 'pending' ? '' : fmtSeconds(s.seconds)}</span>
        </li>
      ))}
    </ol>
  )
}

function Conversion({ c }: { c: DvLive }) {
  const running = c.state === 'running' || c.state === 'paused'
  const stepTitle = c.current_step ? c.steps.find((s) => s.n === c.current_step) : undefined
  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>{c.title}</b>
        {c.profile && <Chip>{c.profile}</Chip>}
        {c.size && <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{c.size}</span>}
        <span style={{ flex: 1 }} />
        <Chip tone={c.state === 'paused' ? 'warn' : running ? 'gold' : undefined}>{STATE_LABEL[c.state]}</Chip>
      </div>
      {running ? (
        <>
          <div style={{ margin: '8px 0 2px' }}><Bar pct={c.progress} /></div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>{c.progress.toFixed(1)} %</span>
            {stepTitle && <span>étape {stepTitle.n}/{c.steps.length}</span>}
            <span>écoulé {fmtSeconds(c.elapsed_s)}</span>
            <span>{c.eta_s != null ? `reste ~${fmtSeconds(c.eta_s)}` : 'estimation après 3 %'}</span>
          </div>
          <Steps c={c} />
        </>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>
          {c.phase === 'detection DV' ? 'analyse du fichier en cours (profil Dolby Vision)' : 'aucune étape démarrée'}
          {c.file && <span className="mono"> - {c.file}</span>} - depuis {fmtSeconds(c.elapsed_s)}
        </p>
      )}
    </div>
  )
}

export function DvCurrent({ current, queue }: { current: DvLive[]; queue: DvLive[] }) {
  return (
    <div className="grid g2">
      <Card title="en cours" lite={`${current.length} conversion${current.length > 1 ? 's' : ''}`}>
        {current.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 12, margin: 0 }}>Aucune conversion en cours.</p>}
        {current.map((c) => <Conversion key={c.id} c={c} />)}
      </Card>
      <Card title="file d'attente" lite={`${queue.length} en attente`}>
        {queue.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 12, margin: 0 }}>Rien en attente.</p>}
        {queue.map((c) => <Conversion key={c.id} c={c} />)}
        {queue.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--faint)', margin: '8px 0 0' }}>
            Les imports arrivent par webhook et démarrent aussitôt : il n'y a pas de file ordonnée, seulement des analyses en attente d'une première étape.
          </p>
        )}
      </Card>
    </div>
  )
}
