import { useEffect, useRef, useState } from 'react'
import { confirmDialog } from '../lib/dialog'
import {
  DAYS, MAX_STEPS, defaultParams, describeStep, draftError, moveStep, toggleDay,
  type ActionSpec, type ParamSpec, type RoutineDraft, type Step,
} from '../lib/routines'
import { NumField } from './NumField'

type Scene = { id: string; name: string }
// clé locale stable : une étape déplacée garde son focus et ses champs (jamais envoyée à l'API)
type Row = Step & { k: number }
let nextKey = 0
const withKey = (s: Step): Row => ({ ...s, k: ++nextKey })
const strip = ({ action, params }: Row): Step => ({ action, params })

function ParamInput({ spec, value, scenes, onChange }: {
  spec: ParamSpec; value: Step['params'][string]; scenes: Scene[]; onChange: (v: Step['params'][string]) => void
}) {
  if (spec.type === 'bool') {
    return (
      <select value={value ? '1' : '0'} aria-label={spec.name} onChange={(e) => onChange(e.target.value === '1')}>
        <option value="1">allumer</option><option value="0">éteindre</option>
      </select>
    )
  }
  if (spec.type === 'choice') {
    return (
      <select value={String(value)} aria-label={spec.name} onChange={(e) => onChange(e.target.value)}>
        {spec.choices.map((c) => <option key={c} value={c}>{c.toLowerCase().replace('follow_', '').replace('_light', '')}</option>)}
      </select>
    )
  }
  if (spec.type === 'id') {
    return (
      <select value={String(value ?? '')} aria-label="scène" onChange={(e) => onChange(e.target.value)}>
        {!scenes.some((s) => s.id === value) && <option value={String(value ?? '')}>{value ? 'scène supprimée' : 'choisir…'}</option>}
        {scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    )
  }
  const n = Number(value)
  return <NumField value={Number.isFinite(n) ? n : spec.min} min={spec.min} max={spec.max} label={spec.name} onCommit={onChange} />
}

// Éditeur d'une routine : nom, étapes (dans l'ordre d'exécution), planification facultative.
export function RoutineEditor({ initial, catalogue, scenes, saving, onSave, onDelete, onClose }: {
  initial: RoutineDraft; catalogue: ActionSpec[]; scenes: Scene[]; saving: boolean
  onSave: (d: RoutineDraft) => void; onDelete?: () => void; onClose: () => void
}) {
  const [meta, setMeta] = useState({ name: initial.name, enabled: initial.enabled, schedule: initial.schedule })
  const [rows, setRows] = useState<Row[]>(() => initial.steps.map(withKey))
  const draft: RoutineDraft = { ...meta, steps: rows.map(strip) }
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const sceneNames = Object.fromEntries(scenes.map((s) => [s.id, s.name]))
  const error = draftError(draft)
  const patchRow = (k: number, step: Step) => setRows((r) => r.map((x) => (x.k === k ? { ...step, k } : x)))

  // fermer = perdre le brouillon : on demande avant, quel que soit le chemin (fond, Échap, bouton retour)
  const closing = useRef(false)
  async function tryClose() {
    if (closing.current) return
    closing.current = true
    try {
      if (!dirty || await confirmDialog({ title: 'fermer sans enregistrer ?', body: 'Les changements de cette routine seront perdus.', ok: 'fermer', cancel: 'continuer', danger: true })) onClose()
    } finally { closing.current = false }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // le dialogue de confirmation, s'il est ouvert par-dessus, traite Échap lui-même
      if (e.key === 'Escape' && !document.querySelector('.pre-modal.nc-dialog')) void tryClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  function addStep() {
    const spec = catalogue[0]
    if (spec) setRows((r) => [...r, withKey({ action: spec.action, params: defaultParams(spec, scenes[0]?.id ?? '') })])
  }
  function changeAction(k: number, action: string) {
    const spec = catalogue.find((a) => a.action === action)
    if (spec) patchRow(k, { action, params: defaultParams(spec, scenes[0]?.id ?? '') })
  }
  // le fond ne ferme que si l'appui ET le relâchement ont eu lieu dessus (une
  // sélection de texte qui déborde de la boîte ne doit pas fermer l'éditeur)
  const downOnBackdrop = useRef(false)

  return (
    <div className="pre-modal"
      onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) void tryClose() }}>
      <div className="inner rt-editor" role="dialog" aria-modal="true" aria-label="Éditer la routine">
        <div className="head">
          {onDelete ? 'modifier la routine' : 'nouvelle routine'}
          <span style={{ flex: 1 }} />
          <button className="x rt-close" onClick={() => void tryClose()}>fermer</button>
        </div>
        <div className="rt-body">
          <label className="rt-field">nom
            <input value={meta.name} maxLength={40} placeholder="soirée film" autoFocus
              onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} />
          </label>

          <div className="rt-cap">étapes — exécutées dans l'ordre</div>
          {rows.map((s, i) => {
            const spec = catalogue.find((a) => a.action === s.action)
            return (
              <div className="rt-step" key={s.k}>
                <span className="rt-num">{i + 1}</span>
                <select value={s.action} aria-label={`Action de l'étape ${i + 1}`} onChange={(e) => changeAction(s.k, e.target.value)}>
                  {!spec && <option value={s.action}>{s.action}</option>}
                  {catalogue.map((a) => <option key={a.action} value={a.action}>{a.label}</option>)}
                </select>
                {spec?.params.map((p) => (
                  <ParamInput key={p.name} spec={p} value={s.params[p.name]} scenes={scenes}
                    onChange={(v) => patchRow(s.k, { action: s.action, params: { ...s.params, [p.name]: v } })} />
                ))}
                <span className="rt-tools">
                  <button className="btn sm" aria-label={`Monter l'étape ${i + 1}`} disabled={i === 0} onClick={() => setRows((r) => moveStep(r, i, -1) as Row[])}>↑</button>
                  <button className="btn sm" aria-label={`Descendre l'étape ${i + 1}`} disabled={i === rows.length - 1} onClick={() => setRows((r) => moveStep(r, i, 1) as Row[])}>↓</button>
                  <button className="btn sm danger" aria-label={`Retirer l'étape ${i + 1}`} onClick={() => setRows((r) => r.filter((x) => x.k !== s.k))}>×</button>
                </span>
              </div>
            )
          })}
          <button className="btn sm" disabled={rows.length >= MAX_STEPS} onClick={addStep}>+ ajouter une étape</button>
          {rows.length > 0 && (
            <p className="rt-summary">{draft.steps.map((s) => describeStep(s, catalogue, sceneNames)).join(' → ')}</p>
          )}

          <div className="rt-cap">lancement automatique</div>
          <label className="rt-check">
            <input type="checkbox" checked={meta.schedule !== null}
              onChange={(e) => setMeta((m) => ({ ...m, schedule: e.target.checked ? { time: '07:30', days: [0, 1, 2, 3, 4] } : null }))} />
            lancer à heure fixe
          </label>
          {meta.schedule && (
            <div className="rt-sched">
              <input type="time" value={meta.schedule.time} aria-label="Heure de lancement"
                onChange={(e) => e.target.value && setMeta((m) => (m.schedule ? { ...m, schedule: { ...m.schedule, time: e.target.value } } : m))} />
              {DAYS.map((label, day) => (
                <button key={label} className={`btn sm ${meta.schedule?.days.includes(day) ? 'solid' : ''}`} aria-pressed={meta.schedule?.days.includes(day)}
                  onClick={() => setMeta((m) => (m.schedule ? { ...m, schedule: toggleDay(m.schedule, day) } : m))}>{label}</button>
              ))}
              <label className="rt-check">
                <input type="checkbox" checked={meta.enabled} onChange={(e) => setMeta((m) => ({ ...m, enabled: e.target.checked }))} />
                planification active
              </label>
            </div>
          )}
        </div>
        <div className="rt-foot">
          {onDelete && <button className="btn danger" onClick={onDelete}>supprimer</button>}
          <span style={{ flex: 1, color: 'var(--crit)', fontSize: 12 }}>{error}</span>
          <button className="btn solid" disabled={Boolean(error) || saving} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>
            {saving ? 'enregistrement…' : 'enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
