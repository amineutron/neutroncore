import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { Bar, Card, Chip, Loader } from './ui'

type Queue = {
  count: number; progress: number; downloading: number; queued: number
  import_pending: number; import_blocked: number; warnings: string[]
}
type Item = {
  id: number; kind: 'movie' | 'tv'; title: string; year?: number
  state: 'import_blocked' | 'import_pending' | 'downloading' | 'queued' | 'searching' | 'unreleased'
  have?: number; total?: number; release?: string; queue: Queue | null
}

const STATE: Record<Item['state'], { label: string; tone?: 'gold' | 'ok' | 'warn' | 'crit' }> = {
  import_blocked: { label: 'import bloqué', tone: 'crit' },
  import_pending: { label: 'import en attente', tone: 'warn' },
  downloading: { label: 'téléchargement', tone: 'gold' },
  queued: { label: 'en file' },
  searching: { label: 'en recherche' },
  unreleased: { label: 'pas encore sorti' },
}
// un exécutable dans un « épisode » = fausse release (malware Windows)
const isSuspicious = (w: string) => /\.(exe|scr|lnk|bat|msi)\b/i.test(w)

function Row({ it }: { it: Item }) {
  const st = STATE[it.state]
  const q = it.queue
  const pct = it.kind === 'tv' && it.total ? ((it.have ?? 0) / it.total) * 100 : q?.progress ?? 0
  const suspicious = (q?.warnings ?? []).some(isSuspicious)
  return (
    <div className="inc-row">
      <div className="inc-head">
        <b>{it.title}</b>
        <span className="inc-sub">{it.kind === 'tv' ? 'série' : 'film'}{it.year ? ` · ${it.year}` : ''}</span>
        <span style={{ flex: 1 }} />
        {suspicious && <Chip tone="crit">fichier suspect</Chip>}
        <Chip tone={st.tone}>{st.label}</Chip>
      </div>
      {(it.kind === 'tv' || q) && <Bar pct={pct} tone={it.state === 'import_blocked' ? 'crit' : undefined} />}
      <div className="inc-detail">
        {it.kind === 'tv' && <span>{it.have}/{it.total} épisodes sur le pc</span>}
        {q && (
          <span>
            {q.count} en file
            {q.downloading > 0 && ` · ${q.downloading} en cours`}
            {q.import_pending + q.import_blocked > 0 && ` · ${q.import_pending + q.import_blocked} à importer`}
            {` · ${q.progress}% téléchargé`}
          </span>
        )}
        {!q && it.state === 'searching' && <span>aucune release trouvée pour l'instant</span>}
      </div>
      {q?.warnings.map((w) => (
        <div key={w} className={`inc-warn ${isSuspicious(w) ? 'crit' : ''}`}>{w}</div>
      ))}
    </div>
  )
}

// Films et séries suivis qui ne sont pas (encore) entièrement sur le disque.
export function Incoming() {
  const data = usePoll<{ movies: Item[]; series: Item[] }>(() => apiGet('/arr/incoming'), 60000)
  const all = [...(data.data?.series ?? []), ...(data.data?.movies ?? [])]
  const active = all.filter((i) => i.queue)
  const waiting = all.filter((i) => !i.queue && i.state === 'searching')
  const future = all.filter((i) => i.state === 'unreleased')
  return (
    <Card title="pas encore sur le pc" lite={`${active.length} en cours · ${waiting.length} en recherche`} style={{ marginBottom: 14 }}>
      {data.data === null && !data.error && <Loader label="lecture de radarr / sonarr…" />}
      {data.error && <span style={{ color: 'var(--crit)', fontSize: 12 }}>radarr / sonarr injoignable : {data.error}</span>}
      {data.data && all.length === 0 && <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>Tout ce qui est suivi est sur le disque.</span>}
      {[...active, ...waiting].map((it) => <Row key={`${it.kind}-${it.id}`} it={it} />)}
      {future.length > 0 && (
        <details className="inc-future">
          <summary>{future.length} film(s) pas encore sorti(s)</summary>
          {future.map((it) => (
            <div key={it.id} className="inc-sub" style={{ padding: '3px 0' }}>
              {it.title}{it.year ? ` · ${it.year}` : ''} <span style={{ color: 'var(--faint)' }}>({it.release === 'inCinemas' ? 'au cinéma' : 'annoncé'})</span>
            </div>
          ))}
        </details>
      )}
    </Card>
  )
}
