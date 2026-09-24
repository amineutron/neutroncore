import { fmtRemaining } from '../lib/poll'
import { Bar, Btn, Chip } from './ui'

type Item = { name: string; status: string }
type Log = { timestamp: string; message: string }
export type Session = {
  id: string; name: string; template: string; status: string
  processed: number; total: number; unit: string; items: Item[]; logs: Log[]
  extra: Record<string, string>; created_at?: string
  // titre de la série Sonarr (ajouté par l'API) : sert au regroupement
  group?: string
}
export type Entry = { kind: 'one'; s: Session } | { kind: 'group'; key: string; title: string; members: Session[] }

const TPL_TONE: Record<string, 'gold' | 'rose' | 'warn' | undefined> = {
  movie: 'gold', series_episode: 'gold', series_season: 'warn', lyra_task: 'rose',
}
// au-delà, la liste (ex. 245 sous-titres manquants) n'est visible qu'au dépliage
const ITEMS_PREVIEW = 6
const ICON: Record<string, string> = { done: '[ok]', running: '[>>]', error: '[!]', pending: '[ ]' }

// horodatage complet des logs : "24/08 20:24:17" (l'heure seule ne permet
// pas de comparer des taches qui courent sur plusieurs jours)
export function fmtStamp(ts: string, seconds = true): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/.exec(ts)
  if (!m) return ts.slice(0, 19)
  return `${m[3]}/${m[2]} ${m[4]}${seconds && m[5] ? ':' + m[5] : ''}`
}

// Les épisodes d'une même série (2 ou plus) deviennent une seule entrée,
// placée au rang du premier épisode rencontré.
export function groupEntries(list: Session[]): Entry[] {
  const counts = new Map<string, number>()
  for (const s of list) if (s.group) counts.set(s.group, (counts.get(s.group) ?? 0) + 1)
  const groups = new Map<string, Session[]>()
  const out: Entry[] = []
  for (const s of list) {
    if (!s.group || (counts.get(s.group) ?? 0) < 2) { out.push({ kind: 'one', s }); continue }
    const members = groups.get(s.group)
    if (members) { members.push(s); continue }
    const fresh = [s]
    groups.set(s.group, fresh)
    out.push({ kind: 'group', key: `g:${s.group}`, title: s.group, members: fresh })
  }
  return out
}

function groupStatus(members: Session[]): string {
  if (members.some((m) => m.status === 'running')) return 'running'
  if (members.some((m) => m.status === 'error')) return 'error'
  return members.every((m) => m.status === 'done') ? 'done' : members[0].status
}

function speedOf(s: Session): number {
  const m = /([\d.]+)\s*MB\/s/.exec(s.extra?.speed ?? '')
  return m ? parseFloat(m[1]) : 0
}

export function SessRow({ s, opened, busy, onToggle, onRemove }: {
  s: Session; opened: boolean; busy: boolean; onToggle: () => void; onRemove: () => void
}) {
  const pct = s.total > 0 ? (s.processed / s.total) * 100 : 0
  const remaining = s.status === 'running' ? fmtRemaining(s.created_at, pct) : null
  return (
    <div className="sess">
      <div className="head" onClick={onToggle} title="cliquer pour le détail">
        <Chip tone={TPL_TONE[s.template]}>{s.template}</Chip>
        <span className="nm">{s.name}</span>
        {remaining && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--warn)' }}>{remaining}</span>}
        <Chip tone={s.status === 'error' ? 'crit' : s.status === 'done' ? 'ok' : undefined}>{s.status}</Chip>
        <span onClick={(e) => e.stopPropagation()}>
          <Btn sm danger disabled={busy} onClick={onRemove}>suppr</Btn>
        </span>
      </div>
      <Bar pct={s.status === 'done' ? 100 : pct} tone={s.status === 'done' ? 'ok' : s.status === 'error' ? 'crit' : undefined} />
      {opened && (
        <div className="sess-detail">
          <div>
            <b>{Math.round(pct)}%</b> · {s.processed}/{s.total}{s.unit || ''}
            {s.created_at && <> · démarrée {fmtStamp(s.created_at, false)}</>}
          </div>
          {Object.entries(s.extra ?? {}).filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><span style={{ color: 'var(--faint)' }}>{k}</span> : {String(v).slice(0, 80)}</div>
          ))}
          {(s.logs ?? []).slice(-6).map((l, i) => (
            <div className="logline" key={i}><b>{fmtStamp(l.timestamp)}</b> {l.message.slice(0, 110)}</div>
          ))}
          {(s.logs ?? []).length === 0 && <div style={{ color: 'var(--faint)' }}>pas encore de logs</div>}
        </div>
      )}
      {!opened && s.items.length > 0 && (
        <div className="items">
          {s.items.slice(0, ITEMS_PREVIEW).map((it) => (
            <div key={it.name} className={`item ${it.status === 'done' ? 'done' : it.status === 'running' ? 'run' : it.status === 'error' ? 'err' : ''}`}>
              <span className="ic">{ICON[it.status] ?? '[ ]'}</span>
              {it.name}
            </div>
          ))}
          {s.items.length > ITEMS_PREVIEW && (
            <div className="item" style={{ color: 'var(--faint)' }}>
              … {s.items.length - ITEMS_PREVIEW} autres (cliquer pour le détail)
            </div>
          )}
        </div>
      )}
      {opened && s.items.length > 0 && (
        <div className="items sg-items">
          {s.items.map((it) => (
            <div key={it.name} className={`item ${it.status === 'done' ? 'done' : it.status === 'error' ? 'err' : ''}`}>
              <span className="ic">{ICON[it.status] ?? '[ ]'}</span>{it.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Carte repliable d'une série : progression cumulée, puis les épisodes au dépliage.
export function SessGroup({ title, members, opened, openIds, busy, onToggle, onToggleOne, onRemove }: {
  title: string; members: Session[]; opened: boolean; openIds: string[]; busy: boolean
  onToggle: () => void; onToggleOne: (id: string) => void; onRemove: (s: Session) => void
}) {
  const sized = members.filter((m) => m.total > 0)
  const total = sized.reduce((a, m) => a + m.total, 0)
  const done = sized.reduce((a, m) => a + (m.status === 'done' ? m.total : m.processed), 0)
  const pct = total > 0 ? (done / total) * 100 : 0
  const status = groupStatus(members)
  const active = members.filter((m) => speedOf(m) > 0).length
  const speed = members.reduce((a, m) => a + speedOf(m), 0)
  return (
    <div className="sess sess-group">
      <div className="head" onClick={onToggle} title={opened ? 'replier les épisodes' : 'déplier les épisodes'}>
        <span className={`sg-chev ${opened ? 'open' : ''}`} aria-hidden />
        <Chip tone="gold">série</Chip>
        <span className="nm">{title}</span>
        <span className="sg-meta">
          {members.length} torrents{active > 0 && <> · {active} actifs · {speed.toFixed(1)} MB/s</>}
        </span>
        <Chip tone={status === 'error' ? 'crit' : status === 'done' ? 'ok' : undefined}>{status}</Chip>
      </div>
      <Bar pct={status === 'done' ? 100 : pct} tone={status === 'done' ? 'ok' : status === 'error' ? 'crit' : undefined} />
      {!opened && (
        <div className="sg-sum">{Math.round(pct)}% · {(done / 1024).toFixed(1)}/{(total / 1024).toFixed(1)} Go</div>
      )}
      {opened && (
        <div className="sg-list">
          {members.map((m) => (
            <SessRow key={m.id} s={m} opened={openIds.includes(m.id)} busy={busy}
              onToggle={() => onToggleOne(m.id)} onRemove={() => onRemove(m)} />
          ))}
        </div>
      )}
    </div>
  )
}
