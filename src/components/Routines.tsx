import { useState } from 'react'
import { ApiError, apiDelete, apiGet, apiPut, withConfirm } from '../lib/api'
import { invalidateCommands } from '../lib/commands'
import { confirmDialog, toast } from '../lib/dialog'
import { usePoll } from '../lib/poll'
import { runRoutine } from '../lib/routineRun'
import { describeStep, scheduleLabel, type ActionSpec, type Routine, type RoutineDraft } from '../lib/routines'
import { RoutineEditor } from './RoutineEditor'
import { Card, Chip } from './ui'

type Scene = { id: string; name: string }
type Listing = { routines: Routine[]; catalogue: ActionSpec[]; running: { id: string; name: string } | null; invalid?: number }
const EMPTY: RoutineDraft = { name: '', enabled: true, schedule: null, steps: [] }

// Routines de la maison : un bouton par enchaînement, éditeur pour les composer.
export function Routines({ scenes }: { scenes: Scene[] }) {
  const list = usePoll<Listing>(() => apiGet('/routines'), 15000)
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState<Routine | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const catalogue = list.data?.catalogue ?? []
  const sceneNames = Object.fromEntries(scenes.map((s) => [s.id, s.name]))

  async function run(r: Routine) {
    setBusy(r.id)
    try {
      await runRoutine(r)
      toast(`routine « ${r.name} » terminée`)
    } catch (e) {
      const busyElsewhere = e instanceof ApiError && e.status === 409
      toast(busyElsewhere ? 'une routine est déjà en cours — attends la fin' : `« ${r.name} » : ${(e as Error).message}`, busyElsewhere ? 'warn' : 'crit')
    } finally { setBusy(''); list.refresh() }
  }
  async function save(draft: RoutineDraft) {
    const id = editing === 'new' || editing === null ? 'new' : editing.id
    setSaving(true)
    try {
      const r = await apiPut<{ success: boolean; error?: string }>(`/routines/${id}`, { routine: draft })
      if (!r.success) throw new Error(r.error ?? 'refusé')
      setEditing(null); list.refresh(); invalidateCommands()
      toast(`routine « ${draft.name} » enregistrée`)
    } catch (e) { toast(`routine non enregistrée : ${(e as Error).message}`, 'crit') } finally { setSaving(false) }
  }
  async function remove(r: Routine) {
    if (!await confirmDialog({ title: 'supprimer la routine ?', body: r.name, ok: 'supprimer', danger: true })) return
    try {
      await apiDelete(`/routines/${r.id}`, await withConfirm('routines_delete'))
      setEditing(null); list.refresh(); invalidateCommands()
    } catch (e) { toast(`échec : ${(e as Error).message}`, 'crit') }
  }

  const routines = list.data?.routines ?? []
  return (
    <Card title="routines" lite="plusieurs actions d'un seul geste" style={{ marginTop: 14 }}>
      {list.error && <Chip tone="crit">routines indisponibles : {list.error}</Chip>}
      {(list.data?.invalid ?? 0) > 0 && <Chip tone="warn">{list.data?.invalid} routine(s) illisible(s) dans le fichier, ignorée(s)</Chip>}
      <div className="rt-list">
        {routines.map((r) => (
          <div className="rt-card" key={r.id}>
            <button className="rt-run" disabled={busy !== '' || Boolean(list.data?.running)} onClick={() => run(r)}>
              <b>{busy === r.id || list.data?.running?.id === r.id ? `${r.name} — en cours…` : r.name}</b>
              <span>{r.steps.map((s) => describeStep(s, catalogue, sceneNames)).join(' → ')}</span>
            </button>
            <div className="rt-meta">
              {r.schedule && <Chip tone={r.enabled ? 'gold' : undefined}>{scheduleLabel(r.schedule)}{r.enabled ? '' : ' · en pause'}</Chip>}
              <button className="btn sm" onClick={() => setEditing(r)} aria-label={`Modifier la routine ${r.name}`}>modifier</button>
            </div>
          </div>
        ))}
        <button className="rt-card rt-new" onClick={() => setEditing('new')} disabled={catalogue.length === 0}>
          + nouvelle routine
          {routines.length === 0 && <span>ex. « soirée film » : scène tamisée, tv allumée, plex ouvert, ampli sur tv</span>}
        </button>
      </div>
      {editing && (
        <RoutineEditor
          initial={editing === 'new' ? EMPTY : { name: editing.name, enabled: editing.enabled, schedule: editing.schedule, steps: editing.steps }}
          catalogue={catalogue} scenes={scenes} saving={saving}
          onSave={save} onDelete={editing === 'new' ? undefined : () => remove(editing)} onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}
