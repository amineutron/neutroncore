import { useState } from 'react'
import { jobDuration, jobLabel, type Job } from '../../lib/vmsConsole'
import { Card, Chip } from '../ui'

// Travaux en cours et termines (clone, export, snapshot...), sortie depliable.
export function Jobs({ jobs }: { jobs: Job[] }) {
  const [open, setOpen] = useState('')
  if (jobs.length === 0) return null
  return (
    <Card title="travaux" lite={`${jobs.filter((j) => j.status === 'running').length} en cours`}>
      {jobs.slice(0, 8).map((j) => (
        <div key={j.id} style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(open === j.id ? '' : j.id)}>
            <Chip tone={j.status === 'ok' ? 'ok' : j.status === 'fail' ? 'crit' : 'gold'}>{j.status === 'running' ? 'en cours' : j.status === 'ok' ? 'réussi' : 'échec'}</Chip>
            <span className="mono">{jobLabel(j.action)} - {j.vm}</span>
            <span className="lite">{jobDuration(j)}</span>
          </div>
          {j.status === 'running' && <div className="ag-progress vm-progress"><i /></div>}
          {open === j.id && (j.message || j.error) && (
            <pre className="mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto' }}>{j.error ? `${j.error}\n` : ''}{j.message}</pre>
          )}
        </div>
      ))}
    </Card>
  )
}
