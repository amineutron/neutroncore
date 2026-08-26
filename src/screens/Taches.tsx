import { useState } from 'react'
import { apiGet, apiDelete, withConfirm } from '../lib/api'
import { usePoll, fmtRemaining } from '../lib/poll'
import { Bar, Btn, Card, Chip, Eyebrow, Loader, PageTitle } from '../components/ui'

type Item = { name: string; status: string }
type Log = { timestamp: string; message: string }
type Session = {
  id: string; name: string; template: string; status: string
  processed: number; total: number; unit: string; items: Item[]; logs: Log[]
  extra: Record<string, string>; created_at?: string
}
type Timer = { unit: string; next: number | null; last: number | null }

const TPL_TONE: Record<string, 'gold' | 'rose' | 'warn' | undefined> = {
  movie: 'gold', series_episode: 'gold', series_season: 'warn', lyra_task: 'rose',
}
// horodatage complet des logs : "24/08 20:24:17" (l'heure seule ne permet
// pas de comparer des taches qui courent sur plusieurs jours)
function fmtStamp(ts: string, seconds = true): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/.exec(ts)
  if (!m) return ts.slice(0, 19)
  return `${m[3]}/${m[2]} ${m[4]}${seconds && m[5] ? ':' + m[5] : ''}`
}
const ICON: Record<string, string> = { done: '[ok]', running: '[>>]', error: '[!]', pending: '[ ]' }

export function Taches() {
  const sessions = usePoll<Session[]>(() => apiGet('/tracking/sessions'), 5000)
  const timers = usePoll<{ timers: Timer[]; failed_units: string[] }>(() => apiGet('/system/timers'), 60000)
  const [busy, setBusy] = useState(false)
  const [removed, setRemoved] = useState<string[]>([])
  const [feedback, setFeedback] = useState('')
  const [open, setOpen] = useState<string[]>([])
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  // retrait optimiste : la ligne disparaît tout de suite, sans attendre le poll
  const list = [...(sessions.data ?? [])]
    .filter((s) => !removed.includes(s.id))
    .sort((a, b) => (a.status === 'running' ? -1 : 1) - (b.status === 'running' ? -1 : 1))

  function flash(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 4000)
  }

  async function removeOne(s: Session) {
    if (!window.confirm(`Supprimer la tâche « ${s.name} » ?`)) return
    setBusy(true)
    try {
      await apiDelete(`/tracking/sessions/${s.id}`, await withConfirm('tracking_delete'))
      setRemoved((r) => [...r, s.id])
      flash(`« ${s.name.slice(0, 40)} » supprimée`)
      sessions.refresh()
    } catch (e) {
      flash(`échec : ${(e as Error).message}`)
    } finally { setBusy(false) }
  }

  async function clearFinished() {
    const finished = list.filter((s) => s.status === 'done' || s.status === 'error')
    if (finished.length === 0) { flash('rien à nettoyer (aucune tâche terminée ou en erreur)'); return }
    if (!window.confirm(`Nettoyer ${finished.length} tâche(s) terminée(s) ou en erreur ?`)) return
    setBusy(true)
    let ok = 0
    try {
      // les tokens X-Confirm sont anti-rejeu (usage unique) : un token par suppression
      for (const s of finished) {
        try {
          await apiDelete(`/tracking/sessions/${s.id}`, await withConfirm('tracking_delete'))
          setRemoved((r) => [...r, s.id])
          ok++
        } catch { /* déjà purgée */ }
      }
      flash(`${ok} tâche(s) supprimée(s)`)
      sessions.refresh()
    } catch (e) {
      flash(`échec : ${(e as Error).message}`)
    } finally { setBusy(false) }
  }
  const allLogs = list.flatMap((s) => s.logs.map((l) => ({ ...l, session: s.name }))).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8)
  const userTimers = (timers.data?.timers ?? []).filter((t) => !t.unit.startsWith('systemd-') && !t.unit.startsWith('dnf'))

  return (
    <>
      <PageTitle help="taches" title="tâches de fond" desc="Tracking temps réel — sessions Lyra, conversions, scripts et timers systemd." />
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eyebrow>sessions ({list.length})</Eyebrow>
            <span style={{ flex: 1 }} />
            <Btn sm disabled={busy} onClick={clearFinished}>nettoyer terminées</Btn>
          </div>
          {feedback && <div style={{ marginBottom: 10 }}><Chip tone={feedback.startsWith('échec') ? 'crit' : 'ok'}>{feedback}</Chip></div>}
          {sessions.data === null && <Loader label="chargement des sessions…" />}
          {list.slice(0, 10).map((s) => {
            const pct = s.total > 0 ? (s.processed / s.total) * 100 : 0
            const remaining = s.status === 'running' ? fmtRemaining(s.created_at, pct) : null
            const opened = open.includes(s.id)
            return (
              <div className="sess" key={s.id}>
                <div className="head" onClick={() => toggle(s.id)} title="cliquer pour le détail">
                  <Chip tone={TPL_TONE[s.template]}>{s.template}</Chip>
                  <span className="nm">{s.name}</span>
                  {remaining && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--warn)' }}>{remaining}</span>}
                  <Chip tone={s.status === 'error' ? 'crit' : s.status === 'done' ? 'ok' : undefined}>{s.status}</Chip>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Btn sm danger disabled={busy} onClick={() => removeOne(s)}>suppr</Btn>
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
                    {s.items.map((it) => (
                      <div key={it.name} className={`item ${it.status === 'done' ? 'done' : it.status === 'running' ? 'run' : it.status === 'error' ? 'err' : ''}`}>
                        <span className="ic">{ICON[it.status] ?? '[ ]'}</span>
                        {it.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {sessions.data !== null && list.length === 0 && <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>Aucune session de tracking.</span>}
        </div>
        <div>
          <Eyebrow>journal</Eyebrow>
          <Card style={{ marginBottom: 14 }}>
            {allLogs.map((l, i) => (
              <div className="logline" key={i}>
                <b>{fmtStamp(l.timestamp, false)}</b> {l.session.slice(0, 28)} — {l.message}
              </div>
            ))}
            {allLogs.length === 0 && <span style={{ color: 'var(--faint)', fontSize: 12 }}>Pas de logs récents.</span>}
          </Card>
          <Eyebrow>timers systemd</Eyebrow>
          <Card>
            {timers.data === null && <Loader label="chargement des timers…" />}
            <table>
              <tbody>
                {userTimers.slice(0, 10).map((t) => (
                  <tr key={t.unit}>
                    <td className="mono">{t.unit.replace('.timer', '')}</td>
                    <td className="num" style={{ color: 'var(--muted)', textAlign: 'right' }}>
                      {t.next ? new Date(t.next * 1000).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(timers.data?.failed_units ?? []).map((u) => (
              <div key={u} style={{ marginTop: 8 }}><Chip tone="crit">{u} en échec</Chip></div>
            ))}
          </Card>
        </div>
      </div>
    </>
  )
}
