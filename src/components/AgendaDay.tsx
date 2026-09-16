import { useState, type CSSProperties } from 'react'
import { Btn } from './ui'
import { CATEGORY_LABEL, FailureActions, STATUS, dayLabel, fmtDuration, hhmm, isProblem, tone, type Occurrence } from './AgendaParts'

// Jour déplié sous sa semaine (vue mois) : événements en couleur, filtres propres au jour, actions sur les échecs

type DayFilter = 'tous' | 'problèmes' | 'à venir' | 'faits'

function match(o: Occurrence, f: DayFilter): boolean {
  if (f === 'problèmes') return isProblem(o)
  if (f === 'à venir') return o.status === 'upcoming' || o.status === 'pending' || o.status === 'retrying'
  if (f === 'faits') return o.status === 'done' || o.status === 'repaired'
  return true
}

export function DayDrawer({ day, today, occs, onSelect, onClose, onWeek, onChanged, onLog }: {
  day: string; today: string; occs: Occurrence[]
  onSelect: (o: Occurrence) => void; onClose: () => void; onWeek: (day: string) => void
  onChanged: () => void; onLog: (unit: string) => void
}) {
  const [filter, setFilter] = useState<DayFilter>('tous')
  const [cats, setCats] = useState<string[]>([])
  const ofDay = occs.filter((o) => o.start.startsWith(day))
  const list = ofDay.filter((o) => match(o, filter) && (cats.length === 0 || cats.includes(o.category)))
  const problems = ofDay.filter(isProblem).length
  const toggleCat = (c: string) => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])

  return (
    <div className="ag-drawer">
      <div className="head">
        <b>{day === today ? "aujourd'hui, " : ''}{dayLabel(day)}</b>
        <span className="count">{ofDay.length} événement{ofDay.length > 1 ? 's' : ''}{problems > 0 ? ` · ${problems} en échec` : ''}</span>
        <span className="sp" />
        <Btn sm onClick={() => onWeek(day)}>voir la semaine</Btn>
        <span className="x" onClick={onClose}>fermer</span>
      </div>
      <div className="filters">
        {(['tous', 'problèmes', 'à venir', 'faits'] as DayFilter[]).map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
        <span style={{ width: 8 }} />
        {Object.entries(CATEGORY_LABEL).map(([k, name]) => (
          <button key={k} className={`chip ${cats.includes(k) ? 'on' : ''}`} onClick={() => toggleCat(k)}>{name}</button>
        ))}
      </div>
      {list.length === 0 && <p className="none">Rien ce jour-là avec ces filtres.</p>}
      {list.map((o, i) => (
        <div key={o.id} className={`ag-drow ${tone(o, today)}`} style={{ '--i': i } as CSSProperties} onClick={() => onSelect(o)}>
          <span className="tm">{hhmm(o.start)}</span>
          <span className="tt">{o.title}</span>
          <span className="st">{CATEGORY_LABEL[o.category] ?? o.category} · {STATUS[o.status].label}{o.run?.duration_s !== undefined ? ` · ${fmtDuration(o.run.duration_s)}` : ''}</span>
          <FailureActions occ={o} compact onChanged={onChanged} onLog={onLog} />
        </div>
      ))}
    </div>
  )
}
