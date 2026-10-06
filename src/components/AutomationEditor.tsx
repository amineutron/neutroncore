import { useEffect, useRef, useState } from 'react'
import {
  MAX_CONDITIONS, completeBlock, defaultBlock, draftError, normalize, sameDraft, sentence,
  type AutomationDraft, type Block, type BlockSpec, type Catalogue, type ParamSpec, type Value,
} from '../lib/automations'
import { confirmDialog } from '../lib/dialog'
import { MAX_STEPS, defaultParams, moveStep, type Step } from '../lib/routines'
import { ParamInput, type Scene } from './BlockParams'

// clé locale stable : un bloc déplacé garde son focus et ses champs (jamais envoyée à l'API)
type Keyed<T> = T & { k: number }
let nextKey = 0
const keyed = <T,>(x: T): Keyed<T> => ({ ...x, k: ++nextKey })
const bare = <T extends { k: number }>({ k: _k, ...rest }: T) => rest

// Éditeur par blocs : QUAND (un déclencheur), SI (des conditions), ALORS (des actions).
export function AutomationEditor({ initial, catalogue, scenes, saving, isNew, onSave, onDelete, onClose }: {
  initial: AutomationDraft; catalogue: Catalogue; scenes: Scene[]; saving: boolean; isNew: boolean
  onSave: (d: AutomationDraft) => void; onDelete?: () => void; onClose: () => void
}) {
  const [meta, setMeta] = useState({ name: initial.name, enabled: initial.enabled, cooldown_min: initial.cooldown_min })
  // paramètres absents (catalogue qui a évolué) complétés dès l'ouverture : ce qui s'affiche est ce qui part
  const [trigger, setTrigger] = useState<Block>(() => completeBlock(initial.trigger, catalogue.triggers.find((t) => t.type === initial.trigger.type)))
  const [conds, setConds] = useState<Keyed<Block>[]>(() => initial.conditions.map((c) => keyed(completeBlock(c, catalogue.conditions.find((x) => x.type === c.type)))))
  const [acts, setActs] = useState<Keyed<Step>[]>(() => initial.actions.map((s) => {
    const spec = catalogue.actions.find((a) => a.action === s.action)
    return keyed({ ...s, params: { ...(spec ? defaultParams(spec, scenes[0]?.id ?? '') : {}), ...s.params } })
  }))
  const draft: AutomationDraft = normalize({ ...meta, trigger, conditions: conds.map(bare) as Block[], actions: acts.map(bare) as Step[] })
  const dirty = !sameDraft(draft, normalize(initial))
  const sceneNames = Object.fromEntries(scenes.map((s) => [s.id, s.name]))
  const error = draftError(draft)
  const triggerSpec = catalogue.triggers.find((t) => t.type === trigger.type)
  const eventful = trigger.type !== 'manual' && trigger.type !== 'time'

  // fermer = perdre le brouillon : on demande avant, quel que soit le chemin (fond, Échap, bouton retour)
  const closing = useRef(false)
  async function tryClose() {
    if (closing.current) return
    closing.current = true
    try {
      if (!dirty || await confirmDialog({ title: 'fermer sans enregistrer ?', body: 'Les changements seront perdus.', ok: 'fermer', cancel: 'continuer', danger: true })) onClose()
    } finally { closing.current = false }
  }
  // écouteur posé UNE fois (tryClose lu par référence) : ré-enregistré à chaque rendu,
  // il passerait après celui du dialogue de confirmation et rouvrirait la question
  const tryCloseRef = useRef(tryClose)
  tryCloseRef.current = tryClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.pre-modal.nc-dialog')) void tryCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const downOnBackdrop = useRef(false)

  const params = (specs: ParamSpec[], values: Record<string, Value>, set: (name: string, v: Value) => void) =>
    specs.map((p) => <ParamInput key={p.name} spec={p} value={values[p.name]} scenes={scenes} onChange={(v) => set(p.name, v)} />)
  const pickBlock = (list: BlockSpec[], type: string) => { const s = list.find((x) => x.type === type); return s ? defaultBlock(s) : null }

  return (
    <div className="pre-modal"
      onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) void tryClose() }}>
      <div className="inner rt-editor au-editor" role="dialog" aria-modal="true" aria-label="Éditer l'automatisation">
        <div className="head">
          {isNew ? 'nouvelle automatisation' : 'modifier'}
          <span style={{ flex: 1 }} />
          <button className="x rt-close" onClick={() => void tryClose()}>fermer</button>
        </div>
        <div className="rt-body">
          <label className="rt-field">nom
            <input value={meta.name} maxLength={40} placeholder="soirée film, alerte disque…" autoFocus onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))} />
          </label>

          <section className="au-block when">
            <h4>quand</h4>
            <div className="rt-step">
              <select value={trigger.type} aria-label="Déclencheur" onChange={(e) => { const b = pickBlock(catalogue.triggers, e.target.value); if (b) setTrigger(b) }}>
                {catalogue.triggers.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
              {triggerSpec && params(triggerSpec.params, trigger.params, (n, v) => setTrigger((t) => ({ ...t, params: { ...t.params, [n]: v } })))}
            </div>
            {trigger.type === 'manual' && <p className="au-note">Une routine : elle se lance d'un bouton, depuis cette page ou la palette (Ctrl+K).</p>}
            {trigger.type === 'time' && <p className="au-note">Elle apparaîtra dans l'agenda, avec le résultat de chaque passage.</p>}
          </section>

          {trigger.type !== 'manual' && (
            <section className="au-block if">
              <h4>si <span>facultatif — toutes les conditions doivent être vraies</span></h4>
              {conds.map((c) => {
                const spec = catalogue.conditions.find((x) => x.type === c.type)
                return (
                  <div className="rt-step" key={c.k}>
                    <select value={c.type} aria-label="Condition" onChange={(e) => { const b = pickBlock(catalogue.conditions, e.target.value); if (b) setConds((l) => l.map((x) => (x.k === c.k ? { ...b, k: c.k } : x))) }}>
                      {catalogue.conditions.map((x) => <option key={x.type} value={x.type}>{x.label}</option>)}
                    </select>
                    {spec && params(spec.params, c.params, (n, v) => setConds((l) => l.map((x) => (x.k === c.k ? { ...x, params: { ...x.params, [n]: v } } : x))))}
                    <span className="rt-tools"><button className="btn sm danger" aria-label="Retirer la condition" onClick={() => setConds((l) => l.filter((x) => x.k !== c.k))}>×</button></span>
                  </div>
                )
              })}
              <button className="btn sm" disabled={conds.length >= MAX_CONDITIONS || catalogue.conditions.length === 0}
                onClick={() => setConds((l) => [...l, keyed(defaultBlock(catalogue.conditions[0]))])}>+ ajouter une condition</button>
            </section>
          )}

          <section className="au-block then">
            <h4>alors <span>dans l'ordre</span></h4>
            {acts.map((s, i) => {
              const spec = catalogue.actions.find((a) => a.action === s.action)
              return (
                <div className="rt-step" key={s.k}>
                  <span className="rt-num">{i + 1}</span>
                  <select value={s.action} aria-label={`Action ${i + 1}`} onChange={(e) => {
                    const next = catalogue.actions.find((a) => a.action === e.target.value)
                    if (next) setActs((l) => l.map((x) => (x.k === s.k ? { action: next.action, params: defaultParams(next, scenes[0]?.id ?? ''), k: s.k } : x)))
                  }}>
                    {!spec && <option value={s.action}>{s.action}</option>}
                    {catalogue.actions.map((a) => <option key={a.action} value={a.action}>{a.label}</option>)}
                  </select>
                  {spec && params(spec.params, s.params, (n, v) => setActs((l) => l.map((x) => (x.k === s.k ? { ...x, params: { ...x.params, [n]: v as Step['params'][string] } } : x))))}
                  <span className="rt-tools">
                    <button className="btn sm" aria-label={`Monter l'action ${i + 1}`} disabled={i === 0} onClick={() => setActs((l) => moveStep(l, i, -1) as Keyed<Step>[])}>↑</button>
                    <button className="btn sm" aria-label={`Descendre l'action ${i + 1}`} disabled={i === acts.length - 1} onClick={() => setActs((l) => moveStep(l, i, 1) as Keyed<Step>[])}>↓</button>
                    <button className="btn sm danger" aria-label={`Retirer l'action ${i + 1}`} onClick={() => setActs((l) => l.filter((x) => x.k !== s.k))}>×</button>
                  </span>
                </div>
              )
            })}
            <button className="btn sm" disabled={acts.length >= MAX_STEPS || catalogue.actions.length === 0}
              onClick={() => { const a = catalogue.actions[0]; setActs((l) => [...l, keyed({ action: a.action, params: defaultParams(a, scenes[0]?.id ?? '') })]) }}>+ ajouter une action</button>
          </section>

          <p className="au-sentence">{sentence(draft, catalogue.actions, sceneNames)}</p>

          {trigger.type !== 'manual' && (
            <div className="rt-sched">
              <label className="rt-check">
                <input type="checkbox" checked={meta.enabled} onChange={(e) => setMeta((m) => ({ ...m, enabled: e.target.checked }))} />
                active
              </label>
              {eventful && (
                <label className="rt-check">au plus une fois toutes les
                  <select value={meta.cooldown_min} aria-label="Délai minimal entre deux lancements" onChange={(e) => setMeta((m) => ({ ...m, cooldown_min: Number(e.target.value) }))}>
                    {[...new Set([1, 5, 15, 60, 360, 1440, meta.cooldown_min])].sort((a, b) => a - b).map((v) => (
                      <option key={v} value={v}>{v < 60 ? `${v} min` : v % 60 === 0 ? `${v / 60} h` : `${Math.floor(v / 60)} h ${v % 60}`}</option>
                    ))}
                  </select>
                </label>
              )}
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
