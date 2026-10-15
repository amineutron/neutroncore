import { useRef, useState } from 'react'
import {
  completeBlock, defaultBlock, draftError, normalize, sameDraft,
  type AutomationDraft, type Block, type Catalogue, type Report, type Value,
} from './automations'
import { defaultParams, moveStep, type Step } from './routines'

// clé locale stable : un bloc déplacé garde son focus et ses champs (jamais envoyée à l'API)
export type Keyed<T> = T & { k: number }
export type Branch = 'then' | 'else'
type Meta = Pick<AutomationDraft, 'name' | 'enabled' | 'cooldown_min' | 'max_per_day' | 'match' | 'report'>
let nextKey = 0
const keyed = <T,>(x: T): Keyed<T> => ({ ...x, k: ++nextKey })
const bare = <T extends { k: number }>({ k: _k, ...rest }: T) => rest

/** État d'édition d'une automatisation, partagé par la vue « blocs » et la vue « diagramme ». */
export function useAutomationDraft(initial: AutomationDraft, catalogue: Catalogue, firstScene: string) {
  const actionSpec = (action: string) => catalogue.actions.find((a) => a.action === action)
  // paramètres absents (catalogue qui a évolué) complétés dès l'ouverture : ce qui s'affiche est ce qui part
  const fillStep = (s: Step): Keyed<Step> => {
    const spec = actionSpec(s.action)
    return keyed({ ...s, params: { ...(spec ? defaultParams(spec, firstScene) : {}), ...s.params } })
  }
  const [meta, setMeta] = useState<Meta>({
    name: initial.name, enabled: initial.enabled, cooldown_min: initial.cooldown_min,
    max_per_day: initial.max_per_day, match: initial.match, report: initial.report,
  })
  const [trigger, setTrigger] = useState<Block>(() => completeBlock(initial.trigger, catalogue.triggers.find((t) => t.type === initial.trigger.type)))
  const [conds, setConds] = useState<Keyed<Block>[]>(() => initial.conditions.map((c) => keyed(completeBlock(c, catalogue.conditions.find((x) => x.type === c.type)))))
  const [then, setThen] = useState<Keyed<Step>[]>(() => initial.actions.map(fillStep))
  const [other, setOther] = useState<Keyed<Step>[]>(() => initial.otherwise.map(fillStep))

  const draft = normalize({ ...meta, trigger, conditions: conds.map(bare) as Block[], actions: then.map(bare) as Step[], otherwise: other.map(bare) as Step[] })
  const setSteps = (b: Branch) => (b === 'then' ? setThen : setOther)
  const newStep = (action: string): Keyed<Step> | null => {
    const spec = actionSpec(action)
    return spec ? keyed({ action: spec.action, params: defaultParams(spec, firstScene) }) : null
  }

  // référence = le brouillon tel qu'il est à l'ouverture, APRÈS complétion des paramètres :
  // comparer à `initial` brut donnerait un faux « modifié » sur une automatisation plus ancienne
  const baseline = useRef(draft)
  const limits = catalogue.limits

  return {
    meta, trigger, conds, then, other, draft,
    dirty: !sameDraft(draft, baseline.current),
    error: draftError(draft),
    patchMeta: (patch: Partial<Meta>) => setMeta((m) => ({ ...m, ...patch })),
    patchReport: (patch: Partial<Report>) => setMeta((m) => ({ ...m, report: { ...m.report, ...patch } })),
    setTriggerType: (type: string) => { const s = catalogue.triggers.find((t) => t.type === type); if (s) setTrigger(defaultBlock(s)) },
    setTriggerParam: (name: string, v: Value) => setTrigger((t) => ({ ...t, params: { ...t.params, [name]: v } })),
    addCond: () => { const s = catalogue.conditions[0]; if (s) setConds((l) => (l.length >= limits.conditions ? l : [...l, keyed(defaultBlock(s))])) },
    setCondType: (k: number, type: string) => { const s = catalogue.conditions.find((c) => c.type === type); if (s) setConds((l) => l.map((x) => (x.k === k ? { ...defaultBlock(s), negate: x.negate, k } : x))) },
    setCondParam: (k: number, name: string, v: Value) => setConds((l) => l.map((x) => (x.k === k ? { ...x, params: { ...x.params, [name]: v } } : x))),
    toggleNegate: (k: number) => setConds((l) => l.map((x) => (x.k === k ? { ...x, negate: !x.negate } : x))),
    removeCond: (k: number) => {
      // plus aucune condition : la branche « sinon » n'a plus de sens, on la retire pour de bon
      // (gardée en mémoire, elle réapparaîtrait par surprise à la prochaine condition)
      if (conds.length === 1 && conds[0].k === k) { setOther([]); setMeta((m) => ({ ...m, match: 'all' })) }
      setConds((l) => l.filter((x) => x.k !== k))
    },
    addStep: (b: Branch) => { const s = newStep(catalogue.actions[0]?.action ?? ''); if (s) setSteps(b)((l) => (l.length >= limits.actions ? l : [...l, s])) },
    // « attendre » n'a pas d'options d'échec, et certaines actions ne se rejouent pas :
    // on ne garde pas des réglages devenus invisibles (l'API les refuserait)
    setStepAction: (b: Branch, k: number, action: string) => { const s = newStep(action); if (s) setSteps(b)((l) => l.map((x) => (x.k === k ? (action === 'wait' ? { ...s, k } : { ...s, on_error: x.on_error, retry: (catalogue.no_retry ?? []).includes(action) ? 0 : x.retry, k }) : x))) },
    setStepParam: (b: Branch, k: number, name: string, v: Value) => setSteps(b)((l) => l.map((x) => (x.k === k ? { ...x, params: { ...x.params, [name]: v as Step['params'][string] } } : x))),
    // plusieurs paramètres d'un coup (phrase + outil + arguments d'une action lyra) : un seul rendu, jamais d'état à moitié
    setStepParams: (b: Branch, k: number, patch: Step['params']) => setSteps(b)((l) => l.map((x) => (x.k === k ? { ...x, params: { ...x.params, ...patch } } : x))),
    setStepOption: (b: Branch, k: number, patch: Pick<Step, 'on_error' | 'retry'>) => setSteps(b)((l) => l.map((x) => (x.k === k ? { ...x, ...patch } : x))),
    moveStepBy: (b: Branch, index: number, delta: -1 | 1) => setSteps(b)((l) => moveStep(l, index, delta) as Keyed<Step>[]),
    removeStep: (b: Branch, k: number) => setSteps(b)((l) => l.filter((x) => x.k !== k)),
  }
}
export type DraftApi = ReturnType<typeof useAutomationDraft>
