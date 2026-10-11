import { useState } from 'react'
import { layout, type Catalogue, type FlowNode, type Names } from '../lib/automations'
import type { Branch, DraftApi } from '../lib/useAutomationDraft'
import { ConditionsEditor, StepEditor, TriggerEditor } from './AutomationParts'
import type { Lists } from './BlockParams'
import { FlowCanvas } from './FlowCanvas'

// Sélection : le déclencheur, la porte « si », ou une action repérée par sa CLÉ
// (pas son rang) — déplacée ou voisine d'une action supprimée, elle reste la même.
type Selected = { kind: 'trigger' } | { kind: 'if' } | { kind: 'step'; branch: Branch; k: number } | { kind: 'last'; branch: Branch }

// Vue « diagramme » de l'éditeur : le flux se lit de gauche à droite, on touche un
// nœud pour le régler dans l'inspecteur dessous, les « + » ajoutent un bloc.
export function AutomationDiagram({ api, catalogue, lists, names }: { api: DraftApi; catalogue: Catalogue; lists: Lists; names: Names }) {
  const [selected, setSelected] = useState<Selected>({ kind: 'trigger' })
  const flow = layout(api.draft, catalogue.actions, names, true, catalogue.limits.actions)
  const stepsOf = (b: Branch) => (b === 'then' ? api.then : api.other)

  // « last » : l'action qu'on vient d'ajouter (sa clé n'existe qu'au rendu suivant)
  const current: Selected = selected.kind === 'last'
    ? (stepsOf(selected.branch).length ? { kind: 'step', branch: selected.branch, k: stepsOf(selected.branch).at(-1)!.k } : { kind: 'trigger' })
    : selected
  const index = current.kind === 'step' ? stepsOf(current.branch).findIndex((s) => s.k === current.k) : -1
  const nodeId = current.kind === 'step' ? `${current.branch}-${index}` : current.kind
  // bloc sélectionné disparu (supprimé, ou passage en routine) : retour au déclencheur
  const node = flow.nodes.find((n) => n.id === nodeId) ?? flow.nodes[0]

  function pick(n: FlowNode) {
    if (n.kind === 'add-if') { api.addCond(); setSelected({ kind: 'if' }); return }
    if (n.kind === 'add-then' || n.kind === 'add-else') {
      const branch: Branch = n.kind === 'add-then' ? 'then' : 'else'
      api.addStep(branch)
      setSelected({ kind: 'last', branch })
      return
    }
    if (n.kind === 'then' || n.kind === 'else') {
      const step = stepsOf(n.kind)[n.index]
      if (step) setSelected({ kind: 'step', branch: n.kind, k: step.k })
      return
    }
    setSelected({ kind: n.kind === 'if' ? 'if' : 'trigger' })
  }

  const branch: Branch = node.kind === 'else' ? 'else' : 'then'
  const steps = stepsOf(branch)
  const step = node.kind === 'then' || node.kind === 'else' ? steps[node.index] : undefined
  return (
    <>
      <FlowCanvas flow={flow} selected={node.id} onSelect={pick} />
      <section className={`au-block ${node.kind === 'trigger' ? 'when' : node.kind === 'if' ? 'if' : node.kind === 'else' ? 'else' : 'then'}`}>
        <h4>{node.kind === 'trigger' ? 'quand' : node.kind === 'if' ? 'si' : node.title} <span>réglages du bloc sélectionné</span></h4>
        {node.kind === 'trigger' && <TriggerEditor api={api} catalogue={catalogue} lists={lists} />}
        {node.kind === 'if' && <ConditionsEditor api={api} catalogue={catalogue} lists={lists} />}
        {step && <StepEditor api={api} catalogue={catalogue} lists={lists} branch={branch} step={step} index={node.index} count={steps.length} />}
      </section>
    </>
  )
}
