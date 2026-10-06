// Automatisations : QUAND (déclencheur) + SI (conditions) + ALORS (actions).
// Types et mise en phrases (logique pure). Les catalogues et leur validation
// vivent côté API (lib/automations.py) ; l'interface les lit.

import { DAYS, describeStep, type ActionSpec, type ParamSpec as BaseParam, type Step } from './routines'

export type ParamSpec = BaseParam
  | { name: string; type: 'time' }
  | { name: string; type: 'days' }
export type Value = string | number | boolean | number[]
export type Block = { type: string; params: Record<string, Value> }
export type BlockSpec = { type: string; label: string; params: ParamSpec[] }
export type Catalogue = { triggers: BlockSpec[]; conditions: BlockSpec[]; actions: ActionSpec[] }
export type Run = { at: number; trigger: string; why: string; success: boolean; failed: number; detail: string; skipped?: boolean }
export type AutomationDraft = {
  name: string; enabled: boolean; trigger: Block; conditions: Block[]; actions: Step[]; cooldown_min: number
}
export type Automation = AutomationDraft & { id: string; created?: string; last_run: string | null; history: Run[] }

export const MAX_CONDITIONS = 4
export const EMPTY_DRAFT: AutomationDraft = {
  name: '', enabled: true, trigger: { type: 'manual', params: {} }, conditions: [], actions: [], cooldown_min: 5,
}

// valeurs des listes fermées, dites en français
// valeurs des listes fermées, dites en français — par PARAMÈTRE : un service qui
// s'appellerait « backup » ne doit pas s'afficher « sauvegarde »
const KIND: Record<string, string> = {
  any: 'n’importe laquelle', disk: 'disque', unit: 'service en échec', backup: 'sauvegarde', rotation: 'disque de sauvegarde',
  memory: 'mémoire', agenda: 'rappel d’agenda',
}
const CHOICES: Record<string, Record<string, string>> = {
  kind: KIND,
  when: { raised: 'apparaît', resolved: 'est résolue', waiting: 'attend une réponse', done: 'a fini de répondre' },
  state: { on: 'allumé', off: 'éteint', down: 'tombe', up: 'revient' },
  name: { any: 'n’importe lequel' },
  mode: { FOLLOW_VIDEO: 'vidéo', FOLLOW_AUDIO: 'audio', LOUNGE_LIGHT: 'lounge', OFF: 'éteint' },
}
export function choiceLabel(param: string, value: string): string {
  return CHOICES[param]?.[value] ?? value.toLowerCase()
}

export function daysLabel(days: number[]): string {
  const key = [...days].sort((a, b) => a - b).join('')
  return key === '0123456' ? 'tous les jours' : key === '01234' ? 'en semaine' : key === '56' ? 'le week-end' : [...days].sort((a, b) => a - b).map((d) => DAYS[d]).join(' ')
}

export const isRoutine = (a: { trigger: Block }) => a.trigger.type === 'manual'

/** « à 07:30 en semaine », « quand une alerte disque apparaît »… */
export function describeTrigger(t: Block): string {
  const p = t.params
  switch (t.type) {
    case 'manual': return 'à la main'
    case 'time': return `à ${p.time ?? '…'} ${daysLabel(Array.isArray(p.days) ? p.days : [])}`.trim()
    case 'alert': return p.kind === 'any' ? `quand une alerte ${p.when === 'raised' ? 'apparaît' : 'est résolue'}`
      : `quand une alerte « ${KIND[String(p.kind)] ?? p.kind} » ${p.when === 'raised' ? 'apparaît' : 'est résolue'}`
    case 'download_done': return 'quand un téléchargement se termine'
    case 'session': return `quand une session claude ${p.when === 'waiting' ? 'attend une réponse' : 'a fini de répondre'}`
    case 'service': return `quand ${p.name === 'any' || !p.name ? 'un service' : p.name} ${p.state === 'down' ? 'tombe' : 'revient'}`
    case 'tv': return `quand la tv ${p.state === 'on' ? 's’allume' : 's’éteint'}`
    default: return t.type
  }
}

export function describeCondition(c: Block): string {
  const p = c.params
  switch (c.type) {
    case 'time_between': return `entre ${p.start} et ${p.end}`
    case 'days': return daysLabel((p.days as number[]) ?? [])
    case 'tv_is': return `la tv est ${p.state === 'on' ? 'allumée' : 'éteinte'}`
    case 'lights_are': return `les lumières sont ${p.state === 'on' ? 'allumées' : 'éteintes'}`
    default: return c.type
  }
}

export function describeAction(step: Step, catalogue: ActionSpec[], sceneNames: Record<string, string> = {}): string {
  const p = step.params
  switch (step.action) {
    case 'notify.app': return `notification dans l’app : « ${p.message} »`
    case 'notify.phone': return `notification sur le téléphone : « ${p.message} »`
    case 'service.start': return `démarrer ${p.name}`
    default: return describeStep(step, catalogue, sceneNames)
  }
}

/** La phrase complète, relue par l'utilisateur avant d'enregistrer. */
export function sentence(a: AutomationDraft, catalogue: ActionSpec[], sceneNames: Record<string, string> = {}): string {
  const when = describeTrigger(a.trigger)
  const cond = a.conditions.length ? `, si ${a.conditions.map(describeCondition).join(' et ')}` : ''
  const then = a.actions.length ? a.actions.map((s) => describeAction(s, catalogue, sceneNames)).join(', puis ') : '…'
  return `${when.charAt(0).toUpperCase()}${when.slice(1)}${cond} : ${then}.`
}

export function defaultBlock(spec: BlockSpec): Block {
  return {
    type: spec.type,
    params: Object.fromEntries(spec.params.map((p): [string, Value] => {
      if (p.type === 'time') return [p.name, p.name === 'end' ? '06:00' : p.name === 'start' ? '22:00' : '07:30']
      if (p.type === 'days') return [p.name, [0, 1, 2, 3, 4]]
      if (p.type === 'choice') return [p.name, p.choices[0]]
      if (p.type === 'int') return [p.name, p.min]
      if (p.type === 'bool') return [p.name, true]
      return [p.name, '']
    })),
  }
}

/** Deux brouillons ont-ils le même contenu ? (indépendant de l'ordre des champs et des paramètres) */
export function sameDraft(a: AutomationDraft, b: AutomationDraft): boolean {
  const sorted = (params: Record<string, unknown>) => Object.keys(params).sort().map((k) => [k, params[k]])
  const norm = (d: AutomationDraft) => JSON.stringify([d.name, d.enabled, d.cooldown_min, d.trigger.type, sorted(d.trigger.params),
    d.conditions.map((c) => [c.type, sorted(c.params)]), d.actions.map((s) => [s.action, sorted(s.params)])])
  return norm(a) === norm(b)
}

/** Une routine n'a ni condition, ni pause, ni cadence : ce qui a pu être réglé
 * avant de passer le déclencheur sur « à la main » n'est ni gardé ni envoyé. */
export function normalize(d: AutomationDraft): AutomationDraft {
  return d.trigger.type === 'manual' ? { ...d, conditions: [], enabled: true, cooldown_min: EMPTY_DRAFT.cooldown_min } : d
}

/** Complète les paramètres absents d'un bloc (catalogue qui a évolué) : ce que
 * l'éditeur affiche est toujours ce qui sera envoyé. */
export function completeBlock(block: Block, spec: BlockSpec | undefined): Block {
  return spec ? { ...block, params: { ...defaultBlock(spec).params, ...block.params } } : block
}

// contrôle rapide avant l'envoi ; l'API revalide tout
export function draftError(raw: AutomationDraft): string {
  const d = normalize(raw)
  if (!d.name.trim()) return 'donne un nom'
  if (d.actions.length === 0) return 'ajoute au moins une action'
  if (d.actions.some((s) => s.action === 'hue.scene' && !s.params.scene_id)) return 'choisis une scène pour chaque action « scène hue »'
  if (d.actions.some((s) => s.action.startsWith('notify.') && !String(s.params.message ?? '').trim())) return 'écris le message de la notification'
  const days = [d.trigger, ...d.conditions].some((b) => Array.isArray(b.params.days) && b.params.days.length === 0)
  if (days) return 'choisis au moins un jour'
  return ''
}

export function runLabel(r: Run): string {
  if (r.skipped) return `non lancée — ${r.why}`
  return r.success ? 'réussie' : `${r.failed} action(s) en échec`
}

export function triggerLabel(trigger: string): string {
  return ({ manual: 'à la main', time: 'heure prévue', alert: 'alerte', download_done: 'téléchargement', session: 'session claude', service: 'service', tv: 'tv' } as Record<string, string>)[trigger] ?? trigger
}
