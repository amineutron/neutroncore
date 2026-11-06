import { useState } from 'react'
import './dv.css'
import { Card, Chip } from '../ui'
import {
  FILTER_KEY, HISTORY_FILTERS, filterHistory, fmtCourt, fmtSeconds, profileLabel, readChoice, saveChoice, showShareBar, stepShares,
  type DvHistoryItem, type DvStats, type HistoryFilter,
} from '../../lib/dv'

const SHADES = ['#f6c177', '#eb6f92', '#82d69c', '#9ccfd8', '#c4a7e7', '#f0b45e']
const when = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '-')

function Metric({ k, v }: { k: string; v: string }) {
  return <div><div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{k}</div><b style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{v}</b></div>
}

export function DvStatsStrip({ stats }: { stats: DvStats }) {
  return (
    <Card title="métriques" lite={stats.journal_since ? `journal depuis le ${stats.journal_since.slice(0, 10)}` : 'journal vide'}>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <Metric k="converties" v={String(stats.converted)} />
        <Metric k="échecs" v={String(stats.failed)} />
        <Metric k="sans conversion (P8 déjà bon)" v={String(stats.skipped)} />
        <Metric k="durée moyenne" v={fmtSeconds(stats.average_s)} />
        <Metric k="la plus longue" v={fmtSeconds(stats.longest_s)} />
        <Metric k="dernière réussite" v={when(stats.last_conversion)} />
      </div>
    </Card>
  )
}

function ShareBar({ item }: { item: DvHistoryItem }) {
  const shares = stepShares(item.steps)
  if (shares.length === 0) return <span style={{ color: 'var(--faint)' }}>-</span>
  return (
    <div title="part de chaque étape dans la durée" style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', minWidth: 90 }}>
      {shares.map((s) => <i key={s.n} style={{ width: `${s.pct}%`, background: SHADES[(s.n - 1) % SHADES.length] }} />)}
    </div>
  )
}

export function DvHistory({ items }: { items: DvHistoryItem[] }) {
  const [filter, setFilter] = useState<HistoryFilter>(() => readChoice(FILTER_KEY, HISTORY_FILTERS, 'tout'))
  const [open, setOpen] = useState<string | null>(null)
  const pick = (f: HistoryFilter) => { setFilter(f); saveChoice(FILTER_KEY, f) }
  const shown = filterHistory(items, filter)
  return (
    <Card title="historique" lite={`${shown.length} sur ${items.length}`}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {HISTORY_FILTERS.map((f) => <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => pick(f)}>{f}</button>)}
      </div>
      <div>
        <ul className="dv-hist">
          {shown.map((h) => (
            <li key={h.key} className="dv-hrow" onClick={() => setOpen(open === h.key ? null : h.key)}>
              <div className="dv-hname">
                <b>{h.title}</b>
                <span className="mono">{profileLabel(h.profile)} - {when(h.ended)}</span>
                {open === h.key && (
                  <div className="mono dv-hsteps">
                    {h.steps.length === 0 ? 'aucune étape enregistrée' : h.steps.map((s) => (
                      <div key={s.n}>étape {s.n}{h.mode === 'dv' ? `/6` : ''} : {fmtSeconds(s.seconds)}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="dv-hbar">{showShareBar(h.outcome) && <ShareBar item={h} />}</div>
              <span className="mono dv-hdur">{fmtCourt(h.seconds)}</span>
              <span className="dv-hstat"><Chip tone={h.outcome === 'converted' ? 'ok' : 'crit'}>{h.outcome === 'converted' ? 'réussie' : 'échec'}</Chip></span>
            </li>
          ))}
          {shown.length === 0 && <li style={{ color: 'var(--faint)', fontSize: 12 }}>Rien à afficher pour ce filtre.</li>}
        </ul>
      </div>
    </Card>
  )
}
