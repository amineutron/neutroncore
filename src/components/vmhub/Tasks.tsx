import { useEffect, useRef } from 'react'
import {
  KIND_LABEL, TASK_FILTERS, durationText, filterTasks, kindOfJob, progressOf, sortTasks, stateOf, stepLabel, titleOf,
  type TaskFilter, type TaskJob,
} from '../../lib/vmTasks'
import { Btn } from '../ui'
import { Q } from './Help'

const STATE_LABEL = { run: 'en cours', ok: 'terminée', error: 'échouée' } as const
const hhmmss = (t: number) => new Date(t * 1000).toLocaleTimeString('fr-FR')

function Row({ j, on, onPick }: { j: TaskJob; on: boolean; onPick: () => void }) {
  const st = stateOf(j)
  const p = progressOf(j)
  return (
    <button className={`vh-trow${on ? ' on' : ''}`} onClick={onPick}>
      <span className="lite">{kindOfJob(j) === 'export' ? '↥' : kindOfJob(j) === 'import' ? '↧' : '•'}</span>
      <span className="tt">{titleOf(j)}</span>
      <span className="vh-tag" style={{ color: st === 'ok' ? 'var(--ok)' : st === 'error' ? 'var(--rose)' : 'var(--gold)' }}>{STATE_LABEL[st]}</span>
      <span className="tm">{KIND_LABEL[kindOfJob(j)] ?? kindOfJob(j)} · {j.vm} · {durationText(j)}</span>
      {st === 'run' && p !== null && <span className="tb"><b style={{ width: `${p}%` }} /></span>}
    </button>
  )
}

function Detail({ j, onOpenVm }: { j: TaskJob; onOpenVm: (vm: string) => void }) {
  const st = stateOf(j)
  const p = progressOf(j)
  const log = useRef<HTMLDivElement>(null)
  const stick = useRef(true)   // vrai tant que l'utilisateur n'a pas remonte le journal a la main
  const lines = j.log ?? (j.message ? [j.message] : [])
  useEffect(() => { stick.current = true }, [j.id])
  useEffect(() => {
    const el = log.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [lines.length, j.id])
  return (
    <section className="vh-tdet">
      <div className="vh-row"><h3>{titleOf(j)}</h3><span className="vh-tag" role="status">{STATE_LABEL[st]}</span></div>
      <div className={`vh-tbar ${st}${st === 'run' && p === null ? ' indet' : ''}`}><b style={{ width: `${p ?? 35}%` }} /></div>
      <dl className="vh-kv">
        <dt>type</dt><dd>{KIND_LABEL[kindOfJob(j)] ?? kindOfJob(j)}</dd>
        <dt>machine</dt><dd><button className="vh-link" onClick={() => onOpenVm(j.vm)}>{j.vm}</button></dd>
        <dt>démarrée</dt><dd>{hhmmss(j.started)}</dd>
        <dt>durée</dt><dd>{durationText(j)}</dd>
        {j.steps && j.steps.length > 0 && <><dt>étapes</dt><dd>{j.steps.filter((s) => s.st === 'done').length} / {j.steps.length}</dd></>}
      </dl>
      {j.steps && j.steps.length > 0 && (
        <ol className="vh-steps">{j.steps.map((s, i) => <li key={i} className={s.st}><span className="ti" /><span>{stepLabel(s.n)}</span></li>)}</ol>
      )}
      {j.error && <p className="vm-err">{j.error}</p>}
      <div><div className="vh-lab" style={{ marginBottom: 5 }}>journal</div>
        <div className="vh-log" ref={log} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 24 }}>{lines.length ? lines.join('\n') : 'aucune sortie pour l\'instant'}</div></div>
    </section>
  )
}

/** Taches des VMs : liste filtrable + detail (etapes, journal). */
export function Tasks({ jobs, sel, onSel, filter, onFilter, onOpenVm }: {
  jobs: TaskJob[]; sel: string; onSel: (id: string) => void; filter: TaskFilter; onFilter: (f: TaskFilter) => void; onOpenVm: (vm: string) => void
}) {
  const list = sortTasks(filterTasks(jobs, filter))
  const cur = jobs.find((j) => j.id === sel) ?? list[0]
  return (
    <div className="vh-enter">
      <div className="vh-ph"><h2>tâches<Q k="tasks" /></h2><span className="lite">Chaque action longue est tracée ici : nom, étapes et journal.</span></div>
      <div className="vh-tg">
        <aside>
          <div className="vh-chips" style={{ marginBottom: 10 }}>{TASK_FILTERS.map((f) => <button key={f} className={`vh-chip${filter === f ? ' on' : ''}`} onClick={() => onFilter(f)}>{f}</button>)}</div>
          <div className="vh-tl">
            {list.map((j) => <Row key={j.id} j={j} on={cur?.id === j.id} onPick={() => onSel(j.id)} />)}
            {list.length === 0 && <div className="vh-empty">{jobs.length ? 'aucune tâche pour ce filtre.' : 'aucune tâche : lance un export, un clone ou un snapshot.'}</div>}
          </div>
        </aside>
        {cur ? <Detail j={cur} onOpenVm={onOpenVm} /> : <div className="vh-empty">sélectionne une tâche.</div>}
      </div>
      {jobs.some((j) => j.status === 'running') && <p className="lite"><Btn sm onClick={() => onFilter('en cours')}>voir seulement celles en cours</Btn></p>}
    </div>
  )
}
