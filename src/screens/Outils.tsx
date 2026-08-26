import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { usePoll, fmtBytes } from '../lib/poll'
import { Bar, Card, Chip, PageTitle } from '../components/ui'

type Resources = {
  cpu_pct: number
  ram: { total: number; used: number }
  gpu: { vram_used: number; vram_total: number; utilization: number; temperature: number } | null
  disks: { path: string; used_pct: number; free: number }[]
}
type Service = { name: string; display_name: string; status: string; type: string; extra: Record<string, string> }
type Backups = { borg: { last_run: string | null; state: string }; timeshift: { last_run: string | null; state: string } }

const MEDIA_HOST = import.meta.env.VITE_MEDIA_HOST ?? 'media-server.lan'

const LINKS = [
  { name: 'plex', url: `http://${MEDIA_HOST}:32400/web` },
  { name: 'overseerr', url: `http://${MEDIA_HOST}:5055` },
  { name: 'radarr', url: `http://${MEDIA_HOST}:7878` },
  { name: 'sonarr', url: `http://${MEDIA_HOST}:8989` },
  { name: 'bazarr', url: `http://${MEDIA_HOST}:6767` },
  { name: 'qbittorrent', url: `http://${MEDIA_HOST}:8080` },
  { name: 'prowlarr', url: `http://${MEDIA_HOST}:9696` },
  { name: 'kavita', url: `http://${MEDIA_HOST}:5000` },
  { name: 'vaultwarden', url: 'http://127.0.0.1:8222' },
  { name: 'worldmonitor', url: 'https://worldmonitor.app' },
]

const LOG_UNITS = [
  { unit: 'all', label: 'tous les logs' },
  { unit: 'borg-backup.service', label: 'backup borg' },
  { unit: 'virtqemud.service', label: 'vms (qemu)' },
  { unit: 'subtitle-ai.service', label: 'sous-titres ia' },
  { unit: 'dv-webhook.service', label: 'conversion dv' },
  { unit: 'stalled-cleaner.service', label: 'stalled cleaner' },
  { unit: 'check-disk-space.service', label: 'check disque' },
]

export function Outils() {
  const res = usePoll<Resources>(() => apiGet('/system/resources'), 10000)
  const services = usePoll<{ services: Service[] }>(() => apiGet('/services'), 30000)
  const backups = usePoll<Backups>(() => apiGet('/system/backups'), 300000)
  const [logUnit, setLogUnit] = useState(LOG_UNITS[0].unit)
  const journal = usePoll<{ lines: string[]; error?: string }>(
    () => apiGet(`/system/journal?unit=${logUnit}&lines=40`), 30000,
  )
  // le polling capture le fetcher courant mais ne re-déclenche pas au
  // changement d'unit : refetch immédiat ici
  useEffect(() => { journal.refresh() }, [logUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  const vms = (services.data?.services ?? []).filter((s) => s.type === 'vm')
  const r = res.data

  const gauge = (label: string, value: string, pct: number, tone?: 'ok' | 'warn' | 'crit') => (
    <div key={label}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span className="mono" style={{ color: 'var(--muted)' }}>{label}</span>
        <span className="num">{value}</span>
      </div>
      <Bar pct={pct} tone={tone} />
    </div>
  )

  return (
    <>
      <PageTitle help="outils" title="outils & vms" desc="Machines virtuelles, backups, ressources et accès directs." />

      <Card title="services" lite="les indisponibles en premier" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[...(services.data?.services ?? [])]
            .filter((s) => s.type !== 'vm')
            .sort((a, b) => (a.status === 'up' ? 1 : 0) - (b.status === 'up' ? 1 : 0))
            .map((s) => (
              <span key={s.name} className="svc" style={s.status !== 'up' ? { borderColor: 'color-mix(in srgb, var(--crit) 45%, var(--line))' } : undefined}>
                <span className={`dot ${s.status === 'up' ? 'ok' : s.status === 'starting' ? 'warn' : s.status === 'down' ? 'crit' : 'off'}`} />
                {s.display_name}
                {s.status !== 'up' && <span style={{ color: 'var(--crit)', fontFamily: 'var(--mono)', fontSize: 9.5 }}>{s.status === 'down' ? 'down' : s.status}</span>}
              </span>
            ))}
        </div>
      </Card>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Card title="ressources">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {r && gauge('cpu', `${r.cpu_pct} %`, r.cpu_pct, 'ok')}
            {r && gauge('ram', `${fmtBytes(r.ram.used)} / ${fmtBytes(r.ram.total)}`, (r.ram.used / r.ram.total) * 100)}
            {r?.gpu && gauge('gpu vram', `${fmtBytes(r.gpu.vram_used)} / ${fmtBytes(r.gpu.vram_total)} · ${r.gpu.temperature}°`, (r.gpu.vram_used / r.gpu.vram_total) * 100)}
            {(r?.disks ?? []).map((d) =>
              gauge(d.path, `${d.used_pct} %`, d.used_pct, d.used_pct >= 92 ? 'crit' : d.used_pct >= 85 ? 'warn' : undefined),
            )}
          </div>
        </Card>
        <Card title="machines virtuelles" lite="kvm">
          <table>
            <tbody>
              {vms.map((vm) => (
                <tr key={vm.name}>
                  <td className="mono">{vm.display_name}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Chip tone={vm.status === 'up' ? 'ok' : undefined}>{vm.extra?.vm_state ?? vm.status}</Chip>
                  </td>
                </tr>
              ))}
              {vms.length === 0 && <tr><td style={{ color: 'var(--faint)', fontSize: 12 }}>Aucune VM détectée.</td></tr>}
            </tbody>
          </table>
          <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>Démarrage/arrêt : via Lyra (panneau de gauche).</p>
        </Card>
        <Card title="backups">
          <table>
            <tbody>
              <tr>
                <td><b style={{ fontSize: 12.5 }}>Borg</b><br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>/mnt/backup_cold · dim. 02:00</span></td>
                <td style={{ textAlign: 'right' }}>
                  <Chip tone={backups.data?.borg.state === 'failed' ? 'crit' : 'ok'}>
                    {backups.data?.borg.last_run ? backups.data.borg.last_run.split(' ').slice(1, 3).join(' ') : 'planifié'}
                  </Chip>
                </td>
              </tr>
              <tr>
                <td><b style={{ fontSize: 12.5 }}>Timeshift</b><br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>/backups/fast · 03:00</span></td>
                <td style={{ textAlign: 'right' }}>
                  <Chip tone={backups.data?.timeshift.state === 'failed' ? 'crit' : 'ok'}>
                    {backups.data?.timeshift.last_run ? backups.data.timeshift.last_run.split(' ').slice(1, 3).join(' ') : 'planifié'}
                  </Chip>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="derniers journaux" lite={logUnit} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {LOG_UNITS.map((u) => (
            <button key={u.unit} className={`btn sm ${logUnit === u.unit ? 'solid' : ''}`} onClick={() => setLogUnit(u.unit)}>
              {u.label}
            </button>
          ))}
        </div>
        <div className="scroll-x" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {(journal.data?.lines ?? []).map((l, i) => (
            <div className="logline" key={i} style={{ whiteSpace: 'nowrap' }}>{l}</div>
          ))}
          {(journal.data?.lines ?? []).length === 0 && (
            <span style={{ color: 'var(--faint)', fontSize: 12 }}>
              {journal.data?.error ?? 'Pas de lignes récentes (ou accès au journal système refusé).'}
            </span>
          )}
        </div>
      </Card>

      <Card title="accès directs">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {LINKS.map((l) => (
            <a key={l.name} className="btn" href={l.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              {l.name}
            </a>
          ))}
        </div>
      </Card>
    </>
  )
}
