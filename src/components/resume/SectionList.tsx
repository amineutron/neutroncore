import { useRef, useState } from 'react'
import { basculer, deplacer, deplacerVers, fixerMax, type CatalogueSection, type SectionReglage } from '../../lib/resume'
import { NumField } from '../NumField'

// Sections du résumé : case pour activer, poignée de glisser-déposer ET flèches (clavier, téléphone),
// nombre d'éléments par section. Contrôlé : le parent garde le brouillon.
export function SectionList({ value, catalogue, onChange }: {
  value: SectionReglage[]; catalogue: CatalogueSection[]; onChange: (next: SectionReglage[]) => void
}) {
  const from = useRef<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const cat = (id: string) => catalogue.find((c) => c.id === id)
  return (
    <ol className="rs-list">
      {value.map((s, i) => {
        const c = cat(s.id)
        return (
          <li key={s.id} className={`rs-row ${s.enabled ? '' : 'off'} ${over === s.id ? 'over' : ''}`} draggable
            onDragStart={(e) => { from.current = s.id; e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={(e) => { e.preventDefault(); setOver(s.id) }}
            onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); if (from.current) onChange(deplacerVers(value, from.current, s.id)); from.current = null }}
            onDragEnd={() => { from.current = null; setOver(null) }}>
            <span className="rs-grip" aria-hidden title="glisser pour réordonner">::</span>
            <label className="rs-check">
              <input type="checkbox" checked={s.enabled} onChange={() => onChange(basculer(value, s.id))} />
              <span>{c?.label ?? s.id}</span>
            </label>
            {c?.reglable && (
              <label className="rs-max" title="nombre d'éléments affichés">
                <NumField value={s.max} min={1} max={20} label={`éléments pour ${c.label}`} onCommit={(n) => onChange(fixerMax(value, s.id, n))} />
                <small>éléments</small>
              </label>
            )}
            <span className="rs-arrows">
              <button type="button" className="btn sm" disabled={i === 0} aria-label={`monter ${c?.label ?? s.id}`} onClick={() => onChange(deplacer(value, s.id, -1))}>haut</button>
              <button type="button" className="btn sm" disabled={i === value.length - 1} aria-label={`descendre ${c?.label ?? s.id}`} onClick={() => onChange(deplacer(value, s.id, 1))}>bas</button>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
