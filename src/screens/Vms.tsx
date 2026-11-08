import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../lib/api'
import { confirmDialog, toast } from '../lib/dialog'
import { usePoll } from '../lib/poll'
import { kindOf, type HubVm } from '../lib/vmHub'
import { POWER_LABEL, powerVm, setTemplate, useJobs, useLibrary, useOverview, type Power } from '../lib/vmHubApi'
import { runningFor, type TaskFilter } from '../lib/vmTasks'
import type { LibEntry } from '../lib/vmLibrary'
import type { Catalogue } from '../lib/vmsConsole'
import { Archives } from '../components/vmhub/Archives'
import { DeployDialog } from '../components/vmhub/DeployDialog'
import { KindPill, Legend } from '../components/vmhub/Kind'
import { Library } from '../components/vmhub/Library'
import { MachineDetail } from '../components/vmhub/MachineDetail'
import { Overview } from '../components/vmhub/Overview'
import { Tasks } from '../components/vmhub/Tasks'
import { TemplateDialog } from '../components/vmhub/TemplateDialog'
import { CloneDialog, Templates } from '../components/vmhub/Templates'
import '../components/ctl.css'
import '../components/vmhub.css'
import { Btn, Chip, Loader, PageTitle } from '../components/ui'

type TabId = 'accueil' | 'machines' | 'bibliotheque' | 'modeles' | 'archives' | 'taches'
type Dlg = { k: 'tpl'; vm: HubVm } | { k: 'deploy'; entry: LibEntry } | { k: 'clone'; vm: HubVm } | null
const STATE_DOT: Record<string, string> = { running: 'ok', stopped: 'off' }

export function Vms() {
  const ov = useOverview()
  const lib = useLibrary()
  const jobs = useJobs()
  const cat = usePoll<Catalogue>(() => apiGet('/vms-console/catalogue'), 60000)
  const [tab, setTab] = useState<TabId>('accueil')
  const [sel, setSel] = useState('')
  const [deep, setDeep] = useState('apercu')
  const [dlg, setDlg] = useState<Dlg>(null)
  const [q, setQ] = useState('')
  const [taskSel, setTaskSel] = useState('')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('toutes')
  const [just, setJust] = useState<string | null>(null)

  const vms = ov.data?.vms ?? []
  const joblist = jobs.data?.jobs ?? []
  const running = joblist.filter((j) => j.status === 'running').length
  const names = vms.map((v) => v.name)
  const busy = useMemo(() => new Set(joblist.filter((j) => j.status === 'running').map((j) => j.vm)), [joblist])
  const cur = vms.find((v) => v.name === sel)

  useEffect(() => { if (!just) return; const t = setTimeout(() => setJust(null), 9000); return () => clearTimeout(t) }, [just])

  const refresh = () => { ov.refresh(); jobs.refresh() }
  const open = (n: string, t = 'apercu') => { const v = vms.find((x) => x.name === n); setSel(n); setDeep(t); setTab(v?.meta.template ? 'modeles' : 'machines') }
  async function power(n: string, a: Power) {
    const body = { stop: 'Demande d\'arrêt propre envoyée au système.', force_stop: 'Coupure brutale, comme débrancher la machine : des fichiers peuvent être corrompus.', reboot: 'Arrêt propre puis redémarrage ; les programmes ouverts seront fermés.' }[a as string]
    if (body && !(await confirmDialog({ title: `${POWER_LABEL[a].verb} ${n} ?`, body, ok: POWER_LABEL[a].verb, danger: true }))) return
    try { await powerVm(n, a); toast(`${POWER_LABEL[a].toast} ${n}`); setTimeout(ov.refresh, 3000) } catch (e) { toast(e instanceof Error ? e.message : String(e), 'crit') }
  }
  async function untemplate(v: HubVm) {
    try { await setTemplate(v.name, false); toast(`${v.name} est de nouveau une machine : elle revient dans « machines »`); ov.refresh(); setTab('machines'); setSel(v.name) } catch (e) { toast(e instanceof Error ? e.message : String(e), 'crit') }
  }

  const act = {
    open: (n: string) => open(n), console: (n: string) => open(n, 'console'), power, seeVm: (n: string, t?: string) => open(n, t),
    fromTemplate: (n: string) => { const v = vms.find((x) => x.name === n); if (v) setDlg({ k: 'clone', vm: v }) },
    deploy: (id: string) => { const e = lib.data?.entries.find((x) => x.id === id); if (e) setDlg({ k: 'deploy', entry: e }) },
    goLibrary: () => setTab('bibliotheque'), importArchive: () => setTab('archives'), newVm: () => setTab('modeles'),
  }
  const shown = vms.filter((v) => !v.meta.template && (!q || v.name.toLowerCase().includes(q.toLowerCase())))
  const tabs: { id: TabId; label: string; n?: number; live?: boolean; pulse?: boolean }[] = [
    { id: 'accueil', label: 'accueil' }, { id: 'machines', label: 'machines' }, { id: 'bibliotheque', label: 'bibliothèque' },
    { id: 'modeles', label: 'modèles', pulse: !!just }, { id: 'archives', label: 'archives', n: ov.data?.archives.length },
    { id: 'taches', label: 'tâches', n: running || undefined, live: running > 0 },
  ]

  return (
    <div className="vh nc-scope">
      <PageTitle title="vms" desc="Machines virtuelles : familles, snapshots, bibliothèque d'images, tâches." />
      <div className="vh-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`${tab === t.id ? 'on' : ''}${t.pulse ? ' pulse' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}{t.n ? <span className={`cnt${t.live ? ' live' : ''}`}>{t.n}</span> : null}
          </button>
        ))}
      </div>
      {ov.error && !ov.data && <Chip tone="crit">{ov.error}</Chip>}
      {!ov.data && !ov.error && <Loader label="lecture des vms (quelques secondes)…" />}

      {ov.data && tab === 'accueil' && <div className="vh-enter"><Overview ov={ov.data} lib={lib.data?.entries ?? []} busy={busy} act={act} /></div>}

      {ov.data && tab === 'machines' && (
        <div className={`vh-enter vh-mgrid${sel ? ' has-sel' : ''}`}>
          <aside className="nc-stack">
            <input placeholder="chercher une machine" aria-label="chercher une machine" value={q} onChange={(e) => setQ(e.target.value)} />
            <Legend kinds={['cow', 'copy', 'own']} />
            {shown.map((v) => (
              <button key={v.name} className={`vh-trow${sel === v.name ? ' on' : ''}`} onClick={() => open(v.name)}>
                <span className={`vm-dot ${STATE_DOT[v.state] ?? 'busy'}`} /><span className="tt mono">{v.name}</span><KindPill kind={kindOf(v)} mini />
                <span className="tm">{v.vcpus ?? '?'} vcpu · {v.ram_mb ?? '?'} Mo{runningFor(joblist, v.name) ? ' · tâche en cours' : ''}</span>
              </button>
            ))}
            {shown.length === 0 && <div className="vh-empty">aucune machine ne correspond.</div>}
          </aside>
          {cur && !cur.meta.template
            ? <div style={{ minWidth: 0 }}><button className="btn sm vh-back" onClick={() => setSel('')}>← machines</button><MachineDetail key={`${cur.name}-${deep}`} vm={cur} vms={vms} jobs={joblist} names={names} cat={cat.data} onStarted={refresh} onOpen={(n) => open(n)} onRefresh={ov.refresh}
              onTemplate={(v) => setDlg({ k: 'tpl', vm: v })} onUntemplate={untemplate} initialTab={deep} onOpenTask={(id) => { setTaskSel(id); setTab('taches') }} /></div>
            : sel ? <div className="vh-empty">cette machine n'est plus dans « machines ».</div> : null}
        </div>
      )}

      {tab === 'bibliotheque' && <Library entries={lib.data?.entries ?? []} loading={!lib.data && !lib.error} error={lib.error} dirMissing={lib.data ? !lib.data.images_dir_present : false} creationReason={lib.data?.creation_tool === false ? lib.data.creation_reason || 'l\'outil de création de machines n\'est pas disponible' : undefined} onDeploy={(e) => setDlg({ k: 'deploy', entry: e })} />}
      {ov.data && tab === 'modeles' && (
        cur?.meta.template
          ? <div className="vh-enter"><Btn sm onClick={() => setSel('')}>← modèles</Btn><MachineDetail key={cur.name} vm={cur} vms={vms} jobs={joblist} names={names} cat={cat.data} onStarted={refresh} onOpen={(n) => open(n)} onRefresh={ov.refresh}
            onTemplate={(v) => setDlg({ k: 'tpl', vm: v })} onUntemplate={untemplate} initialTab="apercu" onOpenTask={() => setTab('taches')} /></div>
          : <Templates vms={vms} just={just} onCreate={(v) => setDlg({ k: 'clone', vm: v })} onOpen={(n) => open(n)} />
      )}
      {ov.data && tab === 'archives' && <Archives archives={ov.data.archives} names={names} onImported={refresh} />}
      {tab === 'taches' && <Tasks jobs={joblist} sel={taskSel} onSel={setTaskSel} filter={taskFilter} onFilter={setTaskFilter} onOpenVm={(n) => open(n)} />}

      {dlg?.k === 'tpl' && <TemplateDialog vm={dlg.vm} onClose={() => setDlg(null)} onDone={() => { setJust(dlg.vm.name); setDlg(null); setSel(''); ov.refresh() }} />}
      {dlg?.k === 'clone' && <CloneDialog source={dlg.vm} names={names} onClose={() => setDlg(null)} onDone={() => { setDlg(null); refresh(); setTab('taches') }} />}
      {dlg?.k === 'deploy' && <DeployDialog entry={dlg.entry} names={names} onClose={() => setDlg(null)} onDone={() => { setDlg(null); refresh(); setTab('taches') }} />}
    </div>
  )
}
