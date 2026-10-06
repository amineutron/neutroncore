import { useEffect, useState } from 'react'
import { AutomationEditor } from '../components/AutomationEditor'
import { Btn, Card, Chip, Eyebrow, Loader, PageTitle } from '../components/ui'
import { ApiError, apiDelete, apiGet, apiPut, withConfirm } from '../lib/api'
import { runAutomation } from '../lib/automationRun'
import {
  EMPTY_DRAFT, describeAction, describeCondition, describeTrigger, isRoutine, runLabel, triggerLabel,
  type Automation, type AutomationDraft, type Catalogue,
} from '../lib/automations'
import { invalidateCommands } from '../lib/commands'
import { confirmDialog, toast } from '../lib/dialog'
import { ago } from '../lib/notifs'
import { usePoll } from '../lib/poll'

type Scene = { id: string; name: string; group: string }
type Listing = { automations: Automation[]; catalogue: Catalogue; running: { id: string; name: string } | null; invalid: number }
export const AUTOMATION_TARGET = 'automationTarget'   // sessionStorage : automatisation à ouvrir en arrivant (depuis l'agenda)

const toDraft = (a: Automation): AutomationDraft =>
  ({ name: a.name, enabled: a.enabled, trigger: a.trigger, conditions: a.conditions, actions: a.actions, cooldown_min: a.cooldown_min })

// Routines (un bouton) et automatisations (un déclencheur), au même endroit.
export function Automations() {
  const list = usePoll<Listing>(() => apiGet('/automations'), 15000)
  const scenes = usePoll<{ scenes: Scene[] }>(() => apiGet('/hue/scenes'), 300000)
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState<Automation | 'routine' | 'automation' | null>(null)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const room = (scenes.data?.scenes ?? []).filter((s) => s.group === '81')
  const sceneNames = Object.fromEntries(room.map((s) => [s.id, s.name]))
  const cat = list.data?.catalogue
  const all = list.data?.automations ?? []

  // arrivée depuis l'agenda : on déplie l'automatisation visée
  useEffect(() => {
    let target = ''
    try { target = sessionStorage.getItem(AUTOMATION_TARGET) ?? ''; sessionStorage.removeItem(AUTOMATION_TARGET) } catch { /* stockage indisponible */ }
    if (target) setOpen(target)
  }, [])

  async function run(a: Automation) {
    setBusy(a.id)
    try {
      await runAutomation(a)
      toast(`« ${a.name} » terminée`)
    } catch (e) {
      const taken = e instanceof ApiError && e.status === 409
      toast(taken ? 'une automatisation est déjà en cours — attends la fin' : `« ${a.name} » : ${(e as Error).message}`, taken ? 'warn' : 'crit')
    } finally { setBusy(''); list.refresh() }
  }
  async function save(draft: AutomationDraft) {
    const id = editing && typeof editing === 'object' ? editing.id : 'new'
    setSaving(true)
    try {
      const r = await apiPut<{ success: boolean; error?: string }>(`/automations/${id}`, { automation: draft })
      if (!r.success) throw new Error(r.error ?? 'refusé')
      setEditing(null); list.refresh(); invalidateCommands()
      toast(`« ${draft.name} » enregistrée`)
    } catch (e) { toast(`non enregistrée : ${(e as Error).message}`, 'crit') } finally { setSaving(false) }
  }
  async function remove(a: Automation) {
    if (!await confirmDialog({ title: 'supprimer ?', body: a.name, ok: 'supprimer', danger: true })) return
    try {
      await apiDelete(`/automations/${a.id}`, await withConfirm('automations_delete'))
      setEditing(null); list.refresh(); invalidateCommands()
    } catch (e) { toast(`échec : ${(e as Error).message}`, 'crit') }
  }
  async function toggle(a: Automation) {
    try {
      const r = await apiPut<{ success: boolean; error?: string }>(`/automations/${a.id}`, { automation: { ...toDraft(a), enabled: !a.enabled } })
      if (!r.success) throw new Error(r.error ?? 'refusé')
      list.refresh()
    } catch (e) { toast(`échec : ${(e as Error).message}`, 'crit') }
  }

  const running = list.data?.running?.id
  const card = (a: Automation) => {
    const last = a.history[0]
    const isOpen = open === a.id
    return (
      <div className={`au-card ${a.enabled ? '' : 'off'} ${isOpen ? 'open' : ''}`} key={a.id}>
        <div className="au-head">
          <button className="au-title" onClick={() => setOpen(isOpen ? null : a.id)} aria-expanded={isOpen}>
            <b>{a.name}</b>
            <span>{isRoutine(a) ? a.actions.map((s) => describeAction(s, cat?.actions ?? [], sceneNames)).join(' → ') : describeTrigger(a.trigger)}</span>
          </button>
          <div className="au-tools">
            {running === a.id && <Chip tone="gold">en cours…</Chip>}
            {!isRoutine(a) && <button className={`btn sm ${a.enabled ? 'solid' : ''}`} aria-pressed={a.enabled} onClick={() => toggle(a)}>{a.enabled ? 'active' : 'en pause'}</button>}
            <Btn sm onClick={() => run(a)} disabled={busy !== '' || Boolean(running)}>{busy === a.id ? '…' : isRoutine(a) ? 'lancer' : 'essayer'}</Btn>
            <Btn sm onClick={() => setEditing(a)}>modifier</Btn>
          </div>
        </div>
        {isOpen && (
          <div className="au-detail">
            <div className="au-flow">
              <span className="au-pill when">quand</span><span>{describeTrigger(a.trigger)}</span>
              {a.conditions.length > 0 && <><span className="au-pill if">si</span><span>{a.conditions.map(describeCondition).join(' et ')}</span></>}
              <span className="au-pill then">alors</span><span>{a.actions.map((s) => describeAction(s, cat?.actions ?? [], sceneNames)).join(' → ')}</span>
            </div>
            <Eyebrow>derniers passages</Eyebrow>
            {a.history.length === 0 && <p className="au-note">Aucun passage pour l'instant.</p>}
            {a.history.map((h, i) => (
              <div className="au-run" key={i}>
                <span className={`dot ${h.skipped ? 'off' : h.success ? 'ok' : 'crit'}`} />
                <span className="au-run-main">{runLabel(h)}{h.detail && <em> — {h.detail}</em>}</span>
                <span className="au-run-meta">{triggerLabel(h.trigger)}{h.why && !h.skipped && h.why !== triggerLabel(h.trigger) ? ` · ${h.why}` : ''} · {ago(h.at, Date.now())}</span>
              </div>
            ))}
          </div>
        )}
        {!isOpen && last && !isRoutine(a) && (
          <div className="au-last"><span className={`dot ${last.skipped ? 'off' : last.success ? 'ok' : 'crit'}`} /> {runLabel(last)} · {ago(last.at, Date.now())}</div>
        )}
      </div>
    )
  }

  const routines = all.filter(isRoutine), autos = all.filter((a) => !isRoutine(a))
  return (
    <>
      <PageTitle help="automatisations" title="automatisations" desc="Ce que la maison fait toute seule, et les routines qu'on lance d'un geste." />
      {list.error && <div style={{ marginBottom: 12 }}><Chip tone="crit">indisponible : {list.error}</Chip></div>}
      {(list.data?.invalid ?? 0) > 0 && <div style={{ marginBottom: 12 }}><Chip tone="warn">{list.data?.invalid} entrée(s) illisible(s) dans le fichier, ignorée(s)</Chip></div>}
      {!list.data && !list.error && <Loader />}
      {list.data && cat && (
        <>
          <Card title="automatisations" lite="quand… si… alors…" style={{ marginBottom: 14 }}>
            {autos.map(card)}
            {autos.length === 0 && <p className="au-note">Aucune pour l'instant. Exemples : « quand une alerte disque apparaît, notification sur le téléphone », « à 23:30 en semaine, tout éteindre », « quand plex tombe, le redémarrer ».</p>}
            <div style={{ marginTop: 10 }}><Btn solid onClick={() => setEditing('automation')}>+ nouvelle automatisation</Btn></div>
          </Card>
          <Card title="routines" lite="plusieurs actions d'un seul geste">
            {routines.map(card)}
            {routines.length === 0 && <p className="au-note">Aucune pour l'instant. Exemple : « soirée film » — scène tamisée, tv allumée, plex ouvert, ampli sur tv.</p>}
            <div style={{ marginTop: 10 }}><Btn onClick={() => setEditing('routine')}>+ nouvelle routine</Btn></div>
          </Card>
          {editing && (
            <AutomationEditor
              isNew={typeof editing === 'string'}
              initial={typeof editing === 'object' ? toDraft(editing)
                : editing === 'routine' ? EMPTY_DRAFT : { ...EMPTY_DRAFT, trigger: { type: 'time', params: { time: '07:30', days: [0, 1, 2, 3, 4] } } }}
              catalogue={cat} scenes={room} saving={saving}
              onSave={save} onDelete={typeof editing === 'object' ? () => remove(editing) : undefined} onClose={() => setEditing(null)}
            />
          )}
        </>
      )}
    </>
  )
}
