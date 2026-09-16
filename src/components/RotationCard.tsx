import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, withConfirm } from '../lib/api'
import { fmtBytes, usePoll } from '../lib/poll'
import { Btn, Chip } from './ui'
import { fmtDuration } from './AgendaParts'

// Disque tournant (Borg sur le disque USB ext-backup) : état en direct, lancement et arrêt depuis l'agenda,
// avec heure de départ, chrono, avancement réel et fin estimée pendant la sauvegarde

type Progress = {
  phase: string; phase_label: string; source: 'script' | 'tracking'
  files_done: number; files_total: number; bytes_read: number; bytes_total: number
  percent: number | null; files_per_s: number | null; eta: string | null; current: string; stale: boolean
}

type Rotation = {
  state: 'missing' | 'running' | 'failed' | 'never' | 'ok'
  running: boolean; mounted: boolean; ready: boolean; age_days: number | null
  last_run: string | null; result: string | null
  can_start: boolean; can_stop: boolean; reason: string; log: string[]
  started_at: string | null; finished_at: string | null; duration_s: number | null; progress: Progress | null
}

const nf = new Intl.NumberFormat('fr-FR')
const pad = (n: number) => String(n).padStart(2, '0')
const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
const whenLabel = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const hourLabel = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

function summary(r: Rotation): { label: string; tone?: 'ok' | 'warn' | 'crit' | 'gold' } {
  if (r.running) return { label: 'sauvegarde en cours', tone: 'gold' }
  if (r.state === 'failed') return { label: 'dernier passage en échec', tone: 'crit' }
  if (r.age_days === null) return { label: 'jamais faite', tone: 'warn' }
  return { label: r.age_days === 0 ? "faite aujourd'hui" : `faite il y a ${r.age_days} j`, tone: r.age_days >= 7 ? 'warn' : 'ok' }
}

function Live({ r, now }: { r: Rotation; now: number }) {
  const p = r.progress
  const elapsed = r.started_at ? Math.max(0, (now - new Date(r.started_at).getTime()) / 1000) : null
  const current = p?.current ? (p.current.length > 90 ? `…${p.current.slice(-89)}` : p.current) : ''
  return (
    <div className="ag-rot-live">
      <div className="line">
        {r.started_at && <span>démarrée {whenLabel(r.started_at)}</span>}
        {p && <span>{p.phase_label}</span>}
        {elapsed !== null && <b className="timer" title="temps écoulé">{clock(elapsed)}</b>}
      </div>
      <div className={`ag-progress ${p?.percent != null ? 'det' : ''}`}>
        <i style={p?.percent != null ? { width: `${Math.max(2, p.percent)}%` } : undefined} />
      </div>
      {p && (
        <div className="line">
          {p.percent != null && <b className="num">{nf.format(p.percent)} %</b>}
          {p.files_total > 0 && <span>{nf.format(p.files_done)} / {nf.format(p.files_total)} fichiers</span>}
          {p.bytes_total > 0 && <span>lu {fmtBytes(p.bytes_read)} / {fmtBytes(p.bytes_total)}</span>}
          {p.files_per_s != null && <span>{nf.format(p.files_per_s)} fichiers/s</span>}
          {p.eta && <span>fin estimée vers <b className="num">{hourLabel(p.eta)}</b></span>}
        </div>
      )}
      {current && <div className="cur" title={p?.current}>{current}</div>}
      {p?.source === 'tracking' && <p className="why">suivi par fichiers (le script installé ne publie pas encore les octets lus)</p>}
      {p?.stale && <p className="why">pas de nouvelle depuis plus de 30 s : sans doute un gros fichier (image de VM) en cours</p>}
      {!p && <p className="why">en attente des premiers chiffres…</p>}
    </div>
  )
}

export function RotationCard({ onFinished, compact }: { onFinished: () => void; compact?: boolean }) {
  const rot = usePoll<Rotation>(() => apiGet('/agenda/rotation'), 30000)
  const [pending, setPending] = useState<'start' | 'stop' | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [err, setErr] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const r = rot.data
  const running = Boolean(r?.running)
  const wasRunning = useRef(false)

  // suivi rapproché (3 s) pendant une demande ou une sauvegarde en cours, chrono à la seconde
  useEffect(() => {
    if (!running && !pending) return
    const poll = setInterval(rot.refresh, 3000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [running, pending]) // eslint-disable-line react-hooks/exhaustive-deps

  // fin de sauvegarde : l'agenda se met à jour (l'occurrence passe à « fait » ou « en échec »)
  useEffect(() => {
    if (running && pending === 'start') setPending(null)
    if (!running && pending === 'stop') setPending(null)
    if (wasRunning.current && !running) onFinished()
    wasRunning.current = running
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(kind: 'start' | 'stop') {
    setErr(''); setConfirmStop(false)
    try {
      await apiPost(`/agenda/rotation/${kind}`, undefined, await withConfirm(`backup_rotation_${kind}`))
      setPending(kind); rot.refresh()
      // filet : une sauvegarde qui échoue en quelques secondes n'est jamais vue « en cours »
      setTimeout(() => { setPending((p) => (p === kind ? null : p)); onFinished() }, 20000)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }

  if (!r) return rot.error ? <p className="ag-err">disque tournant : {rot.error}</p> : null
  const s = summary(r)
  return (
    <div className={`ag-rot ${running ? 'running' : ''} ${compact ? 'compact' : ''}`}>
      <div className="top">
        <span className={`disk ${r.mounted ? 'on' : ''}`} />
        <div className="txt">
          <b>disque tournant</b>
          <span>{r.mounted ? 'branché' : 'non branché'} <Chip tone={s.tone}>{s.label}</Chip></span>
        </div>
        <span className="sp" />
        {running
          ? (confirmStop
            ? <Btn sm danger onClick={() => act('stop')}>confirmer l'arrêt</Btn>
            : <Btn sm onClick={() => setConfirmStop(true)} disabled={!r.can_stop || pending === 'stop'}>{pending === 'stop' ? 'arrêt…' : 'arrêter'}</Btn>)
          : <Btn sm solid onClick={() => act('start')} disabled={!r.can_start || pending === 'start'}>{pending === 'start' ? 'démarrage…' : 'lancer la sauvegarde'}</Btn>}
        {r.log.length > 0 && <Btn sm onClick={() => setShowLog(!showLog)}>{showLog ? 'masquer le journal' : 'journal'}</Btn>}
      </div>
      {(running || pending === 'start') && <Live r={r} now={now} />}
      {!running && r.finished_at && (
        <p className="last">
          dernier passage : {whenLabel(r.finished_at)}{r.duration_s != null ? ` · durée ${fmtDuration(r.duration_s)}` : ''}
          {r.result && r.result !== 'success' ? ` · ${r.result}` : ''}
        </p>
      )}
      {r.reason && !running && <p className="why">{r.reason}</p>}
      {err && <p className="ag-err">{err}</p>}
      {showLog && r.log.length > 0 && <pre>{r.log.join('\n')}</pre>}
    </div>
  )
}
