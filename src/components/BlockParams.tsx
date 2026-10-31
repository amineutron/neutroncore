import { boolLabel, choiceLabel, type ParamSpec, type Value } from '../lib/automations'
import { DAYS } from '../lib/routines'
import { NumField } from './NumField'

export type Option = { id: string; name: string }
// listes dynamiques proposées par certains paramètres
export type Lists = { scenes: Option[]; lights: Option[]; routines: Option[]; containers?: Option[]; vms?: Option[]; bluetooth?: Option[]; lumiere?: Option[] }

function Pick({ label, value, options, onChange }: { label: string; value: Value | undefined; options: Option[]; onChange: (v: Value) => void }) {
  const current = String(value ?? '')
  return (
    <select value={current} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {/* liste vide = pas encore chargée (ou service muet) : on ne dit pas « introuvable » d'un identifiant peut-être valide */}
      {!options.some((o) => o.id === current) && <option value={current}>{!current ? 'choisir…' : options.length === 0 ? `${label} (chargement…)` : `${label} introuvable`}</option>}
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  )
}

// Champ d'un paramètre de bloc (déclencheur, condition ou action), selon son type.
// `block` : type du bloc, pour les libellés qui en dépendent.
export function ParamInput({ spec, value, lists, block, onChange }: {
  spec: ParamSpec; value: Value | undefined; lists: Lists; block: string; onChange: (v: Value) => void
}) {
  if (spec.type === 'bool') {
    return (
      <select value={value ? '1' : '0'} aria-label={spec.name} onChange={(e) => onChange(e.target.value === '1')}>
        <option value="1">{boolLabel(spec.name, true)}</option><option value="0">{boolLabel(spec.name, false)}</option>
      </select>
    )
  }
  if (spec.type === 'choice') {
    return (
      <select value={String(value)} aria-label={spec.name} onChange={(e) => onChange(e.target.value)}>
        {/* valeur retirée du catalogue : montrée telle quelle, pas remplacée en silence par la première option */}
        {!spec.choices.includes(String(value)) && <option value={String(value)}>{String(value)} (indisponible)</option>}
        {spec.choices.map((c) => <option key={c} value={c}>{choiceLabel(spec.name, c, block)}</option>)}
      </select>
    )
  }
  if (spec.type === 'id' && spec.name === 'scene_id') return <Pick label="scène" value={value} options={lists.scenes} onChange={onChange} />
  if (spec.type === 'id' && block === 'routine.run') return <Pick label="routine" value={value} options={lists.routines} onChange={onChange} />
  if (spec.type === 'id' && block === 'spatial.scene') return <Pick label="scène ou moment" value={value} options={lists.lumiere ?? []} onChange={onChange} />
  if (spec.type === 'light') return <Pick label="lampe" value={value} options={lists.lights} onChange={onChange} />
  if (spec.type === 'container') {
    const options = [{ id: 'trigger', name: 'celui qui vient de tomber' }, ...(lists.containers ?? [])]
    return <Pick label="conteneur" value={value} options={options} onChange={onChange} />
  }
  if (spec.type === 'vm') return <Pick label="vm" value={value} options={lists.vms ?? []} onChange={onChange} />
  if (spec.type === 'bluetooth') return <Pick label="appareil" value={value} options={lists.bluetooth ?? []} onChange={onChange} />
  if (spec.type === 'id') {
    // identifiant libre (nom d'un événement externe) : lettres, chiffres, tirets
    return <input className="bp-text" value={String(value ?? '')} maxLength={64} placeholder="nom-de-l-evenement" aria-label="nom de l'événement"
      onChange={(e) => onChange(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} />
  }
  if (spec.type === 'text' || spec.type === 'otext') {
    const label = spec.name === 'title' ? 'titre (facultatif)' : spec.name === 'contains' ? 'contenant… (facultatif)' : 'message'
    return <input className="bp-text" value={String(value ?? '')} maxLength={spec.max} placeholder={label} aria-label={label} onChange={(e) => onChange(e.target.value)} />
  }
  if (spec.type === 'color') {
    return <input type="color" className="bp-color" value={String(value || '#f6c177')} aria-label="couleur" onChange={(e) => onChange(e.target.value)} />
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
  // outil et arguments d'une action lyra : jamais saisis à la main, posés par l'analyse (LyraPhrase)
  if (spec.type === 'tool' || spec.type === 'args') return null
  const n = Number(value)
  const unit: Record<string, string> = { every_min: 'min', for_min: 'min', minutes_before: 'min avant', seconds: 's', above: 'seuil', value: 'seuil', minutes: 'min', after_min: 'min d’absence' }
  return (
    <span className="bp-num">
      <NumField value={Number.isFinite(n) ? n : spec.min} min={spec.min} max={spec.max} label={spec.name} onCommit={onChange} />
      {unit[spec.name] && <em>{unit[spec.name]}</em>}
    </span>
  )
}

/** Champs de tous les paramètres d'un bloc. */
export function Params({ specs, values, lists, block, onChange }: {
  specs: ParamSpec[]; values: Record<string, Value>; lists: Lists; block: string; onChange: (name: string, v: Value) => void
}) {
  return <>{specs.map((p) => <ParamInput key={p.name} spec={p} value={values[p.name]} lists={lists} block={block} onChange={(v) => onChange(p.name, v)} />)}</>
}
