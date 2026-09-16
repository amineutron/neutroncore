import type { CSSProperties, ReactNode } from 'react'
import { STATUS, dayLabel, hhmm, isProblem, tone, type Occurrence } from './AgendaParts'

// Vues de l'agenda (semaine, mois, liste) et calcul des plages de dates affichées

export type View = 'semaine' | 'mois' | 'liste'

export const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const at = (day: string) => new Date(`${day}T12:00`)
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
const shortDay = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** Plage chargée pour une vue : semaine (7 j), liste (28 j) ou grille du mois (6 semaines) */
export function rangeFor(view: View, anchor: string): { days: string[]; label: string } {
  const a = at(anchor)
  if (view === 'mois') {
    const first = new Date(a.getFullYear(), a.getMonth(), 1, 12)
    const start = mondayOf(first)
    return { days: Array.from({ length: 42 }, (_, i) => iso(addDays(start, i))), label: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
  }
  const start = mondayOf(a)
  const span = view === 'semaine' ? 7 : 28
  return { days: Array.from({ length: span }, (_, i) => iso(addDays(start, i))), label: `${shortDay(start)} - ${shortDay(addDays(start, span - 1))}` }
}

export function shiftAnchor(view: View, anchor: string, step: number): string {
  const a = at(anchor)
  if (view === 'mois') return iso(new Date(a.getFullYear(), a.getMonth() + step, 1, 12))
  return iso(addDays(a, step * (view === 'semaine' ? 7 : 28)))
}

type ViewProps = { days: string[]; today: string; occs: Occurrence[]; onSelect: (o: Occurrence) => void }

// délai d'apparition en cascade (plafonné pour ne pas faire attendre)
const stagger = (i: number) => ({ '--i': Math.min(i, 24) }) as CSSProperties
const onDay = (occs: Occurrence[], day: string) => occs.filter((o) => o.start.startsWith(day))

function EventButton({ o, today, i, onSelect }: { o: Occurrence; today: string; i: number; onSelect: (o: Occurrence) => void }) {
  return (
    <button className={`ag-ev ${tone(o, today)}`} style={stagger(i)} onClick={() => onSelect(o)}>
      <span className="tm">{hhmm(o.start)}<b>{STATUS[o.status].label}</b></span>
      {o.title}
    </button>
  )
}

export function WeekView({ days, today, occs, onSelect }: ViewProps) {
  return (
    <div className="ag-week">
      {days.map((day, d) => {
        const list = onDay(occs, day)
        return (
          <div key={day} className={`ag-day ${day === today ? 'today' : ''} ${list.length ? '' : 'empty'}`} style={stagger(d)}>
            <div className="dh">{at(day).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</div>
            {list.map((o, i) => <EventButton key={o.id} o={o} today={today} i={d + i} onSelect={onSelect} />)}
            {list.length === 0 && <span className="none">rien</span>}
          </div>
        )
      })}
    </div>
  )
}

const WEEKDAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
// dans une case du mois : problèmes d'abord, puis tes événements, puis le reste à l'heure
const rank = (o: Occurrence) => (isProblem(o) ? 0 : o.source === 'manual' ? 1 : 2)

/** Grille du mois : un clic sur une case déplie le jour sous sa semaine (drawer), re-clic pour replier */
export function MonthView({ days, today, occs, onSelect, month, openDay, onToggleDay, drawer }: ViewProps & {
  month: string; openDay: string | null; onToggleDay: (day: string) => void; drawer: (day: string) => ReactNode
}) {
  const nodes: ReactNode[] = WEEKDAYS.map((w) => <div key={w} className="wd">{w}</div>)
  days.forEach((day, i) => {
    const list = [...onDay(occs, day)].sort((a, b) => rank(a) - rank(b) || a.start.localeCompare(b.start))
    const cls = ['ag-mcell', day.slice(0, 7) !== month && 'out', day === today && 'today', day === openDay && 'open'].filter(Boolean).join(' ')
    nodes.push(
      <div key={day} className={cls} style={stagger(Math.floor(i / 2))} onClick={() => onToggleDay(day)} title="déplier la journée">
        <span className="dn">{Number(day.slice(8))}</span>
        {list.slice(0, 3).map((o) => (
          <button key={o.id} className={`ag-mini ${tone(o, today)}`} onClick={(e) => { e.stopPropagation(); onSelect(o) }}
            title={`${hhmm(o.start)} ${o.title} (${STATUS[o.status].label})`}>
            <i /><span>{o.title}</span>
          </button>
        ))}
        {list.length > 3 && <span className="more">+{list.length - 3}</span>}
      </div>,
    )
    // fin de semaine : le jour ouvert se déplie sous sa ligne, flèche alignée sur sa colonne
    const weekStart = i - 6
    if (i % 7 === 6 && openDay && days.slice(weekStart, i + 1).includes(openDay)) {
      const col = days.indexOf(openDay) - weekStart
      nodes.push(
        <div key={`drawer-${openDay}`} className="ag-drawer-row" style={{ '--arrow': `calc(${((col + 0.5) / 7) * 100}% - 6px)` } as CSSProperties}>
          {drawer(openDay)}
        </div>,
      )
    }
  })
  return <div className="ag-month">{nodes}</div>
}

export function ListView({ days, today, occs, onSelect }: ViewProps) {
  const filled = days.filter((day) => occs.some((o) => o.start.startsWith(day)))
  if (filled.length === 0) return <p style={{ color: 'var(--muted)' }}>Aucun événement sur cette période avec ces filtres.</p>
  return (
    <div className="ag-list">
      {filled.map((day, g) => (
        <div key={day} className="ag-group" style={stagger(g)}>
          <div className={`dh ${day === today ? 'today' : ''}`}>{day === today ? "aujourd'hui, " : ''}{dayLabel(day)}</div>
          {onDay(occs, day).map((o, i) => <EventButton key={o.id} o={o} today={today} i={g + i} onSelect={onSelect} />)}
        </div>
      ))}
    </div>
  )
}
