import { useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { toast } from '../lib/dialog'
import { groupBySeries, isReleased, releaseLabel, type MissingEpisode, type MissingMovie } from '../lib/missing'
import { usePoll } from '../lib/poll'
import { Btn, Card, Chip, Loader } from './ui'

type MissingResp = { movies: MissingMovie[]; episodes: MissingEpisode[]; episode_total: number }

// Onglet « manquants » de films & séries : ce qui est suivi mais absent du
// disque, avec relance de la recherche de release (Radarr / Sonarr).
export function Missing() {
  const missing = usePoll<MissingResp>(() => apiGet('/arr/missing'), 300000)
  const [sent, setSent] = useState<string[]>([])
  const [busy, setBusy] = useState('')

  async function search(kind: 'movie' | 'series', id: number, title: string) {
    const key = `${kind}:${id}`
    setBusy(key)
    try {
      await apiPost('/arr/search', { kind, target_id: id })
      setSent((s) => [...s, key])
      toast(`recherche relancée : ${title}`)
    } catch (e) {
      toast(`échec de la relance : ${(e as Error).message}`, 'crit')
    } finally { setBusy('') }
  }

  const relaunch = (kind: 'movie' | 'series', id: number | null, title: string) => {
    if (id == null) return null
    const key = `${kind}:${id}`
    if (sent.includes(key)) return <Chip tone="ok">relancé</Chip>
    return <Btn sm disabled={busy === key} onClick={() => search(kind, id, title)}>{busy === key ? '…' : 'relancer'}</Btn>
  }

  if (!missing.data) return missing.error ? <Chip tone="crit">manquants indisponibles : {missing.error}</Chip> : <Loader />
  const movies = [...missing.data.movies].sort((a, b) => Number(isReleased(b)) - Number(isReleased(a)) || a.title.localeCompare(b.title))
  const series = groupBySeries(missing.data.episodes)
  const hidden = missing.data.episode_total - missing.data.episodes.length

  return (
    <div className="grid g2">
      <Card title="films" lite={`${movies.length} suivis sans fichier`}>
        <table><tbody>
          {movies.map((m) => (
            <tr key={m.id}>
              <td><b style={{ fontSize: 12.5 }}>{m.title}</b> <span className="num" style={{ color: 'var(--muted)' }}>{m.year}</span></td>
              <td style={{ width: 90 }}><Chip tone={isReleased(m) ? 'warn' : undefined}>{releaseLabel(m.status)}</Chip></td>
              <td style={{ width: 84, textAlign: 'right' }}>{isReleased(m) && relaunch('movie', m.id, m.title)}</td>
            </tr>
          ))}
          {movies.length === 0 && <tr><td style={{ color: 'var(--faint)', fontSize: 12 }}>Aucun film manquant.</td></tr>}
        </tbody></table>
      </Card>
      <Card title="séries" lite={`${missing.data.episode_total} épisodes manquants`}>
        <table><tbody>
          {series.map((s) => (
            <tr key={`${s.id}:${s.title}`}>
              <td>
                <b style={{ fontSize: 12.5 }}>{s.title}</b><br />
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {s.episodes.length} épisode{s.episodes.length > 1 ? 's' : ''} · {s.range}
                </span>
              </td>
              <td style={{ width: 84, textAlign: 'right' }}>{relaunch('series', s.id, s.title)}</td>
            </tr>
          ))}
          {series.length === 0 && <tr><td style={{ color: 'var(--faint)', fontSize: 12 }}>Aucun épisode manquant.</td></tr>}
        </tbody></table>
        {hidden > 0 && <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>{hidden} autres épisodes plus anciens ne sont pas listés.</p>}
      </Card>
    </div>
  )
}
