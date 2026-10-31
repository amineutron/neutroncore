import { useState } from 'react'
import { apiGet } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { confirmTwice, nameError, useVmOp, type Snap } from '../../lib/vmsConsole'
import { Btn, Card, Chip } from '../ui'

// Snapshots d'une VM : liste en arbre, creer, restaurer, supprimer.
// Restaurer et supprimer demandent deux confirmations distinctes.
export function Snapshots({ vm, onStarted, busyVm }: { vm: string; onStarted: () => void; busyVm: boolean }) {
  const list = usePoll<{ success: boolean; error: string | null; snapshots: Snap[] }>(
    () => apiGet(`/vms-console/${encodeURIComponent(vm)}/snapshots`), 20000)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [live, setLive] = useState(false)
  const op = useVmOp(() => { onStarted(); setTimeout(list.refresh, 4000) })
  const snaps = list.data?.snapshots ?? []
  const bad = name ? nameError(name, snaps.map((s) => s.name)) : null
  const base = `/vms-console/${encodeURIComponent(vm)}/snapshots`

  async function restore(s: string) {
    if (await confirmTwice('restaurer', `la vm ${vm} reviendra à l'état du snapshot ${s} (l'état actuel est perdu)`)) {
      await op.run('POST', `${base}/${encodeURIComponent(s)}/restore`, 'snapshot_restore', vm)
    }
  }
  async function remove(s: string) {
    if (await confirmTwice('supprimer le snapshot', `${s} de la vm ${vm}`)) {
      await op.run('DELETE', `${base}/${encodeURIComponent(s)}`, 'snapshot_delete', vm)
    }
  }

  return (
    <Card title="snapshots" lite={list.data ? `${snaps.length}` : undefined}>
      {list.data && !list.data.success && <Chip tone="crit">{list.data.error}</Chip>}
      {list.data?.success && snaps.length === 0 && <p className="lite">aucun snapshot</p>}
      {snaps.map((s) => (
        <div key={s.name} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', paddingLeft: s.depth * 18 }}>
          <span className="mono" style={{ flex: 1 }}>{s.depth > 0 ? '+ ' : ''}{s.name}</span>
          <Btn sm disabled={busyVm || op.busy} onClick={() => restore(s.name)}>restaurer</Btn>
          <Btn sm danger disabled={busyVm || op.busy} onClick={() => remove(s.name)}>supprimer</Btn>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
        <input placeholder="nom du snapshot" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="description (facultatif)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <label><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> à chaud (mémoire)</label>
        <Btn sm solid disabled={!name || !!bad || busyVm || op.busy}
          onClick={async () => { if (await op.run('POST', base, 'snapshot_create', vm, { name, description: desc, live })) setName('') }}>
          créer
        </Btn>
      </div>
      {bad && <p className="lite" style={{ color: 'var(--rose, #eb6f92)' }}>{bad}</p>}
      {op.err && <p className="vm-err">{op.err}</p>}
    </Card>
  )
}
