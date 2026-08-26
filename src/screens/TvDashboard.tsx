import { useRef, useState } from 'react'
import { apiGet } from '../lib/api'
import { usePoll, fmtBytes } from '../lib/poll'
import { getSettings } from '../lib/settings'
import { MascotChain } from '../components/Mascot'
import { Reactor, type SubSystem } from '../components/Reactor'
import { HomeSessions } from '../components/HomeSessions'
import { Bar, Card, Chip, Dot } from '../components/ui'

// Tableau de bord "ecran du matin" : tout l'essentiel, dense mais lisible du lit.
type Alert = { level: 'warn' | 'crit'; title: string; detail: string }
type Service = { name: string; status: string }
type Movie = { id: number; title: string; poster: string; has_file: boolean }
type Session = { id: string; name: string; status: string; template: string; extra: Record<string, string> }
type Torrent = { hash: string; name: string; progress: number; dl_speed_fmt: string; state: string }
type CalEvent = { title: string; date: string; detail: string }

export function TvDashboard() {
  const alerts = usePoll<{ alerts: Alert[] }>(() => apiGet('/system/alerts'), 60000)
  const services = usePoll<{ services: Service[] }>(() => apiGet('/services'), 30000)
  const overview = usePoll<{ recent_movies: Movie[] }>(() => apiGet('/arr/overview'), 300000)
  const calendar = usePoll<{ events: CalEvent[] }>(() => apiGet('/arr/calendar?days=3'), 600000)
  const sessions = usePoll<Session[]>(() => apiGet('/tracking/sessions'), 15000)
  const torrents = usePoll<{ torrents: Torrent[] }>(() => apiGet('/qbit/torrents?filter=downloading'), 15000)
  const quota = usePoll<{ available: boolean; five_hour?: { utilization: number; resets_at: string }; seven_day?: { utilization: number } }>(() => apiGet('/launcher/claude-quota'), 120000)
  const week = usePoll<{ active_projects: number; commits: number; pushed_commits: number }>(() => apiGet('/projects/stats'), 600000)
  const pending = usePoll<{ total: number; requests: { title: string }[] }>(() => apiGet('/requests?status=pending'), 120000)
  const subs = usePoll<{ ai: { active_total: number; budget_spent: number; budget_total: number }; wanted_episodes_total: number }>(() => apiGet('/subtitles/status'), 300000)
  const lights = usePoll<{ lights: Record<string, { name: string; on: boolean; color?: string }> }>(() => apiGet('/hue/lights'), 60000)
  const timers = usePoll<{ timers: { unit: string; next: number | null }[]; failed_units: string[] }>(() => apiGet('/system/timers'), 120000)
  const res = usePoll<{ cpu_pct: number; ram: { total: number; used: number }; disks: { path: string; used_pct: number }[] }>(
    () => apiGet('/system/resources'), 30000)

  const svcDown = (services.data?.services ?? []).filter((s) => s.status === 'down')
  const running = (sessions.data ?? []).filter((s) => s.status === 'running')
  const s = getSettings()
  const media = res.data?.disks.find((d) => d.path === '/mnt/media')
  const systems: SubSystem[] = [
    { label: 'média', state: (services.data?.services ?? []).some((x) => ['plex', 'radarr', 'sonarr'].includes(x.name) && x.status !== 'up') ? 'crit' : 'ok' },
    { label: 'lyra', state: (services.data?.services ?? []).find((x) => x.name === 'tracking')?.status === 'up' ? 'ok' : 'warn' },
    { label: 'disque', state: media && media.used_pct >= 92 ? 'crit' : media && media.used_pct >= 85 ? 'warn' : 'ok' },
    { label: 'timers', state: (timers.data?.failed_units ?? []).length > 0 ? 'warn' : 'ok' },
    { label: 'n8n', state: (services.data?.services ?? []).find((x) => x.name === 'n8n')?.status === 'up' ? 'ok' : 'crit' },
  ]
  const autoTimers = (timers.data?.timers ?? []).filter((t) => !t.unit.startsWith('systemd-') && !t.unit.startsWith('dnf') && t.next).slice(0, 6)


  // ---- personnalisation : sections activables et ordonnables ----
  type SectionId = 'reactor' | 'alertes' | 'systeme' | 'mascottes' | 'sessions' | 'encours' | 'automatisations' | 'sorties' | 'films' | 'quota' | 'semaine' | 'demandes' | 'soustitres' | 'lumieres'
  const ALL: { id: SectionId; label: string }[] = [
    { id: 'reactor', label: 'état du cœur' },
    { id: 'alertes', label: 'alertes' },
    { id: 'systeme', label: 'système' },
    { id: 'mascottes', label: 'mascottes' },
    { id: 'sessions', label: 'sessions claude code' },
    { id: 'encours', label: 'en cours' },
    { id: 'automatisations', label: 'automatisations' },
    { id: 'sorties', label: 'prochaines sorties' },
    { id: 'films', label: 'films récents' },
    { id: 'quota', label: 'quota claude' },
    { id: 'semaine', label: 'semaine de dev' },
    { id: 'demandes', label: 'demandes en attente' },
    { id: 'soustitres', label: 'sous-titres ia' },
    { id: 'lumieres', label: 'lumières' },
  ]
  const DEFAULT_LAYOUT = { order: ALL.map((a) => a.id), enabled: Object.fromEntries(ALL.map((a) => [a.id, true])) as Record<SectionId, boolean>, sizes: Object.fromEntries(ALL.map((a) => [a.id, 2])) as Record<SectionId, number> }
  const [layout, setLayout] = useState<typeof DEFAULT_LAYOUT>(() => {
    // migration : les sources ajoutées après la sauvegarde du layout doivent
    // apparaître (fusion profonde de enabled + ajout en fin d'ordre)
    try {
      const saved = JSON.parse(localStorage.getItem('neutroncore_tv_layout') ?? '{}') as Partial<typeof DEFAULT_LAYOUT>
      const order = [...(saved.order ?? []).filter((id) => DEFAULT_LAYOUT.order.includes(id)),
        ...DEFAULT_LAYOUT.order.filter((id) => !(saved.order ?? []).includes(id))]
      return { order, enabled: { ...DEFAULT_LAYOUT.enabled, ...(saved.enabled ?? {}) }, sizes: { ...DEFAULT_LAYOUT.sizes, ...(saved.sizes ?? {}) } }
    } catch { return DEFAULT_LAYOUT }
  })
  const [editing, setEditing] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const dragFrom = useRef<SectionId | null>(null)

  function save(next: typeof DEFAULT_LAYOUT) {
    setLayout(next)
    localStorage.setItem('neutroncore_tv_layout', JSON.stringify(next))
  }
  function toggle(id: SectionId) {
    save({ ...layout, enabled: { ...layout.enabled, [id]: !layout.enabled[id] } })
  }
  function move(id: SectionId, dir: -1 | 1) {
    const order = [...layout.order]
    const i = order.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    save({ ...layout, order })
  }
  const [dragging, setDragging] = useState<SectionId | null>(null)
  // réarrangement EN DIRECT au survol (façon sortable) : fluide et prévisible
  function dragOver(target: SectionId) {
    const from = dragFrom.current
    if (!from || from === target) return
    const order = layout.order.filter((x) => x !== from)
    order.splice(order.indexOf(target), 0, from)
    if (order.join() !== layout.order.join()) save({ ...layout, order })
  }
  function setSize(id: SectionId, size: number) {
    save({ ...layout, sizes: { ...layout.sizes, [id]: size } })
  }

  // la section sessions n'a pas de zoom : s/m/l = format court / moyen / long (pleine largeur)
  const sessionsFormat = (layout.sizes.sessions ?? 2) === 1 ? 'short' : (layout.sizes.sessions ?? 2) === 3 ? 'long' : 'medium'
  const SECTIONS: Record<SectionId, () => React.JSX.Element> = {
    sessions: () => <HomeSessions tv format={sessionsFormat} />,
    reactor: () => <Reactor systems={systems} alertCount={(alerts.data?.alerts ?? []).length} />,
    alertes: () => (
      <Card title="alertes">
        {(alerts.data?.alerts ?? []).length === 0 && <Chip tone="ok">tout est calme</Chip>}
        {(alerts.data?.alerts ?? []).map((a) => (
          <div key={a.title} style={{ marginBottom: 8 }}><Dot s={a.level} /> <b style={{ fontSize: 15 }}>{a.title}</b></div>
        ))}
        {svcDown.map((sv) => (
          <div key={sv.name} style={{ marginBottom: 6 }}><Dot s="crit" /> <span className="mono">{sv.name}</span> down</div>
        ))}
      </Card>
    ),
    systeme: () => (
      <Card title="système">
        {res.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>cpu {res.data.cpu_pct}%</span><Bar pct={res.data.cpu_pct} tone="ok" /></div>
            <div><span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>ram {fmtBytes(res.data.ram.used)}</span><Bar pct={(res.data.ram.used / res.data.ram.total) * 100} /></div>
            {media && <div><span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>/mnt/media {media.used_pct}%</span><Bar pct={media.used_pct} tone={media.used_pct >= 92 ? 'crit' : media.used_pct >= 85 ? 'warn' : undefined} /></div>}
          </div>
        )}
      </Card>
    ),
    mascottes: () => (
      <Card title="lyra & les modèles">
        <MascotChain fastName={s.mascotFast} slowName={s.mascotSlow} showFast={s.mascotFastOn} showSlow={s.mascotSlowOn} />
      </Card>
    ),
    encours: () => (
      <Card title="en cours" lite={`${running.length} tâches`}>
        {running.slice(0, 5).map((t) => (
          <div key={t.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--gold)' }}>{t.extra?.phase ?? t.template}</span>
          </div>
        ))}
        {(torrents.data?.torrents ?? []).slice(0, 3).map((t) => (
          <div key={t.hash} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
            <Bar pct={t.progress} /><span className="mono num" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{t.dl_speed_fmt}</span>
          </div>
        ))}
        {running.length === 0 && (torrents.data?.torrents ?? []).length === 0 && <span style={{ color: 'var(--faint)' }}>rien en cours</span>}
      </Card>
    ),
    automatisations: () => (
      <Card title="automatisations" lite="prochains passages">
        {autoTimers.map((t) => (
          <div key={t.unit} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
            <span className="mono">{t.unit.replace('.timer', '')}</span>
            <span className="num" style={{ color: 'var(--muted)' }}>
              {t.next ? new Date(t.next * 1000).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        ))}
        {(timers.data?.failed_units ?? []).map((u) => <div key={u}><Chip tone="crit">{u} en échec</Chip></div>)}
      </Card>
    ),
    sorties: () => (
      <Card title="prochaines sorties">
        {(calendar.data?.events ?? []).slice(0, 5).map((e, i) => (
          <div key={i} style={{ marginBottom: 7, fontSize: 13.5 }}>
            <span className="mono" style={{ color: 'var(--faint)', fontSize: 11 }}>
              {e.date ? new Date(e.date).toLocaleDateString('fr-FR', { weekday: 'short' }) : '—'}
            </span>{' '}
            <b>{e.title}</b> <span style={{ color: 'var(--muted)', fontSize: 12 }}>{e.detail}</span>
          </div>
        ))}
      </Card>
    ),
    films: () => (
      <Card title="arrivés récemment">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {(overview.data?.recent_movies ?? []).filter((m) => m.has_file).slice(0, 9).map((m) => (
            <div key={m.id} className="poster">
              <div className="img" style={m.poster ? { backgroundImage: `url(${m.poster})`, backgroundSize: 'cover', color: 'transparent' } : {}}>{m.title}</div>
            </div>
          ))}
        </div>
      </Card>
    ),
    quota: () => (
      <Card title="quota claude">
        {quota.data?.available && quota.data.five_hour ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span className="mono">session 5 h</span>
              <b className="num" style={{ color: quota.data.five_hour.utilization >= 90 ? 'var(--crit)' : quota.data.five_hour.utilization >= 70 ? 'var(--warn)' : 'var(--ok)' }}>
                {Math.round(100 - quota.data.five_hour.utilization)} % restant
              </b>
            </div>
            <Bar pct={quota.data.five_hour.utilization} tone={quota.data.five_hour.utilization >= 90 ? 'crit' : quota.data.five_hour.utilization >= 70 ? 'warn' : undefined} />
            {quota.data.seven_day && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span className="mono">semaine</span>
                  <span className="num" style={{ color: 'var(--muted)' }}>{Math.round(100 - quota.data.seven_day.utilization)} % restant</span>
                </div>
                <Bar pct={quota.data.seven_day.utilization} />
              </div>
            )}
          </>
        ) : <span style={{ color: 'var(--faint)' }}>indisponible</span>}
      </Card>
    ),
    semaine: () => (
      <Card title="semaine de dev">
        <div style={{ display: 'flex', gap: 18, fontSize: 13 }}>
          <span><b className="num" style={{ fontSize: 22, fontWeight: 300 }}>{week.data?.commits ?? '…'}</b> commits</span>
          <span><b className="num" style={{ fontSize: 22, fontWeight: 300 }}>{week.data?.pushed_commits ?? '…'}</b> push</span>
          <span><b className="num" style={{ fontSize: 22, fontWeight: 300 }}>{week.data?.active_projects ?? '…'}</b> projets</span>
        </div>
      </Card>
    ),
    demandes: () => (
      <Card title="demandes en attente" lite={`${pending.data?.total ?? 0}`}>
        {(pending.data?.requests ?? []).slice(0, 4).map((r, i) => (
          <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>{r.title}</div>
        ))}
        {(pending.data?.total ?? 0) === 0 && <span style={{ color: 'var(--faint)' }}>aucune</span>}
      </Card>
    ),
    soustitres: () => (
      <Card title="sous-titres ia">
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          budget du jour : <b className="num">{subs.data?.ai.budget_spent ?? '…'} / {subs.data?.ai.budget_total ?? 5} pts</b>
        </div>
        <Bar pct={((subs.data?.ai.budget_spent ?? 0) / (subs.data?.ai.budget_total ?? 5)) * 100} />
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          {subs.data?.ai.active_total ?? 0} trads IA en place · {subs.data?.wanted_episodes_total ?? 0} épisodes en manque
        </div>
      </Card>
    ),
    lumieres: () => {
      const list = Object.values(lights.data?.lights ?? {})
      const on = list.filter((l) => l.on)
      return (
        <Card title="lumières" lite={`${on.length} sur ${list.length} allumées`}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[...new Set(on.map((l) => l.color || '#f6c177'))].slice(0, 6).map((c, i) => (
              <span key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: c, boxShadow: `0 0 10px ${c}66` }} />
            ))}
            {on.length === 0 && <span style={{ color: 'var(--faint)' }}>tout est éteint</span>}
          </div>
        </Card>
      )
    },
  }

  const visible = layout.order.filter((id) => layout.enabled[id] && SECTIONS[id])

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        {editing && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>glisse une section sur une autre, ou utilise les flèches</span>}
        <span style={{ flex: 1 }} />
        <button className={`btn sm ${editing ? 'solid' : ''}`} onClick={() => setEditing((v) => !v)}>
          {editing ? 'terminer' : 'modifier la disposition'}
        </button>
        <button className="btn sm" onClick={() => setDrawer((v) => !v)}>sources</button>
      </div>

      {drawer && (
        <div className="tv-drawer">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <b className="mono" style={{ fontSize: 13 }}>sources</b>
            <span style={{ flex: 1 }} />
            <button className="btn sm" onClick={() => setDrawer(false)}>fermer</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ALL.map((a) => (
              <button key={a.id} className={`btn sm ${layout.enabled[a.id] ? 'solid' : ''}`}
                style={{ textAlign: 'left' }} onClick={() => toggle(a.id)}>
                {layout.enabled[a.id] ? '[x] ' : '[ ] '}{a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {visible.includes('sessions') && sessionsFormat === 'long' && (
        <div className="tv-wide" style={editing ? { outline: '2px dashed var(--gold)', outlineOffset: 3, borderRadius: 12, position: 'relative' } : undefined}>
          {editing && (
            <span style={{ position: 'absolute', top: -14, right: 4, zIndex: 5, display: 'flex', gap: 4 }}>
              {[1, 2, 3].map((sz) => (
                <button key={sz} className={`btn sm ${(layout.sizes.sessions ?? 2) === sz ? 'solid' : ''}`} onClick={() => setSize('sessions', sz)}>{sz === 1 ? 's' : sz === 2 ? 'm' : 'l'}</button>
              ))}
              <button className="btn sm danger" onClick={() => toggle('sessions')}>x</button>
            </span>
          )}
          {SECTIONS.sessions()}
        </div>
      )}
      <div className="tv-cols">
        {visible.filter((id) => !(id === 'sessions' && sessionsFormat === 'long')).map((id) => (
          <div
            key={id}
            draggable={editing}
            onDragStart={(e) => { dragFrom.current = id; setDragging(id); e.dataTransfer.effectAllowed = 'move' }}
            onDragEnter={() => editing && dragOver(id)}
            onDragOver={(e) => editing && e.preventDefault()}
            onDragEnd={() => { dragFrom.current = null; setDragging(null) }}
            onDrop={(e) => { e.preventDefault(); dragFrom.current = null; setDragging(null) }}
            style={{
              zoom: id === 'sessions' ? 1 : (layout.sizes[id] ?? 2) === 1 ? 0.82 : (layout.sizes[id] ?? 2) === 3 ? 1.28 : 1,
              ...(editing ? {
                outline: dragging === id ? '2px solid var(--rose)' : '2px dashed var(--gold)',
                outlineOffset: 3, borderRadius: 12, cursor: 'grab', position: 'relative',
                opacity: dragging === id ? 0.45 : 1, transition: 'opacity .15s ease',
              } : {}),
            }}
          >
            {editing && (
              <span style={{ position: 'absolute', top: -14, right: 4, zIndex: 5, display: 'flex', gap: 4 }}>
                {[1, 2, 3].map((sz) => (
                  <button key={sz} className={`btn sm ${(layout.sizes[id] ?? 2) === sz ? 'solid' : ''}`} onClick={() => setSize(id, sz)}>
                    {sz === 1 ? 's' : sz === 2 ? 'm' : 'l'}
                  </button>
                ))}
                <button className="btn sm" onClick={() => move(id, -1)}>&lt;</button>
                <button className="btn sm" onClick={() => move(id, 1)}>&gt;</button>
                <button className="btn sm danger" onClick={() => toggle(id)}>x</button>
              </span>
            )}
            {SECTIONS[id]()}
          </div>
        ))}
      </div>
    </>
  )
}
