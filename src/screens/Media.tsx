import { useContext, useState } from 'react'
import { apiGet, apiPost, apiDelete, withConfirm } from '../lib/api'
import { usePoll, fmtBytes } from '../lib/poll'
import { setPrefill } from '../lib/prefill'
import { NavContext } from '../App'
import { Bar, Btn, Card, Chip, Dot, Eyebrow, PageTitle } from '../components/ui'

type Movie = { id: number; title: string; year: number; has_file: boolean; quality: string; size: number; poster: string; monitored: boolean }
type Series = { id: number; title: string; year: number; episode_file_count: number; episode_count: number; size: number; poster: string; status: string }
type Overview = { movie_count: number; series_count: number; missing_movies: number; recent_movies: Movie[]; disks: { path: string; free: number; total: number }[] }
type CalEvent = { title: string; date: string; detail: string }
type Tab = 'recents' | 'films' | 'series'

const MEDIA_HOST = import.meta.env.VITE_MEDIA_HOST ?? 'media-server.lan'
const PLEX_WEB = `http://${MEDIA_HOST}:32400/web/index.html`

export function Media() {
  const overview = usePoll<Overview>(() => apiGet('/arr/overview'), 60000)
  const calendar = usePoll<{ events: CalEvent[] }>(() => apiGet('/arr/calendar?days=7'), 300000)
  const movies = usePoll<{ movies: Movie[] }>(() => apiGet('/arr/movies'), 120000)
  const series = usePoll<{ series: Series[] }>(() => apiGet('/arr/series'), 120000)
  const [tab, setTab] = useState<Tab>('recents')
  const [filter, setFilter] = useState('')
  const [pre, setPre] = useState<'tous' | 'manquants' | '4k' | 'dv' | 'recents'>('tous')
  const [busy, setBusy] = useState<number | null>(null)
  const [playing, setPlaying] = useState<Movie | null>(null)
  const navigate = useContext(NavContext)

  function requestNew(query: string) {
    setPrefill(query)
    navigate('demandes')
  }

  const d = overview.data
  const dataDisk = d?.disks.find((x) => x.path === '/data') ?? d?.disks[0]
  const usedPct = dataDisk ? ((dataDisk.total - dataDisk.free) / dataDisk.total) * 100 : 0
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const match = (title: string) => !filter || norm(title).includes(norm(filter))

  async function remove(m: Movie) {
    if (!window.confirm(`Supprimer « ${m.title} » et son fichier (${fmtBytes(m.size)}) ?`)) return
    setBusy(m.id)
    try {
      await apiDelete(`/arr/movie/${m.id}`, await withConfirm('arr_delete'))
      movies.refresh(); overview.refresh()
    } finally { setBusy(null) }
  }
  async function playOnTv(title: string) {
    await apiPost('/tv/app', { app: 'plex' })
    setPlaying(null)
    window.alert(`Plex lancé sur la TV — cherche « ${title} » avec la télécommande ou Lyra.`)
  }
  function playOnPc(title: string) {
    window.open(`${PLEX_WEB}#!/search?query=${encodeURIComponent(title)}`, '_blank')
    setPlaying(null)
  }

  const posterCard = (m: Movie) => (
    <div key={m.id} className="poster" onClick={() => m.has_file && setPlaying(m)}>
      <div className="img" style={m.poster ? { backgroundImage: `url(${m.poster})`, backgroundSize: 'cover', color: 'transparent' } : { background: 'linear-gradient(160deg,#3d2540,#160d18)' }}>
        {m.title}
      </div>
      <div className="meta">
        <Dot s={m.has_file ? 'ok' : 'warn'} />
        {m.has_file ? m.quality || 'ok' : 'manquant'}
      </div>
    </div>
  )

  return (
    <>
      <PageTitle help="films" title="films & séries" desc={`${d?.movie_count ?? '…'} films · ${d?.series_count ?? '…'} séries`} />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['recents', 'films', 'series'] as Tab[]).map((t) => (
          <button key={t} className={`btn sm ${tab === t ? 'solid' : ''}`} onClick={() => setTab(t)}>
            {t === 'recents' ? 'récents' : t === 'films' ? `films (${movies.data?.movies.length ?? '…'})` : `séries (${series.data?.series.length ?? '…'})`}
          </button>
        ))}
        {tab !== 'recents' && (
          <div className="lyra-input" style={{ margin: 0, flex: 1, minWidth: 180, padding: '5px 12px' }}>
            <input placeholder="filtrer…" value={filter} aria-label="Filtre" onChange={(e) => setFilter(e.target.value)} />
          </div>
        )}
        {d && d.missing_movies > 0 && <Chip tone="warn">{d.missing_movies} manquants</Chip>}
        <Btn sm solid onClick={() => requestNew(tab !== 'recents' ? filter : '')}>+ demander un film / une série</Btn>
      </div>

      {playing && (
        <Card style={{ marginBottom: 14, borderColor: '#f6c17755' }}>
          <h3>lire « {playing.title} »</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn solid onClick={() => playOnTv(playing.title)}>sur la TV (Plex)</Btn>
            <Btn onClick={() => playOnPc(playing.title)}>sur le PC (nouvel onglet)</Btn>
            <Btn onClick={() => setPlaying(null)}>annuler</Btn>
          </div>
        </Card>
      )}

      {tab === 'recents' && (
        <>
          <Eyebrow>récemment ajoutés</Eyebrow>
          <div className="posters" style={{ marginBottom: 22 }}>
            {(d?.recent_movies ?? []).slice(0, 6).map(posterCard)}
          </div>
          <div className="grid g2">
            <Card title="calendrier des sorties" lite="7 prochains jours">
              <div className="cal">
                {(calendar.data?.events ?? []).slice(0, 8).map((e, i) => (
                  <div className="day" key={i}>
                    <span className="dt">{e.date ? new Date(e.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) : '—'}</span>
                    <div className="ev"><b>{e.title}</b><span>{e.detail}</span></div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="espace disque" lite="/mnt/media">
              {dataDisk && (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <span className="num" style={{ fontSize: 26, fontWeight: 300 }}>{fmtBytes(dataDisk.total - dataDisk.free)}</span>
                    <span className="num" style={{ color: 'var(--muted)' }}>/ {fmtBytes(dataDisk.total)}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      <Chip tone={usedPct >= 92 ? 'crit' : usedPct >= 85 ? 'warn' : 'ok'}>{usedPct.toFixed(0)} %</Chip>
                    </span>
                  </div>
                  <Bar pct={usedPct} tone={usedPct >= 92 ? 'crit' : usedPct >= 85 ? 'warn' : undefined} />
                </>
              )}
              <div style={{ marginTop: 16 }}>
                <Eyebrow>plus gros films — candidats à la suppression</Eyebrow>
                <table><tbody>
                  {[...(movies.data?.movies ?? [])].sort((a, b) => b.size - a.size).slice(0, 4).map((m) => (
                    <tr key={m.id}>
                      <td className="mono">{m.title}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{fmtBytes(m.size)}</td>
                      <td style={{ width: 70, textAlign: 'right' }}>
                        <Btn sm danger disabled={busy === m.id} onClick={() => remove(m)}>retirer</Btn>
                      </td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === 'films' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {(['tous', 'manquants', '4k', 'dv', 'recents'] as const).map((p) => (
              <button key={p} className={`btn sm ${pre === p ? 'solid' : ''}`} onClick={() => setPre(p)}>{p}</button>
            ))}
          </div>
          {filter && (movies.data?.movies ?? []).filter((m) => match(m.title)).length === 0 && (
            <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>« {filter} » n'est pas dans la bibliothèque.</span>
              <Btn sm solid onClick={() => requestNew(filter)}>le demander</Btn>
            </div>
          )}
          <div className="posters">
            {(movies.data?.movies ?? [])
              .filter((m) => match(m.title))
              .filter((m) => pre === 'tous' ? true
                : pre === 'manquants' ? !m.has_file
                : pre === '4k' ? /2160|4k|ultra/i.test(m.quality)
                : pre === 'dv' ? /dv|dolby/i.test(m.quality)
                : m.year >= new Date().getFullYear() - 1)
              .slice(0, 48)
              .map((m) => (
                <div key={m.id} className="poster" onClick={() => m.has_file && setPlaying(m)}>
                  <div className="img" style={m.poster ? { backgroundImage: `url(${m.poster})`, backgroundSize: 'cover', color: 'transparent' } : { background: 'linear-gradient(160deg,#3d2540,#160d18)' }}>
                    {m.title}
                  </div>
                  <div className="meta">
                    <Dot s={m.has_file ? 'ok' : 'warn'} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.title}</span>
                    <Btn sm danger onClick={(e?: unknown) => { (e as Event)?.stopPropagation?.(); remove(m) }}>x</Btn>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {tab === 'series' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {(['tous', 'manquants', 'recents'] as const).map((p) => (
              <button key={p} className={`btn sm ${pre === p ? 'solid' : ''}`} onClick={() => setPre(p as typeof pre)}>{p}</button>
            ))}
          </div>
          <div className="posters">
            {(series.data?.series ?? [])
              .filter((s) => match(s.title))
              .filter((s) => pre === 'manquants' ? s.episode_file_count < s.episode_count
                : pre === 'recents' ? s.year >= new Date().getFullYear() - 1
                : true)
              .slice(0, 48)
              .map((s) => (
                <div key={s.id} className="poster" onClick={() => setPlaying({ id: s.id, title: s.title, has_file: true } as Movie)}>
                  <div className="img" style={s.poster ? { backgroundImage: `url(${s.poster})`, backgroundSize: 'cover', color: 'transparent' } : { background: 'linear-gradient(160deg,#25283d,#0d0e16)' }}>
                    {s.title}
                  </div>
                  <div className="meta">
                    <Dot s={s.episode_file_count >= s.episode_count ? 'ok' : 'warn'} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.title}</span>
                    <span className="num" style={{ flex: 'none' }}>{s.episode_file_count}/{s.episode_count}</span>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </>
  )
}
