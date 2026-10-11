import { useEffect, useState } from 'react'
import { AutomationEditor } from '../components/AutomationEditor'
import type { Lists } from '../components/BlockParams'
import { FlowCanvas } from '../components/FlowCanvas'
import { RunHistory } from '../components/RunDetail'
import { Btn, Card, Chip, Eyebrow, Loader, PageTitle } from '../components/ui'
import { ApiError, apiDelete, apiGet, apiPut, withConfirm } from '../lib/api'
import { runAutomation } from '../lib/automationRun'
import {
  EMPTY_DRAFT, describeAction, describeTrigger, isRoutine, layout, nodeResult, normalize, runLabel, toDraft,
  type Automation, type AutomationDraft, type Catalogue, type Names,
} from '../lib/automations'
import { invalidateCommands } from '../lib/commands'
import { confirmDialog, toast } from '../lib/dialog'
import { ago } from '../lib/notifs'
import { usePoll } from '../lib/poll'

type Scene = { id: string; name: string; group: string }
type Listing = { automations: Automation[]; catalogue: Catalogue; running: { id: string; name: string } | null; invalid: number }
export const AUTOMATION_TARGET = 'automationTarget'   // sessionStorage : automatisation à ouvrir en arrivant (depuis l'agenda)
const HUE_ROOM = '81'

// Routines (un bouton) et automatisations (un déclencheur), au même endroit.
export function Automations() {
  const list = usePoll<Listing>(() => apiGet('/automations'), 15000)
  const scenes = usePoll<{ scenes: Scene[] }>(() => apiGet('/hue/scenes'), 300000)
  const lights = usePoll<{ lights: Record<string, { name: string }> }>(() => apiGet('/hue/lights'), 300000)
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState<Automation | 'routine' | 'automation' | null>(null)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  // passage sélectionné repéré par son horodatage : un nouveau passage en tête ne fait pas sauter la sélection
  const [runAt, setRunAt] = useState<number | null>(null)
  const cat = list.data?.catalogue
  const all = list.data?.automations ?? []

  const lists: Lists = {
    scenes: (scenes.data?.scenes ?? []).filter((s) => s.group === HUE_ROOM).map(({ id, name }) => ({ id, name })),
    lights: Object.entries(lights.data?.lights ?? {}).map(([id, l]) => ({ id, name: l.name })),
    routines: all.filter(isRoutine).map(({ id, name }) => ({ id, name })),
  }
  const names: Names = Object.fromEntries([
    ...lists.scenes.map((s) => [s.id, s.name]), ...lists.lights.map((l) => [`light:${l.id}`, l.name]),
    ...lists.routines.map((r) => [`routine:${r.id}`, r.name]),
  ])

  // arrivée depuis l'agenda : on déplie l'automatisation visée
  useEffect(() => {
    let target = ''
    try { target = sessionStorage.getItem(AUTOMATION_TARGET) ?? ''; sessionStorage.removeItem(AUTOMATION_TARGET) } catch { /* stockage indisponible */ }
    if (target) setOpen(target)
  }, [])

  async function run(a: Automation, branch: 'then' | 'else' = 'then') {
    setBusy(a.id)
    try {
      await runAutomation(a, branch)
      toast(`« ${a.name} » terminée`)
    } catch (e) {
      const taken = e instanceof ApiError && e.status === 409
      toast(taken ? 'une automatisation est déjà en cours — attends la fin' : `« ${a.name} » : ${(e as Error).message}`, taken ? 'warn' : 'crit')
    } finally { setBusy(''); setRunAt(null); list.refresh() }
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
    const draft = normalize(toDraft(a))
    const flow = isOpen ? layout(draft, cat?.actions ?? [], names, false) : null
    const runIndex = Math.max(0, a.history.findIndex((h) => h.at === runAt))
    const run_ = isOpen ? a.history[runIndex] ?? null : null
    return (
      <div className={`au-card ${a.enabled ? '' : 'off'} ${isOpen ? 'open' : ''}`} key={a.id}>
        <div className="au-head">
          <button className="au-title" onClick={() => { setOpen(isOpen ? null : a.id); setRunAt(null) }} aria-expanded={isOpen}>
            <b>{a.name}</b>
            <span>{isRoutine(a) ? a.actions.map((s) => describeAction(s, cat?.actions ?? [], names)).join(' → ') : describeTrigger(a.trigger)}</span>
          </button>
          <div className="au-tools">
            {running === a.id && <Chip tone="gold">en cours…</Chip>}
            {!isRoutine(a) && <button className={`btn sm ${a.enabled ? 'solid' : ''}`} aria-pressed={a.enabled} onClick={() => toggle(a)}>{a.enabled ? 'active' : 'en pause'}</button>}
            <Btn sm onClick={() => run(a)} disabled={busy !== '' || Boolean(running)}>{busy === a.id ? '…' : isRoutine(a) ? 'lancer' : 'essayer'}</Btn>
            {draft.otherwise.length > 0 && <Btn sm onClick={() => run(a, 'else')} disabled={busy !== '' || Boolean(running)}>essayer « sinon »</Btn>}
            <Btn sm onClick={() => setEditing(a)}>modifier</Btn>
          </div>
        </div>
        {isOpen && flow && (
          <div className="au-detail">
            <FlowCanvas flow={flow} results={run_ ? Object.fromEntries(flow.nodes.map((n) => [n.id, nodeResult(n, run_)])) : undefined} />
            <Eyebrow>derniers passages{run_ ? ' — le diagramme montre celui qui est sélectionné' : ''}</Eyebrow>
            <RunHistory runs={a.history} selected={runIndex} onSelect={(i) => setRunAt(a.history[i]?.at ?? null)} />
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
          <Card title="automatisations" lite="quand… si… alors… sinon…" style={{ marginBottom: 14 }}>
            {autos.map(card)}
            {autos.length === 0 && <p className="au-note">Aucune pour l'instant. Exemples : « quand un téléchargement se termine, notification avec son nom », « à 23:30 en semaine, si la tv est éteinte, tout éteindre », « quand plex tombe, le redémarrer, réessayer deux fois ».</p>}
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
              catalogue={cat} names={names} saving={saving}
              // une routine ne se propose pas elle-même dans « lancer une routine »
              lists={typeof editing === 'object' ? { ...lists, routines: lists.routines.filter((r) => r.id !== editing.id) } : lists}
              onSave={save} onDelete={typeof editing === 'object' ? () => remove(editing) : undefined} onClose={() => setEditing(null)}
            />
          )}
        </>
      )}
    </>
  )
}
