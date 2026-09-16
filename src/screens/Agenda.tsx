import { useContext, useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { LOG_TARGET } from '../lib/nav'
import { NavContext } from '../App'
import { Btn, Chip, PageTitle } from '../components/ui'
import { CATEGORY_LABEL, EventDetail, EventForm, isProblem, type EventDraft, type Occurrence } from '../components/AgendaParts'
import { ListView, MonthView, WeekView, iso, rangeFor, shiftAnchor, type View } from '../components/AgendaViews'
import { DayDrawer } from '../components/AgendaDay'
import { RotationCard } from '../components/RotationCard'

type AgendaResp = { now: string; categories: string[]; occurrences: Occurrence[] }
type StatusFilter = 'tous' | 'à venir' | 'problèmes'

const VIEWS: View[] = ['semaine', 'mois', 'liste']
const VIEW_KEY = 'neutroncore_agenda_view'

function initialView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY) as View | null
    if (saved && VIEWS.includes(saved)) return saved
  } catch { /* stockage indisponible */ }
  return window.innerWidth <= 560 ? 'liste' : 'semaine'
}

function matchStatus(o: Occurrence, f: StatusFilter): boolean {
  if (f === 'à venir') return o.status === 'upcoming' || o.status === 'pending' || o.status === 'retrying'
  if (f === 'problèmes') return isProblem(o)
  return true
}

function newDraft(day: string): EventDraft {
  const hour = String(Math.min(new Date().getHours() + 1, 23)).padStart(2, '0')
  return { title: '', category: 'perso', start: `${day}T${hour}:00`, duration_min: 60, recurrence: 'none', description: '', notify: false }
}

export function Agenda() {
  const navigate = useContext(NavContext)
  const [view, setViewState] = useState<View>(initialView)
  const [anchor, setAnchor] = useState(() => iso(new Date()))
  const [dir, setDir] = useState<'next' | 'prev' | 'none'>('none')   // sens du glissement à la navigation
  const [cats, setCats] = useState<string[]>([])                     // vide = toutes les catégories
  const [statusF, setStatusF] = useState<StatusFilter>('tous')
  const [openDay, setOpenDay] = useState<string | null>(null)        // jour déplié dans la vue mois
  const [selected, setSelected] = useState<Occurrence | null>(null)
  const [draft, setDraft] = useState<EventDraft | null>(null)

  const { days, label } = rangeFor(view, anchor)
  const start = days[0]
  const end = days[days.length - 1]
  const agenda = usePoll<AgendaResp>(() => apiGet(`/agenda?start=${start}&end=${end}`), 120000)
  useEffect(() => { agenda.refresh() }, [start, end]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = iso(new Date())
  // filtre aussi sur la plage : pas d'événements de l'ancienne plage le temps du rechargement
  const inRange = (agenda.data?.occurrences ?? []).filter((o) => o.start.slice(0, 10) >= start && o.start.slice(0, 10) <= end)
  const occs = inRange.filter((o) => (cats.length === 0 || cats.includes(o.category)) && matchStatus(o, statusF))
  const problems = occs.filter(isProblem).length
  // la fiche ouverte suit les rafraîchissements (fin de sauvegarde, échec ignoré ou relancé)
  const current = selected && (agenda.data?.occurrences.find((o) => o.id === selected.id) ?? selected)

  const setView = (v: View) => {
    setDir('none'); setViewState(v); setOpenDay(null)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* stockage indisponible */ }
  }
  const shift = (step: number) => { setDir(step > 0 ? 'next' : 'prev'); setOpenDay(null); setAnchor(shiftAnchor(view, anchor, step)) }
  const openWeek = (day: string) => { setDir('none'); setAnchor(day); setView('semaine') }
  const toggleCat = (c: string) => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])
  const reload = () => { setDraft(null); setSelected(null); agenda.refresh() }
  const openLog = (unit: string) => { sessionStorage.setItem(LOG_TARGET, unit); setSelected(null); navigate('outils') }
  const edit = (o: Occurrence) => {
    setSelected(null)
    setDraft({ id: o.event_id, title: o.title, category: o.category, start: o.event_start, duration_min: o.duration_min, recurrence: o.recurrence, description: o.description, notify: o.notify })
  }
  const viewProps = { days, today, occs, onSelect: setSelected }

  return (
    <>
      <PageTitle help="agenda" title="agenda" desc="Sauvegardes planifiées, rappels et événements perso, avec l'état réel de chaque passage." />

      <div className="ag-bar">
        <Btn sm onClick={() => shift(-1)}>{'<'}</Btn>
        <Btn sm solid={days.includes(today)} onClick={() => { setDir('none'); setOpenDay(null); setAnchor(today) }}>aujourd'hui</Btn>
        <Btn sm onClick={() => shift(1)}>{'>'}</Btn>
        <span key={label} className="range">{label}</span>
        {problems > 0 && <Chip tone="crit">{problems} en échec ou manqué</Chip>}
        <span className="sp" />
        <div className="ag-seg">
          {VIEWS.map((v) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v}</button>)}
        </div>
        <Btn sm solid onClick={() => setDraft(newDraft(openDay ?? (days.includes(today) ? today : start)))}>+ événement</Btn>
      </div>

      <div className="ag-bar">
        {Object.entries(CATEGORY_LABEL).map(([k, name]) => (
          <button key={k} className={`chip ${cats.includes(k) ? 'on' : ''}`} onClick={() => toggleCat(k)}>{name}</button>
        ))}
        <span className="sp" />
        {(['tous', 'à venir', 'problèmes'] as StatusFilter[]).map((f) => (
          <button key={f} className={`chip ${statusF === f ? 'on' : ''}`} onClick={() => setStatusF(f)}>{f}</button>
        ))}
      </div>

      <RotationCard onFinished={agenda.refresh} />

      {agenda.error && <p className="ag-err" style={{ marginBottom: 12 }}>agenda injoignable : {agenda.error}</p>}
      {!agenda.data && !agenda.error && <p style={{ color: 'var(--muted)' }}>chargement…</p>}

      {agenda.data && (
        <div key={`${view}-${start}`} className={`ag-anim ${dir}`}>
          {view === 'semaine' && <WeekView {...viewProps} />}
          {view === 'mois' && (
            <MonthView {...viewProps} month={anchor.slice(0, 7)} openDay={openDay}
              onToggleDay={(day) => setOpenDay(openDay === day ? null : day)}
              drawer={(day) => (
                <DayDrawer day={day} today={today} occs={inRange} onSelect={setSelected} onClose={() => setOpenDay(null)}
                  onWeek={openWeek} onChanged={agenda.refresh} onLog={openLog} />
              )} />
          )}
          {view === 'liste' && <ListView {...viewProps} />}
        </div>
      )}

      <div className="ag-legend">
        <span><i />à venir</span><span className="today"><i />aujourd'hui, relance</span><span className="done"><i />fait, réparé</span>
        <span className="bad"><i />en échec ou manqué</span><span className="past"><i />passé, ignoré</span>
      </div>

      {current && (
        <EventDetail occ={current} onClose={() => setSelected(null)} onEdit={() => edit(current)} onDeleted={reload} onLog={openLog}
          onChanged={agenda.refresh}
          extra={current.event_id === 'auto-disque-tournant' ? <RotationCard compact onFinished={agenda.refresh} /> : undefined} />
      )}
      {draft && <EventForm initial={draft} onClose={() => setDraft(null)} onSaved={reload} />}
    </>
  )
}
