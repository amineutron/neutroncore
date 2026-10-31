import { useState } from 'react'
import { ALPHA_TOKENS, TOKEN_GROUPS, normalizeHex, type TokenName, type Tokens } from '../../lib/themes'
import './editeurThemes.css'

// Un champ couleur : pastille native + saisie hex (validee a la sortie, pas a chaque frappe).
function ColorField({ name, label, value, onChange }: {
  name: TokenName; label: string; value: string; onChange: (v: string) => void
}) {
  const [text, setText] = useState<string | null>(null)
  const alpha = ALPHA_TOKENS.has(name)
  const shown = text ?? value
  const bad = text !== null && normalizeHex(text) === null
  function commit() {
    const h = text === null ? null : normalizeHex(text)
    if (h && (alpha || h.length === 7)) onChange(h)
    setText(null)
  }
  return (
    <label className="th-field">
      <span className="th-lbl">{label}<small>--{name}</small></span>
      <input type="color" value={value.slice(0, 7)} aria-label={`${label} (pastille)`}
        onChange={(e) => onChange(alpha ? e.target.value + value.slice(7) : e.target.value)} />
      <input className={`th-hex ${bad ? 'bad' : ''}`} value={shown} spellCheck={false} aria-label={`${label} (hex)`}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setText(null) }} />
    </label>
  )
}

export function TokenFields({ tokens, onChange }: { tokens: Tokens; onChange: (name: TokenName, v: string) => void }) {
  return (
    <div className="th-groups">
      {TOKEN_GROUPS.map((g) => (
        <details key={g.label} open={!g.label.startsWith('avance')}>
          <summary className="th-sum">{g.label}</summary>
          <div className="th-grid">
            {g.tokens.map((t) => (
              <ColorField key={t.name} name={t.name} label={t.label} value={tokens[t.name]} onChange={(v) => onChange(t.name, v)} />
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}
