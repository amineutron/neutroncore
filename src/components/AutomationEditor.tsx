import { useEffect, useRef, useState } from 'react'
import { sentence, type AutomationDraft, type Catalogue, type Names } from '../lib/automations'
import { confirmDialog } from '../lib/dialog'
import { useAutomationDraft } from '../lib/useAutomationDraft'
import { AutomationDiagram } from './AutomationDiagram'
import { AutomationOptions } from './AutomationOptions'
import { ConditionsEditor, StepsEditor, TriggerEditor } from './AutomationParts'
import type { Lists } from './BlockParams'

const VIEW_STORAGE = 'neutroncore_automation_view'   // préférence d'affichage, par appareil
type Mode = 'blocks' | 'diagram'
function savedMode(): Mode {
  try { return localStorage.getItem(VIEW_STORAGE) === 'diagram' ? 'diagram' : 'blocks' } catch { return 'blocks' }
}

// Éditeur d'une automatisation, en deux vues sur le même brouillon : « blocs »
// (formulaire quand / si / alors / sinon) et « diagramme » (flux de gauche à droite).
export function AutomationEditor({ initial, catalogue, lists, names, saving, isNew, onSave, onDelete, onClose }: {
  initial: AutomationDraft; catalogue: Catalogue; lists: Lists; names: Names; saving: boolean; isNew: boolean
  onSave: (d: AutomationDraft) => void; onDelete?: () => void; onClose: () => void
}) {
  const api = useAutomationDraft(initial, catalogue, lists.scenes[0]?.id ?? '')
  const [mode, setMode] = useState<Mode>(savedMode)
  const routine = api.trigger.type === 'manual'
  function choose(m: Mode) {
    setMode(m)
    try { localStorage.setItem(VIEW_STORAGE, m) } catch { /* stockage indisponible : préférence de session */ }
  }

  // fermer = perdre le brouillon : on demande avant, quel que soit le chemin (fond, Échap, bouton retour)
  const closing = useRef(false)
  async function tryClose() {
    if (closing.current) return
    closing.current = true
    try {
      if (!api.dirty || await confirmDialog({ title: 'fermer sans enregistrer ?', body: 'Les changements seront perdus.', ok: 'fermer', cancel: 'continuer', danger: true })) onClose()
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

  return (
    <div className="pre-modal"
      onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) void tryClose() }}>
      <div className={`inner rt-editor au-editor ${mode}`} role="dialog" aria-modal="true" aria-label="Éditer l'automatisation">
        <div className="head">
          {isNew ? (routine ? 'nouvelle routine' : 'nouvelle automatisation') : 'modifier'}
          <span style={{ flex: 1 }} />
          <span className="au-modes" role="group" aria-label="Vue de l'éditeur">
            <button className={`btn sm ${mode === 'blocks' ? 'solid' : ''}`} aria-pressed={mode === 'blocks'} onClick={() => choose('blocks')}>blocs</button>
            <button className={`btn sm ${mode === 'diagram' ? 'solid' : ''}`} aria-pressed={mode === 'diagram'} onClick={() => choose('diagram')}>diagramme</button>
          </span>
          <button className="x rt-close" onClick={() => void tryClose()}>fermer</button>
        </div>
        <div className="rt-body">
          <label className="rt-field">nom
            <input value={api.meta.name} maxLength={40} placeholder="soirée film, alerte disque…" autoFocus onChange={(e) => api.patchMeta({ name: e.target.value })} />
          </label>

          {mode === 'diagram'
            ? <AutomationDiagram api={api} catalogue={catalogue} lists={lists} names={names} />
            : (
              <>
                <section className="au-block when"><h4>quand</h4><TriggerEditor api={api} catalogue={catalogue} lists={lists} /></section>
                {!routine && (
                  <section className="au-block if">
                    <h4>si <span>facultatif</span></h4>
                    <ConditionsEditor api={api} catalogue={catalogue} lists={lists} />
                  </section>
                )}
                <section className="au-block then"><h4>alors <span>dans l'ordre</span></h4><StepsEditor api={api} catalogue={catalogue} lists={lists} branch="then" /></section>
                {!routine && api.conds.length > 0 && (
                  <section className="au-block else">
                    <h4>sinon <span>facultatif — quand les conditions ne sont pas remplies</span></h4>
                    <StepsEditor api={api} catalogue={catalogue} lists={lists} branch="else" />
                  </section>
                )}
              </>
            )}

          <p className="au-sentence">{sentence(api.draft, catalogue.actions, names)}</p>
          <AutomationOptions api={api} catalogue={catalogue} />
        </div>
        <div className="rt-foot">
          {onDelete && <button className="btn danger" onClick={onDelete}>supprimer</button>}
          <span style={{ flex: 1, color: 'var(--crit)', fontSize: 12 }}>{api.error}</span>
          <button className="btn solid" disabled={Boolean(api.error) || saving} onClick={() => onSave({ ...api.draft, name: api.draft.name.trim() })}>
            {saving ? 'enregistrement…' : 'enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
