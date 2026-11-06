import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { useVms } from '../lib/vms'
import {
  filterVms, loadFilters, saveFilters, vmName,
  type Catalogue, type Detail, type Filters, type Job, type SettingsInfo,
} from '../lib/vmsConsole'
import { Copies } from '../components/vms/Copies'
import { Jobs } from '../components/vms/Jobs'
import { Snapshots } from '../components/vms/Snapshots'
import { DangerPanel, ExecPanel, SettingsPanel } from '../components/vms/Tools'
import { VmRow } from '../components/VmRow'
import '../components/ctl.css'
import { Btn, Card, Chip, Loader, PageTitle } from '../components/ui'

type DetailRes = { success: boolean; error: string | null; detail: Detail; settings: SettingsInfo | null }

export function Vms() {
  const { data, loading, error, refresh } = useVms()
  const [filters, setFilters] = useState<Filters>(loadFilters)
  const [sel, setSel] = useState('')
  const jobs = usePoll<{ jobs: Job[] }>(() => apiGet('/vms-console/jobs'), 3000)
  const cat = usePoll<Catalogue>(() => apiGet('/vms-console/catalogue'), 60000)
  const detail = usePoll<DetailRes>(() => (sel ? apiGet(`/vms-console/${encodeURIComponent(sel)}`) : Promise.resolve({ success: false, error: null, detail: {}, settings: null })), 15000, !!sel)

  useEffect(() => saveFilters(filters), [filters])

  const all = data?.vms ?? []
  const shown = filterVms(all, filters)
  const names = all.map(vmName)
  const cur = all.find((v) => vmName(v) === sel)
  const busyVm = (jobs.data?.jobs ?? []).some((j) => j.vm === sel && j.status === 'running')
  const onStarted = () => { jobs.refresh(); setTimeout(() => { refresh(); detail.refresh() }, 3000) }
  const set = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }))

  return (
    <>
      <PageTitle title="vms" desc="Console des machines virtuelles : état, snapshots, copies, commandes." />
      <div className="nc-scope nc-stack">
      <Card title="machines" lite={data ? `${shown.length} / ${all.length}` : undefined}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          {(['all', 'up', 'down'] as const).map((s) => (
            <Btn key={s} sm solid={filters.state === s} onClick={() => set({ state: s })}>{s === 'all' ? 'toutes' : s === 'up' ? 'allumées' : 'éteintes'}</Btn>
          ))}
          <input placeholder="chercher" value={filters.q} onChange={(e) => set({ q: e.target.value })} />
          <Btn sm onClick={refresh} disabled={loading}>{loading ? '...' : 'actualiser'}</Btn>
          {data?.stale && <Chip tone="warn">dernier état connu</Chip>}
        </div>
        {error && <Chip tone="crit">{error}</Chip>}
        {!data && <Loader label="lecture des vms (quelques secondes)…" />}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {shown.map((v) => (
            <Btn key={v.name} sm solid={vmName(v) === sel} onClick={() => setSel(vmName(v))}>
              {vmName(v)} {v.status === 'up' ? '(allumée)' : ''}
            </Btn>
          ))}
        </div>
        {data && all.length === 0 && (
          <p className="lite">
            aucune vm reçue{data.error ? ` (${data.error})` : data.stale ? ' : le démon lyra ne répond pas encore' : ''}.
            {' '}Nouvel essai automatique… ou touche « actualiser ».
          </p>
        )}
        {data && all.length > 0 && shown.length === 0 && <p className="lite">aucune vm ne correspond aux filtres</p>}
      </Card>

      <Jobs jobs={jobs.data?.jobs ?? []} />

      {!sel && <Card><p className="nc-empty">choisis une vm pour ouvrir sa console</p></Card>}
      {cur && (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="nc-stack">
            <Card title={vmName(cur)} lite={detail.data?.detail.state}>
              <table><tbody><VmRow key={cur.name} vm={cur} onRefresh={() => { refresh(); detail.refresh() }} i={0} /></tbody></table>
              {detail.data && !detail.data.success && detail.data.error && <Chip tone="crit">{detail.data.error}</Chip>}
              {detail.data?.success && (
                <p className="lite mono">
                  ip {detail.data.detail.ip ?? '-'} - ssh {detail.data.detail.ssh ?? '-'} - {detail.data.detail.snapshot_count ?? 0} snapshot(s)
                </p>
              )}
            </Card>
            <SettingsPanel vm={sel} up={cur.status !== 'down'} detail={detail.data?.detail ?? {}} info={detail.data?.settings ?? null}
              onStarted={onStarted} busyVm={busyVm} />
            <ExecPanel vm={sel} up={cur.status === 'up'} cat={cat.data} onStarted={onStarted} busyVm={busyVm} />
          </div>
          <div className="nc-stack">
            <Snapshots key={sel} vm={sel} onStarted={onStarted} busyVm={busyVm} />
            <Copies vm={sel} names={names} cat={cat.data} onStarted={onStarted} busyVm={busyVm} />
            <DangerPanel vm={sel} up={cur.status !== 'down'} onStarted={onStarted} busyVm={busyVm} />
          </div>
        </div>
      )}
      </div>
    </>
  )
}
