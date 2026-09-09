import { useContext } from 'react'
import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { NavContext } from '../App'
import { mainProject, useProjects } from '../components/Projects'
import { getSettings } from '../lib/settings'
import { MascotChain } from '../components/Mascot'
import { HomeSessions } from '../components/HomeSessions'
import { Reactor, type SubSystem } from '../components/Reactor'
import { Btn, Dot, PageTitle, Eyebrow, serviceTone } from '../components/ui'

type Alert = { level: 'warn' | 'crit'; title: string; detail: string }
type Service = { name: string; display_name: string; status: string }

export function Accueil() {
  const navigate = useContext(NavContext)
  const projects = useProjects()
  const mainP = mainProject(projects.data)
  const alerts = usePoll<{ alerts: Alert[] }>(() => apiGet('/system/alerts'), 60000)
  const services = usePoll<{ services: Service[] }>(() => apiGet('/services'), 30000)
  const qbit = usePoll<{ dl_speed_fmt: string; connection_status: string }>(() => apiGet('/qbit/stats'), 10000)
  const requests = usePoll<{ total: number }>(() => apiGet('/requests?status=pending'), 60000)
  const sessions = usePoll<{ id: string; status: string }[]>(() => apiGet('/tracking/sessions'), 10000)
  const lyra = usePoll<{ reachable: boolean }>(() => apiGet('/lyra/status'), 60000)

  const svcList = services.data?.services ?? []
  const running = (sessions.data ?? []).filter((s) => s.status === 'running').length
  const alertList = alerts.data?.alerts ?? []

  const qbitOk = qbit.data ? qbit.data.connection_status !== 'unreachable' : true
  const systems: SubSystem[] = [
    { label: 'média', state: svcList.some((s) => ['plex', 'radarr', 'sonarr'].includes(s.name) && s.status !== 'up') ? 'crit' : 'ok' },
    { label: 'téléch.', state: qbitOk ? 'ok' : 'warn' },
    { label: 'sous-titres', state: svcList.find((s) => s.name === 'bazarr')?.status === 'up' ? 'ok' : 'warn' },
    { label: 'lyra', state: lyra.data?.reachable ? 'ok' : 'warn' },
    { label: 'tracking', state: svcList.find((s) => s.name === 'tracking')?.status === 'up' ? 'ok' : 'warn' },
    { label: 'disque', state: alertList.some((a) => a.title.includes('plein') && a.level === 'crit') ? 'crit' : alertList.some((a) => a.title.includes('plein')) ? 'warn' : 'ok' },
    { label: 'timers', state: alertList.some((a) => a.title.includes('échec')) ? 'warn' : 'ok' },
    { label: 'n8n', state: svcList.find((s) => s.name === 'n8n')?.status === 'up' ? 'ok' : 'crit' },
  ]

  return (
    <>
      <PageTitle help="accueil" title="accueil" desc="Le briefing du homelab — tout l'écosystème en un regard." />
      <div className="hero">
        <Reactor systems={systems} alertCount={alertList.length} />
        <div>
          <Eyebrow>à traiter</Eyebrow>
          <div className="alerts">
            {alertList.length === 0 && (
              <div className="alert" style={{ borderLeftColor: 'var(--ok)' }}>
                <Dot s="ok" />
                <div className="t"><b>Tout est calme</b><span>Aucune alerte système en ce moment.</span></div>
              </div>
            )}
            {alertList.map((a) => (
              <div key={a.title} className={`alert ${a.level === 'crit' ? 'crit' : ''}`}>
                <Dot s={a.level} />
                <div className="t"><b>{a.title}</b><span>{a.detail}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {getSettings().mascots && (getSettings().mascotFastOn || getSettings().mascotSlowOn) && (
        <div className="card" style={{ marginBottom: 14, padding: '8px 18px' }}>
          <MascotChain
            fastName={getSettings().mascotFast}
            slowName={getSettings().mascotSlow}
            showFast={getSettings().mascotFastOn}
            showSlow={getSettings().mascotSlowOn}
          />
        </div>
      )}

      {getSettings().homeSessions && <HomeSessions />}

      <div className="tiles">
        <div className="tile" onClick={() => navigate('dl')}>
          <div className="ey">téléchargements</div>
          <div className="v num">{qbitOk ? qbit.data?.dl_speed_fmt ?? '…' : '—'}</div>
          <div className="d num">{qbitOk ? 'débit actuel' : 'qbittorrent injoignable'}</div>
        </div>
        <div className="tile" onClick={() => navigate('demandes')}>
          <div className="ey">demandes</div>
          <div className="v num">{requests.data?.total ?? '…'}<small> en attente</small></div>
          <div className="d">Overseerr</div>
        </div>
        <div className="tile" onClick={() => navigate('taches')}>
          <div className="ey">tâches de fond</div>
          <div className="v num">{running}<small> en cours</small></div>
          <div className="d">{(sessions.data ?? []).length} sessions suivies</div>
        </div>
        <div className="tile" onClick={() => navigate('outils')}>
          <div className="ey">services</div>
          <div className="v num">{svcList.filter((s) => s.status === 'up').length}<small> / {svcList.length} up</small></div>
          <div className="d">{svcList.filter((s) => s.status === 'down').length} down</div>
        </div>
        <div className="tile" onClick={() => navigate('projets')}>
          <div className="ey">projets suivis</div>
          <div className="v num">{mainP ? `${mainP.totals.percent} %` : '…'}<small> {mainP ? `${mainP.totals.done}/${mainP.totals.total}` : ''}</small></div>
          <div className="d">{mainP ? (mainP.totals.waiting > 0 ? `${mainP.name} · ${mainP.totals.waiting} en attente de toi` : mainP.name) : 'project-tracker'}</div>
        </div>
      </div>

      <Eyebrow>services</Eyebrow>
      <div className="svc-row">
        {[...svcList]
          .sort((a, b) => (a.status === 'up' ? 1 : 0) - (b.status === 'up' ? 1 : 0))
          .map((s) => (
            <span key={s.name} className="svc" style={s.status === 'down' ? { borderColor: 'color-mix(in srgb, var(--crit) 45%, var(--line))' } : undefined}>
              <Dot s={serviceTone(s.status)} />
              {s.name}
            </span>
          ))}
        {services.error && <span className="chip crit">API injoignable : {services.error}</span>}
      </div>
      {(alerts.error || sessions.error) && (
        <div style={{ marginTop: 12 }}>
          <Btn sm onClick={() => { alerts.refresh(); sessions.refresh() }}>réessayer</Btn>
        </div>
      )}
    </>
  )
}
