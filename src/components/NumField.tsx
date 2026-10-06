import { useEffect, useState } from 'react'

// Champ nombre qui laisse taper librement (« 4 », « 42 », « 420 ») : la valeur
// n'est bornée et transmise qu'à la validation (sortie du champ ou Entrée).
// Un champ contrôlé borné à chaque frappe rend la saisie impossible.
export function NumField({ value, min, max, step, label, onCommit }: {
  value: number; min: number; max: number; step?: number; label: string; onCommit: (v: number) => void
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])

  function commit() {
    const n = Number(text.replace(',', '.'))
    if (text.trim() === '' || !Number.isFinite(n)) { setText(String(value)); return }
    const next = Math.min(max, Math.max(min, Math.round(n)))
    setText(String(next))
    if (next !== value) onCommit(next)
  }
  return (
    <input type="number" inputMode="numeric" min={min} max={max} step={step} value={text} aria-label={label}
      onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }} />
  )
}
