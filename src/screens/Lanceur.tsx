import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPut, withConfirm } from '../lib/api'
import { usePoll } from '../lib/poll'
import { Bar, Btn, Card, PageTitle, Eyebrow, Chip } from '../components/ui'
import { Sessions } from '../components/Sessions'
import { addLaunch, getLaunches, subscribeLaunches } from '../lib/launches'

type Fav = { name: string; path: string; exists: boolean }
type WeekStats = { active_projects: number; total_projects: number; commits: number; pushed_commits: number; files_touched: number; busiest_day: string; top: { name: string; commits: number; pushed: number }[] }
type ClaudeStats = { sessions: number; projects: number; total_output_tokens: number; models: { model: string; messages: number; output_tokens: number }[]; quota_note?: string; consumption?: { all_time: { model: string; output_tokens: number }[]; total_sessions_all_time: number } }
type Browse = { path: string; parent: string | null; is_git?: boolean; dirs: { name: string; path: string; is_git?: boolean }[] }

export function Lanceur() {
  const state = usePoll<{ favorites: Fav[]; folders: string[]; terminal: string }>(() => apiGet('/launcher'), 60000)
  const week = usePoll<WeekStats>(() => apiGet('/projects/stats'), 600000)
  const claudeStats = usePoll<ClaudeStats>(() => apiGet('/launcher/claude-stats'), 600000)
  const quota = usePoll<{ available: boolean; five_hour?: { utilization: number; resets_at: string }; seven_day?: { utilization: number; resets_at: string } }>(() => apiGet('/launcher/claude-quota'), 120000)
  const [busy, setBusy] = useState('')
  const [sessCounts, setSessCounts] = useState<Record<string, number>>({})
  // lancements en route (store partagé avec le bloc sessions, qui affiche la carte fantôme)
  const [launches, setLaunches] = useState(getLaunches)
  useEffect(() => subscribeLaunches(() => setLaunches(getLaunches())), [])
  const launching = (path: string) => launches.some((l) => l.cwd === path && !l.sessionId)

  async function claude(path: string) {
    setBusy(path)
    try {
      await apiPost('/launcher/claude', { path }, await withConfirm('launcher_claude'))
      addLaunch({ cwd: path, repo: path.split('/').filter(Boolean).pop() ?? path })
    } finally { setBusy('') }
  }
  async function folder(path: string) {
    setBusy(path)
    try { await apiPost('/launcher/open-folder', { path }) } finally { setBusy('') }
  }

  const [browse, setBrowse] = useState<Browse | null>(null)
  async function nav(path: string) {
    setBrowse(await apiGet<Browse>(`/launcher/browse?path=${encodeURIComponent(path)}`))
  }
  async function addFavorite(path: string) {
    const name = path.split('/').filter(Boolean).pop() ?? path
    const current = (state.data?.favorites ?? []).map((f) => ({ name: f.name, path: f.path }))
    if (current.some((f) => f.path === path)) { setBrowse(null); return }
    await apiPut('/launcher/favorites', [...current, { name, path }])
    setBrowse(null)
    state.refresh()
  }
  async function removeFavorite(path: string) {
    if (!window.confirm('Retirer ce favori ?')) return
    const current = (state.data?.favorites ?? []).filter((f) => f.path !== path).map((f) => ({ name: f.name, path: f.path }))
    await apiPut('/launcher/favorites', current)
    state.refresh()
  }

  const glyph = (name: string) => name.split(/[-_ ]/).map((w) => w[0]).join('').slice(0, 2)

  return (
    <>
      <PageTitle help="lanceur" title="lanceur" desc="Ouvrir un dossier ou lancer Claude Code sur le PC, depuis n'importe où — et suivre les sessions en cours." />
      <Sessions onCounts={setSessCounts} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Eyebrow>claude code — favoris</Eyebrow>
        <span style={{ flex: 1 }} />
        <Btn sm onClick={() => nav('')}>+ ajouter</Btn>
      </div>

      {browse && (
        <Card title="choisir un dossier" lite={browse.path || 'racines autorisées'} style={{ marginBottom: 14, borderColor: '#f6c17755' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {browse.parent !== null && <Btn sm onClick={() => nav(browse.parent!)}>.. remonter</Btn>}
            {browse.dirs.map((d) => (
              <Btn key={d.path} sm onClick={() => nav(d.path)}>
                {d.name}{d.is_git ? ' *' : ''}
              </Btn>
            ))}
            {browse.dirs.length === 0 && <span style={{ color: 'var(--faint)', fontSize: 12 }}>Aucun sous-dossier.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {browse.path && <Btn sm solid onClick={() => addFavorite(browse.path)}>choisir ce dossier</Btn>}
            <Btn sm onClick={() => setBrowse(null)}>fermer</Btn>
            <span style={{ fontSize: 10.5, color: 'var(--faint)', fontFamily: 'var(--mono)' }}>* = dépôt git</span>
          </div>
        </Card>
      )}
      <div className="grid g2" style={{ marginBottom: 18 }}>
        {(state.data?.favorites ?? []).map((f) => (
          <div className="fav" key={f.path}>
            <span className="glyph">{glyph(f.name)}</span>
            <div className="path">
              <b>{f.name}</b>
              <span>{f.path.replace(/^\/home\/[^/]+/, '~')}</span>
            </div>
            {!f.exists && <Chip tone="warn">absent</Chip>}
            {f.exists && sessCounts[f.name] > 0 && <span className="cs-count" title="sessions claude code en cours">{sessCounts[f.name]} session{sessCounts[f.name] > 1 ? 's' : ''}</span>}
            {f.exists && (
              <>
                <Btn sm onClick={() => folder(f.path)} disabled={busy === f.path}>dossier</Btn>
                <button className={`btn sm solid ${launching(f.path) ? 'launching' : ''}`} onClick={() => claude(f.path)} disabled={busy === f.path || launching(f.path)}>
                  {launching(f.path) ? 'en route…' : 'lancer claude'}
                </button>
              </>
            )}
            <Btn sm danger onClick={() => removeFavorite(f.path)}>×</Btn>
          </div>
        ))}
      </div>

      <Eyebrow>ma semaine de dev</Eyebrow>
      <div className="grid g2" style={{ marginBottom: 18 }}>
        <Card title="activité git" lite="7 derniers jours">
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 10 }}>
            <div className="tile"><div className="ey">projets actifs</div><div className="v num">{week.data?.active_projects ?? '…'}<small> / {week.data?.total_projects ?? '…'}</small></div></div>
            <div className="tile"><div className="ey">commits</div><div className="v num">{week.data?.commits ?? '…'}</div><div className="d num">{week.data?.pushed_commits ?? 0} poussés sur github</div></div>
          </div>
          {(week.data?.top ?? []).map((t) => (
            <div key={t.name} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span className="mono">{t.name}</span>
                <span className="num" style={{ color: 'var(--muted)' }}>{t.commits} commits · {t.pushed} push</span>
              </div>
              <Bar pct={(t.commits / Math.max(1, week.data?.commits ?? 1)) * 100} />
            </div>
          ))}
          {(week.data?.commits ?? 0) === 0 && <span style={{ fontSize: 12, color: 'var(--faint)' }}>Aucun commit cette semaine — {week.data?.total_projects ?? 0} dépôts surveillés.</span>}
          {week.data?.busiest_day && <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>jour le plus actif : {week.data.busiest_day}</p>}
        </Card>
        <Card title="sessions claude code" lite="7 derniers jours">
          {quota.data?.available && (
            <div style={{ marginBottom: 12 }}>
              {([['session (5 h)', quota.data.five_hour], ['semaine', quota.data.seven_day]] as const).map(([label, b]) => b && (
                <div key={label} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                    <span className="mono">{label}</span>
                    <span className="num" style={{ color: b.utilization >= 90 ? 'var(--crit)' : b.utilization >= 70 ? 'var(--warn)' : 'var(--ok)' }}>
                      {Math.round(100 - b.utilization)} % restant
                    </span>
                  </div>
                  <Bar pct={b.utilization} tone={b.utilization >= 90 ? 'crit' : b.utilization >= 70 ? 'warn' : undefined} />
                  {b.resets_at && <span style={{ fontSize: 9.5, color: 'var(--faint)', fontFamily: 'var(--mono)' }}>reset {new Date(b.resets_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 10 }}>
            <div className="tile"><div className="ey">sessions</div><div className="v num">{claudeStats.data?.sessions ?? '…'}</div><div className="d">{claudeStats.data?.projects ?? 0} projets</div></div>
            <div className="tile"><div className="ey">tokens générés</div><div className="v num">{claudeStats.data ? `${(claudeStats.data.total_output_tokens / 1e6).toFixed(1)}M` : '…'}</div></div>
          </div>
          {(claudeStats.data?.models ?? []).filter((m) => !m.model.startsWith('<')).map((m) => (
            <div key={m.model} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span className="mono">{m.model.replace('claude-', '')}</span>
                <span className="num" style={{ color: 'var(--muted)' }}>{m.messages} msgs · {(m.output_tokens / 1e6).toFixed(1)}M tokens</span>
              </div>
              <Bar pct={(m.messages / Math.max(1, claudeStats.data?.models[0]?.messages ?? 1)) * 100} />
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 8 }}>
            <div className="eyebrow">consommation globale (tous modèles)</div>
            {(claudeStats.data?.consumption?.all_time ?? []).filter((m) => m.output_tokens > 0).sort((a, b) => b.output_tokens - a.output_tokens).map((m) => (
              <div key={m.model} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span className="mono">{m.model.replace('claude-', '').slice(0, 24)}</span>
                <span className="num" style={{ color: 'var(--muted)' }}>{(m.output_tokens / 1e6).toFixed(1)}M tokens</span>
              </div>
            ))}
            <p style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 6 }}>
              {claudeStats.data?.consumption?.total_sessions_all_time ?? 0} sessions au total · quota session/semaine : « /usage » dans le terminal
            </p>
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="raccourcis dossiers">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(state.data?.folders ?? []).map((p) => (
              <Btn key={p} onClick={() => folder(p)} disabled={busy === p}>
                {p.replace(/^\/home\/[^/]+/, '~')}
              </Btn>
            ))}
          </div>
        </Card>
        <Card title="comment ça marche">
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            « lancer claude » ouvre un terminal {state.data?.terminal ?? 'kitty'} sur le PC, dans le dossier
            choisi, avec <span className="mono" style={{ color: 'var(--gold)' }}>claude</span> démarré.
            Chemins limités à une liste blanche, action confirmée par token et journalisée.
          </span>
          <div className="comet" />
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip>terminal : {state.data?.terminal ?? 'kitty'}</Chip>
            <Chip tone="gold">whitelist active</Chip>
          </div>
        </Card>
      </div>
    </>
  )
}
