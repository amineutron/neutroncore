import { useState } from 'react'
import { apiDelete, apiGet, apiPost, withConfirm } from '../lib/api'
import { usePoll } from '../lib/poll'
import { Loader, Bar, Btn, Card, Chip, PageTitle } from '../components/ui'

type Torrent = { hash: string; name: string; state: string; progress: number; dl_speed_fmt: string; eta_fmt: string; num_seeds: number; size_fmt: string }
type Session = { id: string; name: string; template: string; status: string; extra: Record<string, string> }
type SubStatus = {
  bazarr_ok: boolean
  wanted_episodes: { series: string; episode: string }[]
  wanted_episodes_total: number
  wanted_movies_total: number
  ai: { active: { title: string }[]; active_total: number; replaced_total: number; budget_spent: number; budget_total: number }
}

const PHASES = ['download', 'subtitles', 'dv-conv']

function phaseIndex(phase: string): number {
  const p = phase.toLowerCase()
  if (p.includes('sous-titre') || p.includes('subtitle')) return 1
  if (p.includes('dv') || p.includes('conv')) return 2
  return 0
}

export function Downloads() {
  const stats = usePoll<{ dl_speed_fmt: string; ul_speed_fmt: string }>(() => apiGet('/qbit/stats'), 5000)
  const torrents = usePoll<{ torrents: Torrent[] }>(() => apiGet('/qbit/torrents?filter=all'), 5000)
  const subs = usePoll<SubStatus>(() => apiGet('/subtitles/status'), 120000)
  const sessions = usePoll<Session[]>(() => apiGet('/tracking/sessions'), 10000)

  const [busy, setBusy] = useState('')

  const active = (torrents.data?.torrents ?? []).filter((t) =>
    ['downloading', 'stalledDL', 'forcedDL', 'metaDL', 'queuedDL', 'pausedDL', 'stoppedDL'].includes(t.state),
  )

  async function removeTorrent(t: Torrent) {
    if (!window.confirm(`Supprimer le torrent « ${t.name} » ?`)) return
    const withData = window.confirm('Supprimer AUSSI les fichiers téléchargés ?\nOK = torrent + fichiers · Annuler = torrent seul')
    setBusy(t.hash)
    try {
      await apiPost(`/qbit/torrents/${t.hash}/delete`, { delete_files: withData }, await withConfirm('qbit_delete'))
      torrents.refresh()
    } finally { setBusy('') }
  }

  async function removeDownload(s: Session) {
    if (!window.confirm(`Retirer « ${s.name} » du pipeline ?\n(le torrent lié sera supprimé de qBittorrent)`)) return
    const withData = window.confirm('Supprimer AUSSI les fichiers déjà téléchargés ?\nOK = tout supprimer · Annuler = garder les fichiers')
    setBusy(s.id)
    try {
      await apiDelete(`/tracking/downloads/${s.id}?delete_files=${withData}`, await withConfirm('qbit_delete'))
      sessions.refresh()
      torrents.refresh()
    } catch (e) {
      window.alert(`Échec : ${(e as Error).message}`)
    } finally { setBusy('') }
  }
  const mediaSessions = (sessions.data ?? []).filter((s) => ['movie', 'series_episode', 'series_season'].includes(s.template) && s.status === 'running')
  const ai = subs.data?.ai

  return (
    <>
      <PageTitle help="dl" title="téléchargements" desc="qBittorrent + le pipeline : téléchargement, sous-titres, conversion Dolby Vision." />
      <div className="tiles">
        <div className="tile"><div className="ey">débit</div><div className="v num" style={{ fontSize: 22 }}>{stats.data?.dl_speed_fmt ?? '…'}</div><div className="d num">up {stats.data?.ul_speed_fmt ?? ''}</div></div>
        <div className="tile"><div className="ey">actifs</div><div className="v num">{active.length}</div><div className="d">{active.filter((t) => t.num_seeds === 0).length} sans seed</div></div>
        <div className="tile"><div className="ey">sous-titres ia</div><div className="v num">{ai ? `${ai.budget_spent}` : '…'}<small> / {ai?.budget_total ?? 5} pts</small></div><div className="d">{ai?.active_total ?? 0} trads en place</div></div>
        <div className="tile"><div className="ey">pipeline</div><div className="v num">{mediaSessions.length}<small> en cours</small></div><div className="d">sessions média suivies</div></div>
      </div>

      <Card title="pipeline média" lite="du torrent au film prêt" style={{ marginBottom: 14 }}>
        {active.map((t) => (
          <div className="torrent" key={t.hash}>
            <div className="row1">
              <span className="name">{t.name}</span>
              <span className="sp num">{t.num_seeds === 0 ? `0 seed — en attente` : `${t.dl_speed_fmt} · ETA ${t.eta_fmt}`}</span>
              <Btn sm danger disabled={busy === t.hash} onClick={() => removeTorrent(t)}>suppr</Btn>
            </div>
            <Bar pct={t.progress} tone={t.num_seeds === 0 ? 'warn' : undefined} />
          </div>
        ))}
        {mediaSessions.map((s) => {
          const idx = phaseIndex(s.extra?.phase ?? '')
          return (
            <div className="torrent" key={s.id}>
              <div className="row1">
                <span className="name">{s.name}</span>
                <span className="sp num" style={{ color: 'var(--gold)' }}>{s.extra?.phase ?? ''}</span>
                <Btn sm danger disabled={busy === s.id} onClick={() => removeDownload(s)}>suppr</Btn>
              </div>
              <div className="pipe">
                {PHASES.map((p, i) => (
                  <span key={p} style={{ display: 'contents' }}>
                    {i > 0 && <span className={`link ${i <= idx ? 'done' : ''}`} />}
                    <span className={`step ${i < idx ? 'done' : i === idx ? 'run' : ''}`}>
                      <span className="n">{i + 1}</span>
                      {p === 'download' ? 'téléchargement' : p === 'subtitles' ? 'sous-titres' : 'conversion dv'}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )
        })}
        {torrents.data === null && <Loader label="chargement des téléchargements…" />}
        {torrents.data !== null && active.length === 0 && mediaSessions.length === 0 && <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>Rien en cours.</span>}
      </Card>

      <div className="grid g2">
        <Card title="sous-titres manquants" lite={`bazarr · ${subs.data?.wanted_episodes_total ?? '…'} épisodes`}>
          <table>
            <tbody>
              {(subs.data?.wanted_episodes ?? []).slice(0, 8).map((w, i) => (
                <tr key={i}><td className="mono">{w.series} — {w.episode}</td></tr>
              ))}
            </tbody>
          </table>
          {!subs.data?.bazarr_ok && <Chip tone="crit">bazarr injoignable</Chip>}
        </Card>
        <Card title="traductions ia en place" lite={`subtitle_ai · ${ai?.replaced_total ?? 0} remplacées au total`}>
          <table>
            <tbody>
              {(ai?.active ?? []).slice(0, 8).map((e, i) => (
                <tr key={i}><td className="mono">{e.title}</td><td className="num" style={{ textAlign: 'right', color: 'var(--faint)' }}>phase b</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}
