import { useState } from 'react'
import { fmtSize, nameError, useVmOp, type Catalogue } from '../../lib/vmsConsole'
import { Btn, Card } from '../ui'

// Clonage, export et import. Le clone accepte reseau et demarrage auto
// (les seuls reglages que l'outil fedora.vm_clone expose).
export function Copies({ vm, names, cat, onStarted, busyVm }: {
  vm: string; names: string[]; cat: Catalogue | null; onStarted: () => void; busyVm: boolean
}) {
  const [clone, setClone] = useState('')
  const [linked, setLinked] = useState(false)
  const [net, setNet] = useState('default')
  const [auto, setAuto] = useState(false)
  const [mode, setMode] = useState('classic')
  const [dry, setDry] = useState(false)
  const [archive, setArchive] = useState('')
  const [imp, setImp] = useState('')
  const op = useVmOp(onStarted)
  const base = `/vms-console/${encodeURIComponent(vm)}`
  const cloneErr = clone ? nameError(clone, names) : null
  const impErr = imp ? nameError(imp, names) : null
  const row = { display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 10 }

  return (
    <Card title="copies" lite="cloner, exporter, importer">
      <div className="eyebrow">cloner {vm}</div>
      <div style={row}>
        <input placeholder="nom du clone" value={clone} onChange={(e) => setClone(e.target.value)} />
        <input placeholder="réseau" value={net} onChange={(e) => setNet(e.target.value)} style={{ width: 110 }} />
        <label><input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} /> lié (léger)</label>
        <label><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> démarrage auto</label>
        <Btn sm solid disabled={!clone || !!cloneErr || nameError(net) !== null || busyVm || op.busy}
          onClick={() => op.run('POST', `${base}/clone`, 'clone', vm, { new_name: clone, linked, network: net, autostart: auto })}>cloner</Btn>
      </div>
      {cloneErr && <p className="lite">{cloneErr}</p>}

      <div className="eyebrow">exporter {vm}</div>
      <div style={row}>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {(cat?.export_modes ?? ['classic']).map((m) => <option key={m}>{m}</option>)}
        </select>
        <label><input type="checkbox" checked={dry} onChange={(e) => setDry(e.target.checked)} /> essai à blanc</label>
        <Btn sm disabled={busyVm || op.busy} onClick={() => op.run('POST', `${base}/export`, 'export', vm, { mode, dry_run: dry })}>exporter</Btn>
      </div>

      <div className="eyebrow">importer une archive</div>
      <div style={row}>
        <select value={archive} onChange={(e) => setArchive(e.target.value)}>
          <option value="">archive…</option>
          {(cat?.archives ?? []).map((a) => <option key={a.name} value={a.name}>{a.name} ({fmtSize(a.size)})</option>)}
        </select>
        <input placeholder="nom de la nouvelle vm" value={imp} onChange={(e) => setImp(e.target.value)} />
        <Btn sm disabled={!archive || !imp || !!impErr || op.busy}
          onClick={() => op.run('POST', '/vms-console/import', 'import', imp, { archive, new_name: imp, dry_run: dry })}>importer</Btn>
      </div>
      {impErr && <p className="lite">{impErr}</p>}
      {cat && cat.archives.length === 0 && <p className="lite">aucune archive dans ~/vm-exports</p>}
      {op.err && <p className="vm-err">{op.err}</p>}
    </Card>
  )
}
