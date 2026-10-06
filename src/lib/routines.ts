// Routines : types et mise en forme (logique pure). Le catalogue des actions
// et leur validation vivent côté API (lib/routines.py) ; l'interface le lit.

export type ParamSpec =
  | { name: string; type: 'int'; min: number; max: number }
  | { name: string; type: 'choice'; choices: string[] }
  | { name: string; type: 'bool' }
  | { name: string; type: 'id' }
  | { name: string; type: 'text'; max: number }
export type ActionSpec = { action: string; label: string; params: ParamSpec[] }
export type Step = { action: string; params: Record<string, string | number | boolean> }
export type StepResult = { action: string; label: string; ok: boolean; error: string }
export type RunResult = { success: boolean; steps: StepResult[]; failed: number }

export const DAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
export const MAX_STEPS = 12

export function defaultParams(spec: ActionSpec, firstScene = ''): Step['params'] {
  return Object.fromEntries(spec.params.map((p) => {
    if (p.type === 'int') return [p.name, Math.min(p.max, Math.max(p.min, p.name === 'seconds' ? 5 : Math.round((p.min + p.max) / 2)))]
    if (p.type === 'choice') return [p.name, p.choices[0]]
    if (p.type === 'bool') return [p.name, true]
    if (p.type === 'id') return [p.name, firstScene]
    return [p.name, '']   // texte libre : vide, à écrire par l'utilisateur
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

export function moveStep(steps: Step[], index: number, delta: -1 | 1): Step[] {
  const to = index + delta
  if (to < 0 || to >= steps.length) return steps
  const next = [...steps]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}
