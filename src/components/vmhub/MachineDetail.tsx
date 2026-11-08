import { useState } from 'react'
import { apiGet } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { CPU_MODELS, LEVEL } from '../../lib/vmHelp'
import { REL_LABEL, canDestroy, canMakeTemplate, canUntemplate, fmtGb, kindOf, type HubVm } from '../../lib/vmHub'
import { runningFor, type TaskJob } from '../../lib/vmTasks'
import { saveMeta } from '../../lib/vmHubApi'
import { jobLabel, type Catalogue, type Detail, type SettingsInfo } from '../../lib/vmsConsole'
import { toast } from '../../lib/dialog'
import { Copies } from '../vms/Copies'
import { DangerPanel, ExecPanel, SettingsPanel } from '../vms/Tools'
import { VmRow } from '../VmRow'
import { Btn, Card } from '../ui'
import { Q } from './Help'
import { KindPill, Provenance } from './Kind'
import { SnapshotsHub } from './SnapshotsHub'

type Tab = 'apercu' | 'snapshots' | 'materiel' | 'copies' | 'console'
const TABS: { id: Tab; label: string }[] = [
  { id: 'apercu', label: 'aperçu' }, { id: 'snapshots', label: 'snapshots' }, { id: 'materiel', label: 'matériel' }, { id: 'copies', label: 'copies et exports' }, { id: 'console', label: 'console' },
]
type DetailRes = { success: boolean; error: string | null; detail: Detail; settings: SettingsInfo | null }
const pips = (n: number) => <span aria-label={LEVEL[n]} title={LEVEL[n]} style={{ display: 'inline-flex', gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 14, height: 6, borderRadius: 2, background: i <= n ? 'var(--vh-l1)' : 'var(--raise)' }} />)}</span>

function CpuGuide() {
  const [id, setId] = useState(CPU_MODELS[0].id)
  const m = CPU_MODELS.find((c) => c.id === id) ?? CPU_MODELS[0]
  return (
    <div className="vh-box">
      <h3>modèle de processeur<Q k="cpu-model" /></h3>
      <select value={id} onChange={(e) => setId(e.target.value)} aria-label="modèle de processeur">{CPU_MODELS.map((c) => <option key={c.id}>{c.id}</option>)}</select>
      <div style={{ display: 'grid', gap: 5, margin: '10px 0', fontSize: 12, color: 'var(--muted)' }}>
        <div className="vh-row" style={{ justifyContent: 'space-between' }}>performances {pips(m.speed)}</div>
        <div className="vh-row" style={{ justifyContent: 'space-between' }}>déplaçable (export) {pips(m.move)}</div>
        <div className="vh-row" style={{ justifyContent: 'space-between' }}>logiciels compatibles {pips(m.compat)}</div>
      </div>
      <p className="lite" style={{ margin: 0 }}>{m.text}</p>
      <p className="lite" style={{ margin: '8px 0 0' }}>Guide en lecture seule : l'outil d'édition des VMs ne gère pas encore ce champ.</p>
    </div>
  )
}

/** Fiche d'une machine : en-tete (type, etat, alimentation), onglets aperçu, snapshots, matériel, copies, console. */
export function MachineDetail({ vm, vms, jobs, names, cat, onStarted, onOpen, onRefresh, onTemplate, onUntemplate, initialTab }: {
  vm: HubVm; vms: HubVm[]; jobs: TaskJob[]; names: string[]; cat: Catalogue | null
  onStarted: () => void; onOpen: (n: string) => void; onRefresh: () => void
  onTemplate: (v: HubVm) => void; onUntemplate: (v: HubVm) => void; initialTab?: string; onOpenTask?: (id: string) => void
}) {
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : 'apercu')
  const [notes, setNotes] = useState(vm.meta.notes)
  const kind = kindOf(vm)
  const job = runningFor(jobs, vm.name)
  const detail = usePoll<DetailRes>(() => apiGet(`/vms-console/${encodeURIComponent(vm.name)}`), 15000, !vm.meta.template)
  const up = vm.state !== 'stopped'
  const busyVm = !!job
  const tplOk = canMakeTemplate(vm)
  const untplOk = canUntemplate(vms, vm.name)
  const destroyOk = canDestroy(vms, vm.name)
  const row = { name: `vm_${vm.name}`, display_name: vm.name, status: vm.status, type: 'vm', extra: { vm_state: vm.state } }

  async function persist(patch: Parameters<typeof saveMeta>[1]) {
    try { await saveMeta(vm.name, patch); onRefresh() } catch (e) { toast(e instanceof Error ? e.message : String(e), 'crit') }
  }

  return (
    <div className="vh-enter">
      <div className="vh-dhead">
        <h2>{vm.name}</h2><KindPill kind={kind} /><Q k={kind} />
        {job && <span className="vh-busy">{jobLabel(job.action)}… en cours</span>}
        <span style={{ flex: 1 }} />
        {!vm.meta.template && <Btn sm disabled={!tplOk.ok} onClick={() => onTemplate(vm)}>{tplOk.ok ? 'passer en modèle' : 'modèle : ' + tplOk.reason}</Btn>}
        {vm.meta.template && <Btn sm disabled={!untplOk.ok} onClick={() => onUntemplate(vm)}>{untplOk.ok ? 'redevenir une machine' : untplOk.reason}</Btn>}
      </div>
      {!vm.meta.template && <Card><table><tbody><VmRow key={vm.name} vm={row} onRefresh={onRefresh} i={0} /></tbody></table><span className="lite">pause, arrêt propre et arrêt forcé<Q k="state" /></span></Card>}
      <div className="vh-tabs" role="tablist" style={{ marginTop: 12 }}>
        {TABS.filter((t) => !vm.meta.template || t.id === 'apercu' || t.id === 'materiel').map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'apercu' && (
        <div className="nc-stack">
          <Card title={`type : ${kind === 'tpl' ? 'modèle' : kind === 'cow' ? 'clone lié' : kind === 'copy' ? 'copie intégrale' : 'autonome'}`}>
            <div className="vh-lab" style={{ margin: '0 0 8px' }}>provenance<Q k="prov" /></div>
            <Provenance vm={vm} vms={vms} onOpen={onOpen} />
            {vm.meta.lineage.length > 0 && <p className="lite" style={{ margin: '10px 0 0' }}>Dernier lien : {REL_LABEL[vm.meta.lineage[vm.meta.lineage.length - 1].rel]} de {vm.meta.lineage[vm.meta.lineage.length - 1].id}.</p>}
          </Card>
          <Card title="état">
            <dl className="vh-kv">
              <dt>état</dt><dd>{vm.state}</dd><dt>vcpu / mémoire</dt><dd>{vm.vcpus ?? '?'} / {vm.ram_mb ?? '?'} Mo</dd>
              <dt>disque<Q k="disk-qcow2" /></dt><dd>{fmtGb(vm.disk_used_gb)} sur {vm.disk_total_gb ?? '?'} Go</dd>
              <dt>adresse</dt><dd>{vm.ip ?? '-'}</dd><dt>snapshots</dt><dd>{vm.snapshot_count ?? 0}</dd>
            </dl>
            <div className="vh-row" style={{ marginTop: 12 }}>
              <span className="vh-lab">profil<Q k="profile" /></span>
              <div className="vh-seg" style={{ marginTop: 0 }}>{(['normal', 'examen'] as const).map((p) => <button key={p} className={vm.meta.profile === p ? 'on' : ''} onClick={() => persist({ profile: p })}>{p}</button>)}</div>
            </div>
          </Card>
          <Card title="notes">
            <textarea className="nc-ctl" style={{ width: '100%', minHeight: 70 }} aria-label="notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== vm.meta.notes && persist({ notes })} placeholder="notes sur cette machine" />
          </Card>
        </div>
      )}
      {tab === 'snapshots' && <SnapshotsHub vm={vm.name} running={vm.state === 'running'} busyVm={busyVm} onStarted={onStarted} />}
      {tab === 'materiel' && (
        <div className="nc-stack">
          <CpuGuide />
          {!vm.meta.template && <SettingsPanel vm={vm.name} up={up} detail={detail.data?.detail ?? {}} info={detail.data?.settings ?? null} onStarted={onStarted} busyVm={busyVm} />}
        </div>
      )}
      {tab === 'copies' && <div className="nc-stack"><Copies vm={vm.name} names={names} cat={cat} onStarted={onStarted} busyVm={busyVm} />
        <DangerPanel vm={vm.name} up={up} onStarted={onStarted} busyVm={busyVm} />
        {!destroyOk.ok && <p className="lite">{destroyOk.reason}</p>}</div>}
      {tab === 'console' && <ExecPanel vm={vm.name} up={vm.state === 'running'} cat={cat} onStarted={onStarted} busyVm={busyVm} />}
    </div>
  )
}
