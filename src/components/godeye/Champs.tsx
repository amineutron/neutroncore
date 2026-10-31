import type { ReactNode } from 'react'

/** Case à cocher avec son libellé. */
export function Case({ label, on, onChange, title }: { label: string; on: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <label className="ge-case" title={title}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  )
}

/** Curseur avec sa valeur lue à droite (`format` met la valeur en mots : « FL300 », « M5+ »). */
export function Curseur({ label, valeur, min, max, pas, onChange, format }: {
  label: string; valeur: number; min: number; max: number; pas: number; onChange: (v: number) => void; format?: (v: number) => string
}) {
  return (
    <label className="ge-curseur">
      <span className="ge-curseur-t">{label}</span>
      <input type="range" min={min} max={max} step={pas} value={valeur} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="ge-curseur-v">{format ? format(valeur) : valeur}</span>
    </label>
  )
}

/** Liste de puces à cocher (plusieurs choix possibles). */
export function Puces<T extends string>({ options, actives, onBasculer }: {
  options: { id: T; nom: string }[]; actives: readonly T[]; onBasculer: (id: T) => void
}) {
  return (
    <div className="ge-puces" role="group">
      {options.map((o) => (
        <button key={o.id} type="button" className={`ge-puce${actives.includes(o.id) ? ' on' : ''}`} aria-pressed={actives.includes(o.id)} onClick={() => onBasculer(o.id)}>{o.nom}</button>
      ))}
    </div>
  )
}

export function Bloc({ titre, children }: { titre?: string; children: ReactNode }) {
  return <div className="ge-bloc">{titre && <div className="ge-bloc-t">{titre}</div>}{children}</div>
}
