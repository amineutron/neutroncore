import { choiceLabel, type ParamSpec, type Value } from '../lib/automations'
import { DAYS } from '../lib/routines'
import { NumField } from './NumField'

export type Scene = { id: string; name: string }

// Champ d'un paramètre de bloc (déclencheur, condition ou action), selon son type.
export function ParamInput({ spec, value, scenes, onChange }: {
  spec: ParamSpec; value: Value | undefined; scenes: Scene[]; onChange: (v: Value) => void
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
        {spec.choices.map((c) => <option key={c} value={c}>{choiceLabel(spec.name, c)}</option>)}
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
  if (spec.type === 'text') {
    return <input className="bp-text" value={String(value ?? '')} maxLength={spec.max} placeholder="message" aria-label={spec.name} onChange={(e) => onChange(e.target.value)} />
  }
  if (spec.type === 'time') {
    return <input type="time" value={String(value ?? '')} aria-label={spec.name === 'end' ? 'fin' : spec.name === 'start' ? 'début' : 'heure'} onChange={(e) => e.target.value && onChange(e.target.value)} />
  }
  if (spec.type === 'days') {
    const days = Array.isArray(value) ? value : []
    return (
      <span className="bp-days" role="group" aria-label="jours">
        {DAYS.map((label, day) => (
          <button key={label} type="button" className={`btn sm ${days.includes(day) ? 'solid' : ''}`} aria-pressed={days.includes(day)}
            onClick={() => onChange(days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b))}>{label}</button>
        ))}
      </span>
    )
  }
  const n = Number(value)
  return <NumField value={Number.isFinite(n) ? n : spec.min} min={spec.min} max={spec.max} label={spec.name} onCommit={onChange} />
}
