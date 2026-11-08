import { useState } from 'react'
import { cowSavings, fmtGb, kindOf, resourceRows, type Host, type HubVm, type Metric } from '../../lib/vmHub'
import { KindPill } from './Kind'
import { Q } from './Help'

const METRICS: { id: Metric; label: string }[] = [
  { id: 'ram', label: 'mémoire' }, { id: 'vcpu', label: 'vcpu' }, { id: 'disk', label: 'disque' }, { id: 'load', label: 'charge' },
]
const col = (i: number) => `var(--vh-l${i % 6})`

function totalText(m: Metric, x: number, h: Host): string {
  return m === 'ram' ? `${(x / 1024).toFixed(1)} / ${(h.ram_mb / 1024).toFixed(0)} Go`
    : m === 'vcpu' ? `${x} / ${h.cpu} vcpu`
    : m === 'disk' ? `${fmtGb(x)} / ${h.pool_gb} Go`
    : `${x.toFixed(2)} / ${h.cpu} cœurs`
}

function rowText(m: Metric, v: HubVm, x: number, active: boolean): string {
  if (m === 'disk') return fmtGb(x) + (v.meta.base ? ' (différences)' : v.meta.template ? ' (modèle)' : '')
  if (!active) return 'éteinte'
  if (m === 'ram') return `${((v.ram_mb ?? 0) / 1024).toFixed(1)} Go${v.mem_pct != null ? ` · ${Math.round(v.mem_pct)} % utilisé` : ''}`
  if (m === 'vcpu') return `${v.vcpus ?? '?'} vcpu${v.cpu_pct != null ? ` · ${Math.round(v.cpu_pct)} % de charge` : ''}`
  return `${x.toFixed(2)} cœur(s)`
}

/** Qui consomme quoi : barre empilee + une ligne par machine, selon la ressource choisie. */
function Resources({ vms, host, onOpen }: { vms: HubVm[]; host: Host; onOpen: (n: string) => void }) {
  const [metric, setMetric] = useState<Metric>('ram')
  const r = resourceRows(vms, metric, host)
  const pos = r.rows.filter((x) => x.value > 0)
  return (
    <div>
      <div className="vh-seg" role="group" aria-label="ressource">
        {METRICS.map((m) => <button key={m.id} className={metric === m.id ? 'on' : ''} onClick={() => setMetric(m.id)}>{m.label}</button>)}
      </div>
      <div className="vh-rm" style={{ marginTop: 10 }}><span>total</span><span data-rt>{totalText(metric, r.total, host)}</span></div>
      <div className="vh-stack">{pos.map((x, i) => <b key={x.vm.name} title={x.vm.name} style={{ width: `${x.share * 100}%`, background: col(i) }} />)}</div>
      {r.rows.map((x) => {
        const idx = pos.indexOf(x)
        return (
          <div key={x.vm.name} className={`vh-rrow${x.value > 0 ? '' : ' off'}`}>
            <i style={{ background: idx >= 0 ? col(idx) : 'var(--raise)' }} />
            <span style={{ minWidth: 0 }}><button className="vh-link" onClick={() => onOpen(x.vm.name)}>{x.vm.name}</button> <KindPill kind={kindOf(x.vm)} mini /></span>
            <span className="rv">{rowText(metric, x.vm, x.value, x.active)}</span>
            <div className="rb"><b style={{ width: `${x.share * 100}%`, background: idx >= 0 ? col(idx) : 'var(--raise)' }} /></div>
          </div>
        )
      })}
    </div>
  )
}

function Meter({ label, a, b, text, help }: { label: string; a: number; b: number; text: string; help?: string }) {
  if (b <= 0) return <div><div className="vh-rm"><span>{label}{help && <Q k={help} />}</span><span>?</span></div><div className="vh-bar" /></div>
  const pct = Math.max(1, Math.min(100, (a / Math.max(1, b)) * 100))
  return (
    <div>
      <div className="vh-rm"><span>{label}{help && <Q k={help} />}</span><span>{text}</span></div>
      <div className="vh-bar"><b className={pct > 80 ? 'hi' : ''} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export function HostPanel({ vms, host, onOpen }: { vms: HubVm[]; host: Host; onOpen: (n: string) => void }) {
  const [open, setOpen] = useState(false)
  const on = vms.filter((v) => v.state === 'running' || v.state === 'starting' || v.state === 'paused')
  const ram = on.reduce((s, v) => s + (v.ram_mb ?? 0), 0)
  const cpu = on.reduce((s, v) => s + (v.vcpus ?? 0), 0)
  const pool = host.pool_used_gb
  return (
    <div className="vh-panel">
      <div className="vh-ph"><h2>état de l'hôte</h2></div>
      <div className="vh-res">
        <Meter label="mémoire" a={ram} b={host.ram_mb} text={`${(ram / 1024).toFixed(1)} / ${(host.ram_mb / 1024).toFixed(0)} Go`} />
        <Meter label="vcpu" a={cpu} b={host.cpu} text={`${cpu} / ${host.cpu}`} />
        <Meter label="stockage" a={pool} b={host.pool_gb} text={`${Math.round(pool)} / ${host.pool_gb} Go`} help="pool" />
        <div className="vh-rm" style={{ margin: 0 }}><span>économisé par les clones liés<Q k="savings" /></span><span>{fmtGb(cowSavings(vms))}</span></div>
      </div>
      <div className="vh-fold">
        <button className="t" aria-expanded={open} onClick={() => setOpen((o) => !o)}><span className="vh-chev" />répartition par machine</button>
        <Q k="res-panel" />
      </div>
      <div className={`vh-foldw${open ? ' open' : ''}`}><div>{open && <Resources vms={vms} host={host} onOpen={onOpen} />}</div></div>
    </div>
  )
}
