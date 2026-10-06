// Routines : types et mise en forme (logique pure). Le catalogue des actions
// et leur validation vivent côté API (lib/routines.py) ; l'interface le lit.

export type ParamSpec =
  | { name: string; type: 'int'; min: number; max: number }
  | { name: string; type: 'choice'; choices: string[] }
  | { name: string; type: 'bool' }
  | { name: string; type: 'id' }
export type ActionSpec = { action: string; label: string; params: ParamSpec[] }
export type Step = { action: string; params: Record<string, string | number | boolean> }
export type Schedule = { time: string; days: number[] }
export type RoutineDraft = { name: string; enabled: boolean; schedule: Schedule | null; steps: Step[] }
export type Routine = RoutineDraft & { id: string; last_run: string | null }
export type StepResult = { action: string; label: string; ok: boolean; error: string }
export type RunResult = { success: boolean; steps: StepResult[]; failed: number }

export const DAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
export const MAX_STEPS = 12

export function defaultParams(spec: ActionSpec, firstScene = ''): Step['params'] {
  return Object.fromEntries(spec.params.map((p) => {
    if (p.type === 'int') return [p.name, Math.min(p.max, Math.max(p.min, p.name === 'seconds' ? 5 : Math.round((p.min + p.max) / 2)))]
    if (p.type === 'choice') return [p.name, p.choices[0]]
    if (p.type === 'bool') return [p.name, true]
    return [p.name, firstScene]
  }))
}

/** Phrase courte d'une étape : « scène hue : soirée », « attendre 5 s ». */
export function describeStep(step: Step, catalogue: ActionSpec[], sceneNames: Record<string, string> = {}): string {
  const spec = catalogue.find((a) => a.action === step.action)
  if (!spec) return step.action
  const p = step.params
  switch (step.action) {
    case 'hue.scene': return `scène hue : ${sceneNames[String(p.scene_id)] ?? 'scène supprimée'}`
    case 'hue.brightness': return `lumières à ${Math.round((Number(p.brightness) / 254) * 100)} %`
    case 'tv.power': return p.on ? 'tv : allumer' : 'tv : éteindre'
    case 'tv.app': return `tv : ouvrir ${p.app}`
    case 'tv.ambilight': return `ambilight : ${String(p.mode).toLowerCase().replace('follow_', '').replace('_light', '')}`
    case 'denon.volume': return `ampli : volume ${p.level}`
    case 'denon.source': return `ampli : entrée ${String(p.source).toLowerCase()}`
    case 'wait': return `attendre ${p.seconds} s`
    default: return spec.label
  }
}

export function scheduleLabel(s: Schedule | null): string {
  if (!s) return ''
  const days = [...s.days].sort((a, b) => a - b)
  const key = days.join('')
  const when = key === '0123456' ? 'tous les jours' : key === '01234' ? 'en semaine' : key === '56' ? 'le week-end' : days.map((d) => DAYS[d]).join(' ')
  return `${s.time} · ${when}`
}

export function toggleDay(s: Schedule, day: number): Schedule {
  const days = s.days.includes(day) ? s.days.filter((d) => d !== day) : [...s.days, day].sort((a, b) => a - b)
  return { ...s, days }
}

export function moveStep(steps: Step[], index: number, delta: -1 | 1): Step[] {
  const to = index + delta
  if (to < 0 || to >= steps.length) return steps
  const next = [...steps]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

// contrôle rapide avant l'envoi ; l'API revalide tout
export function draftError(d: RoutineDraft): string {
  if (!d.name.trim()) return 'donne un nom à la routine'
  if (d.steps.length === 0) return 'ajoute au moins une étape'
  if (d.steps.some((s) => s.action === 'hue.scene' && !s.params.scene_id)) return 'choisis une scène pour chaque étape « scène hue »'
  if (d.schedule && d.schedule.days.length === 0) return 'choisis au moins un jour'
  return ''
}
