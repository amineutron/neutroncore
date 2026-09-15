import { useState } from 'react'
import { apiDelete, apiPost, apiPut, withConfirm } from '../lib/api'
import { Btn, Chip } from './ui'

// Pièces de l'écran agenda : fiche d'un événement (au clic), actions sur les échecs, formulaire manuel

export type Occurrence = {
  id: string; event_id: string; source: 'auto' | 'manual'
  title: string; category: string; start: string; end: string
  recurrence: 'none' | 'daily' | 'weekly'; event_start: string; duration_min: number
  description: string; notify: boolean
  unit: string | null; log: string | null
  status: 'upcoming' | 'pending' | 'done' | 'failed' | 'missed' | 'past' | 'dismissed' | 'retrying' | 'repaired'
  run: { time: string; result: string; started?: string; duration_s?: number } | null
  can_retry: boolean; can_dismiss: boolean; can_restore: boolean
}

export const CATEGORY_LABEL: Record<string, string> = { sauvegardes: 'sauvegardes', systeme: 'système', perso: 'perso' }
const RECURRENCE_LABEL = { none: 'une fois', daily: 'chaque jour', weekly: 'chaque semaine' }
export const STATUS: Record<Occurrence['status'], { label: string; tone?: 'ok' | 'warn' | 'crit' | 'gold' }> = {
  upcoming: { label: 'à venir' },
  pending: { label: 'en attente', tone: 'gold' },
  done: { label: 'fait', tone: 'ok' },
  failed: { label: 'en échec', tone: 'crit' },
  missed: { label: 'manqué', tone: 'crit' },
  past: { label: 'passé' },
  dismissed: { label: 'ignoré' },
  retrying: { label: 'relance en cours', tone: 'gold' },
  repaired: { label: 'réparé', tone: 'ok' },
}

export const isProblem = (o: Occurrence) => o.status === 'failed' || o.status === 'missed'

/** Classe couleur : à venir neutre, aujourd'hui ou relance or, fait ou réparé vert, échec rouge, passé ou ignoré gris */
export function tone(o: Occurrence, today: string): string {
  if (o.status === 'done' || o.status === 'repaired') return 'done'
  if (isProblem(o)) return 'bad'
  if (o.status === 'past' || o.status === 'dismissed') return 'past'
  if (o.status === 'retrying') return 'today'
  return o.start.startsWith(today) ? 'today' : 'up'
}

export const hhmm = (iso: string) => iso.slice(11, 16)

/** 42 s · 12 min 03 s · 1 h 05 min */
export function fmtDuration(s: number): string {
  if (s < 60) return `${Math.round(s)} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}
export const dayLabel = (day: string) =>
  new Date(`${day}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="row"><span className="k">{k}</span><span>{children}</span></div>
}

/** Relancer, ignorer, rétablir, ignorer les anciens, journal — n'affiche que ce qui s'applique à l'occurrence */
export function FailureActions({ occ, onChanged, onLog, compact }: {
  occ: Occurrence; onChanged: () => void; onLog?: (unit: string) => void; compact?: boolean
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmPast, setConfirmPast] = useState(false)
  const [msg, setMsg] = useState('')
  if (!occ.can_retry && !occ.can_dismiss && !occ.can_restore) return null
  const enc = encodeURIComponent(occ.id)

  async function run(kind: string, call: () => Promise<unknown>, done: (r: unknown) => string) {
    setBusy(kind); setMsg(''); setConfirmPast(false)
    try {
      setMsg(done(await call()))
      onChanged()
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }

  return (
    <div className={`ag-fix ${compact ? 'compact' : ''}`} onClick={(e) => e.stopPropagation()}>
      {occ.can_retry && (
        <Btn sm solid disabled={busy !== null}
          onClick={() => run('retry', async () => apiPost(`/agenda/occurrences/${enc}/retry`, undefined, await withConfirm('agenda_retry')), () => 'relance demandée')}>
          {busy === 'retry' ? 'relance…' : 'relancer'}
        </Btn>
      )}
      {occ.can_dismiss && (
        <Btn sm disabled={busy !== null} onClick={() => run('dismiss', () => apiPost(`/agenda/occurrences/${enc}/dismiss`), () => 'échec ignoré')}>ignorer</Btn>
      )}
      {occ.can_restore && (
        <Btn sm disabled={busy !== null} onClick={() => run('restore', () => apiDelete(`/agenda/occurrences/${enc}/dismiss`), () => 'échec rétabli')}>rétablir</Btn>
      )}
      {!compact && occ.can_dismiss && occ.source === 'auto' && (confirmPast
        ? <Btn sm danger disabled={busy !== null}
            onClick={() => run('past', () => apiPost(`/agenda/events/${occ.event_id}/dismiss-past`),
              (r) => `${(r as { dismissed: number }).dismissed} anciens échecs ignorés`)}>confirmer : ignorer tous les anciens</Btn>
        : <Btn sm disabled={busy !== null} onClick={() => setConfirmPast(true)}>ignorer les anciens</Btn>)}
      {occ.log && onLog && <Btn sm onClick={() => onLog(occ.log!)}>journal</Btn>}
      {msg && <span className="ag-fix-msg">{msg}</span>}
    </div>
  )
}

export function EventDetail({ occ, onClose, onEdit, onDeleted, onLog, onChanged, extra }: {
  occ: Occurrence; onClose: () => void; onEdit: () => void; onDeleted: () => void; onLog: (unit: string) => void
  onChanged: () => void
  extra?: React.ReactNode   // bloc propre à l'événement (ex. bouton du disque tournant)
}) {
  const [confirming, setConfirming] = useState(false)
  const [err, setErr] = useState('')
  const st = STATUS[occ.status]
  async function remove() {
    try {
      await apiDelete(`/agenda/events/${occ.event_id}`, await withConfirm('agenda_delete'))
      onDeleted()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }
  return (
    <div className="pre-modal" onClick={onClose}>
      <div className="inner ag-modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          {occ.source === 'auto' ? 'événement automatique' : 'événement'}
          <span style={{ flex: 1 }} />
          <span className="x" onClick={onClose}>fermer</span>
        </div>
        <div className="ag-detail">
          <h3 className="ag-title">{occ.title}</h3>
          <div className="ag-chips">
            <Chip tone={st.tone}>{st.label}</Chip>
            <Chip>{CATEGORY_LABEL[occ.category] ?? occ.category}</Chip>
            {occ.notify && <Chip tone="rose">rappel accueil</Chip>}
          </div>
          <Row k="quand">{dayLabel(occ.start.slice(0, 10))}, {hhmm(occ.start)} - {hhmm(occ.end)}</Row>
          <Row k="répétition">{RECURRENCE_LABEL[occ.recurrence]}</Row>
          {occ.description && <Row k="détail">{occ.description}</Row>}
          {occ.unit && <Row k="unité">{occ.unit}</Row>}
          {occ.run && (
            <Row k="passage">
              {dayLabel(occ.run.time.slice(0, 10))}, {occ.run.started ? `de ${hhmm(occ.run.started)} à ${hhmm(occ.run.time)}` : `fin à ${hhmm(occ.run.time)}`}
              {occ.run.duration_s !== undefined ? ` (durée ${fmtDuration(occ.run.duration_s)})` : ''} : {occ.run.result === 'done' ? 'réussi' : occ.run.result}
            </Row>
          )}
          {occ.unit && !occ.run && occ.status === 'missed' && <Row k="passage">aucun passage trouvé dans le journal pour ce créneau</Row>}
          {occ.status === 'retrying' && <Row k="relance">demandée, en attente du résultat</Row>}
          <FailureActions occ={occ} onChanged={onChanged} />
          {extra}
          {err && <p className="ag-err">{err}</p>}
          <div className="ag-actions">
            {occ.log && <Btn sm solid onClick={() => onLog(occ.log!)}>voir le journal</Btn>}
            {occ.source === 'manual' && <Btn sm onClick={onEdit}>modifier</Btn>}
            {occ.source === 'manual' && (confirming
              ? <Btn sm danger onClick={remove}>confirmer la suppression</Btn>
              : <Btn sm onClick={() => setConfirming(true)}>supprimer</Btn>)}
          </div>
        </div>
      </div>
    </div>
  )
}

export type EventDraft = { id?: string; title: string; category: string; start: string; duration_min: number; recurrence: string; description: string; notify: boolean }

export function EventForm({ initial, onClose, onSaved }: { initial: EventDraft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState(initial)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setD({ ...d, [k]: v })
  async function save() {
    setBusy(true); setErr('')
    const { id, ...body } = d
    try {
      if (id) await apiPut(`/agenda/events/${id}`, body)
      else await apiPost('/agenda/events', body)
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return (
    <div className="pre-modal" onClick={onClose}>
      <div className="inner ag-modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          {d.id ? 'modifier l\'événement' : 'nouvel événement'}
          <span style={{ flex: 1 }} />
          <span className="x" onClick={onClose}>fermer</span>
        </div>
        <div className="ag-form">
          <label className="wide">titre<input value={d.title} maxLength={120} onChange={(e) => set('title', e.target.value)} autoFocus /></label>
          <label>jour<input type="date" value={d.start.slice(0, 10)} onChange={(e) => set('start', `${e.target.value}T${d.start.slice(11, 16)}`)} /></label>
          <label>heure<input type="time" value={d.start.slice(11, 16)} onChange={(e) => set('start', `${d.start.slice(0, 10)}T${e.target.value}`)} /></label>
          <label>durée (min)<input type="number" min={0} max={10080} value={d.duration_min} onChange={(e) => set('duration_min', Number(e.target.value) || 0)} /></label>
          <label>catégorie
            <select value={d.category} onChange={(e) => set('category', e.target.value)}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>répétition
            <select value={d.recurrence} onChange={(e) => set('recurrence', e.target.value)}>
              {Object.entries(RECURRENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={d.notify} onChange={(e) => set('notify', e.target.checked)} />rappel dans « à traiter » le jour même</label>
          <label className="wide">détail<textarea rows={3} maxLength={2000} value={d.description} onChange={(e) => set('description', e.target.value)} /></label>
          {err && <p className="ag-err wide">{err}</p>}
          <div className="ag-actions wide">
            <Btn solid onClick={save} disabled={busy || !d.title.trim()}>{busy ? 'enregistrement…' : 'enregistrer'}</Btn>
            <Btn onClick={onClose}>annuler</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
