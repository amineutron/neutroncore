import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { Bar, Card, Chip, Eyebrow } from './ui'

// Feuille de route GitHub : lue par project-tracker (issues du dépôt privé de suivi),
// relayée par lyra-control-api. La vérité est sur GitHub ; ici on regarde, on ne modifie pas.

export type RoadmapItem = {
  number: number; key: string; title: string; status: 'pending' | 'running' | 'done'
  waiting: boolean; owner: string; effort: string; url: string
}
export type RoadmapPhase = {
  key: string; title: string; horizon: string; done: number; total: number; percent: number
  running: number; waiting: number; items: RoadmapItem[]
}
export type RoadmapData = {
  repo: string; generated_at: string
  totals: { done: number; total: number; percent: number; waiting: number }
  phases: RoadmapPhase[]; next: RoadmapItem[]; waiting: RoadmapItem[]
}

export function useRoadmap() {
  return usePoll<RoadmapData>(() => apiGet('/roadmap'), 60000)
}

function tone(p: RoadmapPhase): 'ok' | 'warn' | undefined {
  if (p.percent >= 100) return 'ok'
  if (p.waiting > 0) return 'warn'
  return undefined
}

export function Roadmap() {
  const rm = useRoadmap()
  const d = rm.data
  if (rm.error && !d) {
    return (
      <Card title="feuille de route" lite="GitHub">
        <div className="muted">project-tracker injoignable (127.0.0.1:8766).</div>
      </Card>
    )
  }
  if (!d) return <Card title="feuille de route" lite="GitHub"><div className="muted">chargement…</div></Card>
  return (
    <Card title="feuille de route" lite={`${d.totals.done} / ${d.totals.total} faites`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}><Bar pct={d.totals.percent} tone={d.totals.percent >= 100 ? 'ok' : undefined} /></div>
        <span className="num">{d.totals.percent} %</span>
        {d.totals.waiting > 0 && <Chip tone="warn">{d.totals.waiting} en attente de toi</Chip>}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {d.phases.map((p) => (
          <div key={p.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px auto', gap: 10, alignItems: 'center' }}>
            <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.horizon}>{p.title}</div>
            <Bar pct={p.percent} tone={tone(p)} />
            <span className="num" style={{ whiteSpace: 'nowrap' }}>
              {p.done}/{p.total}{p.running > 0 && <small> · {p.running} en cours</small>}{p.waiting > 0 && <small> · {p.waiting} attend</small>}
            </span>
          </div>
        ))}
      </div>
      {d.waiting.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Eyebrow>en attente de toi</Eyebrow>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {d.waiting.map((i) => (
              <li key={i.number}><a href={i.url} target="_blank" rel="noreferrer">#{i.number}</a> {i.title}</li>
            ))}
          </ul>
        </div>
      )}
      {d.next.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Eyebrow>prochaines actions</Eyebrow>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {d.next.map((i) => (
              <li key={i.number}>
                <a href={i.url} target="_blank" rel="noreferrer">#{i.number}</a> {i.title}
                {i.status === 'running' && <Chip tone="gold">en cours</Chip>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
        source : issues de {d.repo}, mise à jour {d.generated_at.replace('T', ' ').slice(0, 16)}
      </div>
    </Card>
  )
}
