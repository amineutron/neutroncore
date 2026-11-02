import { useContext, useEffect, useState } from 'react'
import { NavContext } from '../App'
import '../components/audit-ux.css'
import { LOG_TARGET } from '../lib/nav'
import { LINKS } from '../lib/links'
import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { Services, type Service } from '../components/Services'
import { Btn, Card, Chip, PageTitle } from '../components/ui'

type BackupUnit = { state: 'ok' | 'failed' | 'running' | 'never' | 'missing' }
type Backups = { borg: BackupUnit; rotation: BackupUnit & { age_days: number | null }; timeshift: BackupUnit }

const LOG_UNITS = [
  { unit: 'all', label: 'tous les logs' },
  { unit: 'borg-backup.service', label: 'backup borg' },
  { unit: 'borg-backup.log', label: 'borg hebdo (détail)' },
  { unit: 'borg-rotation.service', label: 'borg tournant' },
  { unit: 'borg-rotation.log', label: 'borg tournant (détail)' },
  { unit: 'timeshift-backup.service', label: 'timeshift' },
  { unit: 'virtqemud.service', label: 'vms (qemu)' },
  { unit: 'subtitle-ai.service', label: 'sous-titres ia' },
  { unit: 'dv-webhook.service', label: 'conversion dv' },
  { unit: 'stalled-cleaner.service', label: 'stalled cleaner' },
  { unit: 'check-disk-space.service', label: 'check disque' },
]

export function Outils() {
  const res = usePoll<{ cpu_pct: number }>(() => apiGet('/system/resources'), 10000)
  const services = usePoll<{ services: Service[] }>(() => apiGet('/services'), 30000)
  const backups = usePoll<Backups>(() => apiGet('/system/backups'), 300000)
  // journal présélectionné depuis un autre écran (fiche d'un événement de l'agenda)
  const [logUnit, setLogUnit] = useState(() => {
    const wanted = sessionStorage.getItem(LOG_TARGET)
    return LOG_UNITS.some((u) => u.unit === wanted) ? wanted! : LOG_UNITS[0].unit
  })
  useEffect(() => {
    if (!sessionStorage.getItem(LOG_TARGET)) return
    sessionStorage.removeItem(LOG_TARGET)
    document.getElementById('journaux')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const journal = usePoll<{ lines: string[]; error?: string }>(
    () => apiGet(`/system/journal?unit=${logUnit}&lines=40`), 30000,
  )
  // le polling capture le fetcher courant mais ne re-déclenche pas au
  // changement d'unit : refetch immédiat ici
  useEffect(() => { journal.refresh() }, [logUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  const nav = useContext(NavContext)
  const r = res.data
  const backupBad = ['borg', 'rotation', 'timeshift'].some((k) => backups.data?.[k as 'borg']?.state === 'failed')

  return (
    <>
      <PageTitle help="outils" title="outils & vms" desc="Services, journaux et accès directs. Ressources, sauvegardes et VMs ont leur propre onglet." />

      <Services services={services.data?.services ?? []} onChange={services.refresh} />

      <div className="ou-links">
        <span>ailleurs :</span>
        <Btn sm onClick={() => nav('ressources')}>ressources{r ? ` · cpu ${r.cpu_pct} %` : ''}</Btn>
        <Btn sm onClick={() => nav('sauvegardes')}>sauvegardes</Btn>
        {backupBad && <Chip tone="crit">une sauvegarde a échoué</Chip>}
        <Btn sm onClick={() => nav('vms')}>console vms</Btn>
      </div>

      <div id="journaux" />
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
