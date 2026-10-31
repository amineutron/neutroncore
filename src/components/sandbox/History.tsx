import { Chip } from '../ui'
import { filterHistory, fmtMs, levelTone, type Filters, type HistoryEntry } from '../../lib/sandbox'

const OPTIONS: { key: keyof Filters; label: string; values: [string, string][] }[] = [
  { key: 'kind', label: 'type', values: [['tous', 'tous'], ['rules', 'règles'], ['compare', 'comparaisons']] },
  { key: 'level', label: 'niveau', values: [['tous', 'tous'], ['a-risque', 'à risque'], ['sur', 'sans risque']] },
]

export function History({ items, filters, onFilters, onPick, onClear }: {
  items: HistoryEntry[]; filters: Filters; onFilters: (f: Filters) => void; onPick: (text: string) => void; onClear: () => void
}) {
  const shown = filterHistory(items, filters)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {OPTIONS.map((o) => (
          <span key={o.key} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
            {o.label}
            {o.values.map(([v, l]) => (
              <button key={v} className={`btn sm ${filters[o.key] === v ? 'solid' : ''}`} onClick={() => onFilters({ ...filters, [o.key]: v } as Filters)}>{l}</button>
            ))}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn sm" disabled={!items.length} onClick={onClear}>vider</button>
      </div>
      {shown.length === 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--faint)' }}>aucun essai pour ces filtres</span>}
      {shown.map((e) => (
        <div key={`${e.ts}-${e.text}`} style={{ display: 'grid', gap: 3, padding: '6px 0', borderTop: '1px solid var(--line2)', cursor: 'pointer' }}
          onClick={() => onPick(e.text)} title="reprendre cette phrase">
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
            <Chip tone={levelTone(e.level)}>{e.level}</Chip> {e.text} <span style={{ color: 'var(--faint)' }}>- {e.tool || 'aucun outil'}</span>
          </div>
          {e.runs?.map((r) => (
            <div key={r.model} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', paddingLeft: 14 }}>
              {r.model} : {r.skipped ? 'non lancé' : `${fmtMs(r.ms)}, ${r.tool || 'aucun outil'} (${r.agreement})`}
            </div>
          ))}
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--faint)' }}>{new Date(e.ts * 1000).toLocaleString('fr-FR')}</div>
        </div>
      ))}
    </div>
  )
}
