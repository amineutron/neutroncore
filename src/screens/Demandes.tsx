import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, apiDelete } from '../lib/api'
import { usePoll } from '../lib/poll'
import { getSettings } from '../lib/settings'
import { takePrefill } from '../lib/prefill'
import { Loader, Btn, Card, Chip, PageTitle } from '../components/ui'
import { Incoming } from '../components/Incoming'
import { DeclinedAuto } from '../components/DeclinedAuto'

type Req = { id: number; title: string; status: string; media_status: string; kind: string; created_at: string }
type SearchResult = { tmdb_id: number; kind: string; title: string; year: string; poster: string; already_available: boolean }
type Options = { movie_profiles: { id: number; name: string }[]; tv_profiles: { id: number; name: string }[]; languages: string[] }
type Season = { number: number; episodes: number; name: string }
type WatchItem = {
  id: string; tmdb_id: number; kind: string; title: string; quality: string; language: string
  current: { present: boolean; quality: string; languages: string[] }; mismatch: boolean
}

export function Demandes() {
  const pending = usePoll<{ requests: Req[]; total: number }>(() => apiGet('/requests?status=pending'), 30000)
  const [q, setQ] = useState(takePrefill)
  const [kind, setKind] = useState<'all' | 'movie' | 'tv'>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const seq = useRef(0)

  // recherche à la frappe : debounce 250 ms, la réponse la plus récente gagne
  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setResults([])
      return
    }
    const mySeq = ++seq.current
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await apiGet<{ results: SearchResult[] }>(`/requests/search?q=${encodeURIComponent(query)}`)
        if (seq.current === mySeq) setResults(r.results)
      } catch { /* frappe suivante */ } finally {
        if (seq.current === mySeq) setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const filtered = results.filter((r) => kind === 'all' || r.kind === kind)

  // --- panneau d'options de demande (saisons / qualité / langue) ---
  const options = usePoll<Options>(() => apiGet('/requests/options'), 600000)
  const watch = usePoll<{ items: WatchItem[] }>(() => apiGet('/requests/watchlist'), 120000)
  const [selecting, setSelecting] = useState<SearchResult | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [chosen, setChosen] = useState<'all' | number[]>('all')
  const [profileId, setProfileId] = useState<number | null>(null)
  const [language, setLanguage] = useState('Français')
  const showPosters = getSettings().posters

  async function openOptions(r: SearchResult) {
    setSelecting(r)
    setChosen('all')
    setProfileId(null)
    if (r.kind === 'tv') {
      try {
        const s = await apiGet<{ seasons: Season[] }>(`/requests/seasons/${r.tmdb_id}`)
        setSeasons(s.seasons)
      } catch { setSeasons([]) }
    } else setSeasons([])
  }

  function toggleSeason(n: number) {
    if (chosen === 'all') setChosen([n])
    else if (chosen.includes(n)) setChosen(chosen.filter((x) => x !== n))
    else setChosen([...chosen, n])
  }

  async function submitRequest() {
    if (!selecting) return
    const profiles = selecting.kind === 'tv' ? options.data?.tv_profiles : options.data?.movie_profiles
    const profileName = profiles?.find((p) => p.id === profileId)?.name ?? ''
    await apiPost('/requests', {
      tmdb_id: selecting.tmdb_id,
      kind: selecting.kind,
      seasons: selecting.kind === 'tv' && chosen !== 'all' ? chosen : null,
      profile_id: profileId,
      language,
      quality_name: profileName,
    })
    setResults((prev) => prev.filter((x) => x.tmdb_id !== selecting.tmdb_id))
    setSelecting(null)
    pending.refresh()
    watch.refresh()
  }

  async function watchAction(item: WatchItem, mode: 'accept' | 'cancel') {
    await apiDelete(`/requests/watchlist/${item.id}?mode=${mode}`)
    watch.refresh()
  }
  async function act(id: number, action: 'approve' | 'decline') {
    await apiPost(`/requests/${id}/${action}`)
    pending.refresh()
  }

  return (
    <>
      <PageTitle help="demandes" title="demandes" desc="Overseerr — approuver, demander, comprendre les refus automatiques." />
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="lyra-input" style={{ margin: 0, flex: 1, minWidth: 240 }}>
          <input placeholder="Tape pour chercher (la liste s'affine)…" value={q} aria-label="Recherche"
            onChange={(e) => setQ(e.target.value)} />
        </div>
        {(['all', 'movie', 'tv'] as const).map((k) => (
          <button key={k} className={`btn sm ${kind === k ? 'solid' : ''}`} onClick={() => setKind(k)}>
            {k === 'all' ? 'tout' : k === 'movie' ? 'films' : 'séries'}
          </button>
        ))}
        <Chip tone="gold">{pending.data?.total ?? 0} en attente</Chip>
      </div>

      {q.trim().length >= 2 && (
        <Card title={searching ? 'recherche…' : `résultats (${filtered.length})`} style={{ marginBottom: 14 }}>
          {filtered.length === 0 && !searching && <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>Aucun résultat pour « {q} ».</span>}
          <table>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.kind}-${r.tmdb_id}`}>
                  {showPosters && (
                    <td style={{ width: 44 }}>
                      {r.poster && <img src={r.poster} alt="" width={38} style={{ borderRadius: 4, display: 'block' }} />}
                    </td>
                  )}
                  <td><b>{r.title}</b> <span style={{ color: 'var(--faint)', fontSize: 11 }}>({r.year || '?'}) · {r.kind === 'tv' ? 'série' : 'film'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    {r.already_available ? <Chip tone="ok">déjà dispo</Chip> : <Btn sm solid onClick={() => openOptions(r)}>demander</Btn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selecting && (
        <Card title={`demander « ${selecting.title} »`} style={{ marginBottom: 14, borderColor: 'var(--gold-soft)' }}>
          {selecting.kind === 'tv' && (
            <>
              <div className="eyebrow">saisons</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <button className={`btn sm ${chosen === 'all' ? 'solid' : ''}`} onClick={() => setChosen('all')}>tout</button>
                {seasons.map((s) => (
                  <button key={s.number}
                    className={`btn sm ${chosen !== 'all' && chosen.includes(s.number) ? 'solid' : ''}`}
                    onClick={() => toggleSeason(s.number)}>
                    s{String(s.number).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--muted)' }}>
              qualité<br />
              <select value={profileId ?? ''} onChange={(e) => setProfileId(e.target.value ? Number(e.target.value) : null)}
                style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 6, padding: '5px 8px', fontFamily: 'var(--mono)', fontSize: 11, marginTop: 4 }}>
                <option value="">par défaut</option>
                {((selecting.kind === 'tv' ? options.data?.tv_profiles : options.data?.movie_profiles) ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, color: 'var(--muted)' }}>
              langue souhaitée<br />
              <select value={language} onChange={(e) => setLanguage(e.target.value)}
                style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--line2)', borderRadius: 6, padding: '5px 8px', fontFamily: 'var(--mono)', fontSize: 11, marginTop: 4 }}>
                {(options.data?.languages ?? ['Français']).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn solid onClick={submitRequest} disabled={selecting.kind === 'tv' && chosen !== 'all' && chosen.length === 0}>
              envoyer la demande
            </Btn>
            <Btn onClick={() => setSelecting(null)}>annuler</Btn>
          </div>
        </Card>
      )}

      {(watch.data?.items ?? []).length > 0 && (
        <Card title="suivi qualité / langue" lite="ce qui est arrivé vs ce que tu voulais" style={{ marginBottom: 14 }}>
          <table><tbody>
            {(watch.data?.items ?? []).map((it) => (
              <tr key={it.id}>
                <td>
                  <b>{it.title}</b>{' '}
                  <span style={{ color: 'var(--faint)', fontSize: 11 }}>
                    souhaité : {[it.quality, it.language].filter(Boolean).join(' · ') || '—'}
                  </span><br />
                  <span style={{ fontSize: 11.5, color: it.mismatch ? 'var(--warn)' : 'var(--muted)' }}>
                    {it.current.present
                      ? `sur disque : ${it.current.quality}${it.current.languages.length ? ` · ${it.current.languages.join(', ')}` : ''}`
                      : 'pas encore téléchargé'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {it.mismatch ? (
                    <>
                      <Btn sm solid onClick={() => watchAction(it, 'accept')}>accepter tel quel</Btn>{' '}
                      <Btn sm onClick={() => watch.refresh()}>attendre mieux</Btn>{' '}
                      <Btn sm danger onClick={() => watchAction(it, 'cancel')}>abandonner</Btn>
                    </>
                  ) : it.current.present ? (
                    <><Chip tone="ok">conforme</Chip>{' '}<Btn sm onClick={() => watchAction(it, 'accept')}>ok, retirer</Btn></>
                  ) : (
                    <Chip>en attente</Chip>
                  )}
                </td>
              </tr>
            ))}
          </tbody></table>
        </Card>
      )}

      <Incoming />

      <div className="grid g2">
        <Card title="en attente d'approbation">
          {pending.data === null && <Loader label="chargement des demandes…" />}
          {pending.data !== null && (pending.data?.requests ?? []).length === 0 && <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>Aucune demande en attente.</span>}
          <table>
            <tbody>
              {(pending.data?.requests ?? []).map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.title}</b> <span style={{ color: 'var(--faint)', fontSize: 11 }}>{r.kind === 'tv' ? 'série' : 'film'}</span><br />
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Btn sm solid onClick={() => act(r.id, 'approve')}>approuver</Btn>{' '}
                    <Btn sm danger onClick={() => act(r.id, 'decline')}>refuser</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <DeclinedAuto />
      </div>
    </>
  )
}
