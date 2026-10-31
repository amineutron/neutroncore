import { useState } from 'react'
import { apiPost } from '../../lib/api'
import { confirmTwice, useVmOp, type Catalogue, type Detail, type SettingsInfo } from '../../lib/vmsConsole'
import { Btn, Card, Chip } from '../ui'
import { EditSettings } from './EditSettings'

// Commande du catalogue ferme (aucun texte libre), verification, reglages.
export function ExecPanel({ vm, up, cat, onStarted, busyVm }: {
  vm: string; up: boolean; cat: Catalogue | null; onStarted: () => void; busyVm: boolean
}) {
  const [id, setId] = useState('uptime')
  const [report, setReport] = useState('')
  const [vErr, setVErr] = useState('')
  const [checking, setChecking] = useState(false)
  const op = useVmOp(onStarted)

  async function verify() {
    setChecking(true); setVErr(''); setReport('')
    try {
      const r = await apiPost<{ success: boolean; error: string | null; report: string }>(`/vms-console/${encodeURIComponent(vm)}/verify`)
      if (r.success) setReport(r.report); else setVErr(r.error ?? 'verification impossible')
    } catch (e) { setVErr((e as Error).message) } finally { setChecking(false) }
  }

  return (
    <Card title="commande et vérification">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {(cat?.exec ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <span className="mono lite">{cat?.exec.find((c) => c.id === id)?.command}</span>
        <Btn sm solid disabled={!up || busyVm || op.busy} onClick={() => op.run('POST', `/vms-console/${encodeURIComponent(vm)}/exec`, 'exec', vm, { id })}>lancer</Btn>
        <Btn sm disabled={!up || checking} onClick={verify}>{checking ? 'vérification…' : 'vérifier le clone'}</Btn>
      </div>
      {!up && <p className="lite">la vm doit être démarrée</p>}
      {op.err && <p className="vm-err">{op.err}</p>}
      {vErr && <p className="vm-err">{vErr}</p>}
      {report && <pre className="mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{report}</pre>}
    </Card>
  )
}

const FIELDS: [string, string][] = [['vcpus', 'processeurs'], ['ram', 'mémoire'], ['disk_used', 'disque utilisé'],
  ['disk_total', 'disque max'], ['storage', 'stockage'], ['persistent', 'persistante'], ['autostart', 'démarrage auto']]

export function SettingsPanel({ vm, up, detail, info, onStarted, busyVm }: {
  vm: string; up: boolean; detail: Detail; info: SettingsInfo | null; onStarted: () => void; busyVm: boolean
}) {
  const cur = (info?.current ?? detail) as Record<string, unknown>
  const editKey = `${vm}|${cur.vcpus}|${cur.memory_mib}|${cur.autostart_on}`   // remonte le formulaire quand les valeurs reelles changent
  return (
    <Card title="paramètres" lite={info?.editable ? 'modifiables' : 'lecture seule'}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
        {FIELDS.map(([k, l]) => (
          <div key={k}><div className="lite">{l}</div><div className="mono">{String(cur[k] ?? '-')}</div></div>
        ))}
      </div>
      {info?.editable && <EditSettings key={editKey} vm={vm} up={up} info={info} onStarted={onStarted} busyVm={busyVm} />}
      {info && !info.editable && <p className="lite" style={{ marginTop: 10 }}><Chip tone="warn">non modifiable ici</Chip></p>}
    </Card>
  )
}

export function DangerPanel({ vm, up, onStarted, busyVm }: { vm: string; up: boolean; onStarted: () => void; busyVm: boolean }) {
  const [typed, setTyped] = useState('')
  const [keep, setKeep] = useState(false)
  const op = useVmOp(onStarted)
  async function destroy() {
    if (await confirmTwice('supprimer la vm', `${vm}, définition ${keep ? 'seule' : 'et disques'}`)) {
      await op.run('POST', `/vms-console/${encodeURIComponent(vm)}/destroy`, 'destroy', vm, { confirm_name: typed, keep_storage: keep })
    }
  }
  return (
    <Card title="zone dangereuse">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder={`retape « ${vm} » pour supprimer`} value={typed} onChange={(e) => setTyped(e.target.value)} />
        <label><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> garder les disques</label>
        <Btn sm danger disabled={typed !== vm || up || busyVm || op.busy} onClick={destroy}>supprimer la vm</Btn>
      </div>
      {up && <p className="lite">arrête la vm avant de la supprimer</p>}
      {op.err && <p className="vm-err">{op.err}</p>}
    </Card>
  )
}
