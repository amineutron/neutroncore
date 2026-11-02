import { useState } from 'react'
import { confirmDialog } from '../../lib/dialog'
import { useVmOp, type SettingsInfo } from '../../lib/vmsConsole'
import { DEFAULT_LIMITS, draftFrom, editErrors, editPayload, editSummary, needsStop, type EditCurrent, type EditDraft } from '../../lib/vmsEdit'
import { Btn, Chip } from '../ui'

// Edition des parametres d'une VM : processeurs, memoire (VM arretee), demarrage auto.
// Seuls les champs modifies sont envoyes ; l'API et l'outil vm_edit re-verifient tout.
export function EditSettings({ vm, up, info, onStarted, busyVm }: {
  vm: string; up: boolean; info: SettingsInfo; onStarted: () => void; busyVm: boolean
}) {
  const initial = draftFrom(info.current as EditCurrent)
  const [d, setD] = useState<EditDraft>(initial)
  const op = useVmOp(onStarted)
  const lim = info.limits ?? DEFAULT_LIMITS
  const errs = editErrors(d, lim)
  const payload = editPayload(initial, d)
  const stopNeeded = needsStop(payload, info.needs_stop)
  const blocked = stopNeeded && up
  const dirty = Object.keys(payload).length > 0
  const set = (p: Partial<EditDraft>) => setD((x) => ({ ...x, ...p }))

  async function save() {
    const ok = await confirmDialog({ title: `modifier ${vm} ?`, body: editSummary(payload) + (stopNeeded ? ' (effectif au prochain démarrage)' : ''), ok: 'enregistrer' })
    if (ok) await op.run('POST', `/vms-console/${encodeURIComponent(vm)}/edit`, 'edit', vm, payload)
  }

  const field = (label: string, key: 'vcpus' | 'memory_mib', range: [number, number], unit: string) => (
    <label style={{ display: 'grid', gap: 4 }}>
      <span className="lite">{label} ({range[0]} à {range[1]} {unit})</span>
      <input inputMode="numeric" value={d[key]} onChange={(e) => set({ [key]: e.target.value })} aria-invalid={!!errs[key]} />
      {errs[key] && <span className="lite" style={{ color: 'var(--rose, #eb6f92)' }}>{errs[key]}</span>}
    </label>
  )

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 10 }}>
        {field('processeurs', 'vcpus', lim.vcpus, '')}
        {field('mémoire', 'memory_mib', lim.memory_mib, 'Mio')}
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={d.autostart} onChange={(e) => set({ autostart: e.target.checked })} /> démarrage auto
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <Btn sm solid disabled={!dirty || blocked || Object.keys(errs).length > 0 || busyVm || op.busy} onClick={save}>enregistrer</Btn>
        <Btn sm disabled={!dirty || op.busy} onClick={() => setD(initial)}>annuler</Btn>
        {blocked && <Chip tone="warn">arrête la vm pour changer les processeurs ou la mémoire</Chip>}
        {!blocked && stopNeeded && <span className="lite">effectif au prochain démarrage</span>}
      </div>
      <p className="lite">{info.not_editable}</p>
      {op.err && <p className="vm-err">{op.err}</p>}
    </div>
  )
}
