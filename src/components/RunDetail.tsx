import { runLabel, triggerLabel, type Run } from '../lib/automations'
import { ago } from '../lib/notifs'

const ms = (v?: number) => (v === undefined ? '' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`)

// Derniers passages d'une automatisation ; le passage choisi se lit étape par étape.
export function RunHistory({ runs, selected, onSelect }: { runs: Run[]; selected: number; onSelect: (i: number) => void }) {
  if (runs.length === 0) return <p className="au-note">Aucun passage pour l'instant.</p>
  const run = runs[Math.min(selected, runs.length - 1)]
  return (
    <>
      <div className="au-runs" role="listbox" aria-label="Passages">
        {runs.map((h, i) => (
          <button key={i} role="option" aria-selected={i === selected} className={`au-run ${i === selected ? 'sel' : ''}`} onClick={() => onSelect(i)}>
            <span className={`dot ${h.skipped ? 'off' : h.success ? 'ok' : 'crit'}`} />
            <span className="au-run-main">{runLabel(h)}</span>
            <span className="au-run-meta">{triggerLabel(h.trigger)}{h.why && !h.skipped && h.why !== triggerLabel(h.trigger) ? ` · ${h.why}` : ''} · {ago(h.at, Date.now())}</span>
          </button>
        ))}
      </div>
      {!run.skipped && (run.steps?.length ?? 0) > 0 && (
        <table className="au-steps">
          <tbody>
            {run.steps!.map((s, i) => (
              <tr key={i} className={s.not_run ? 'idle' : s.ok ? '' : 'fail'}>
                <td className="num">{i + 1}</td>
                <td>{s.label}{s.error && <em> — {s.error}</em>}</td>
                <td className="num">{s.not_run ? 'non exécutée' : `${s.ok ? 'ok' : 'échec'}${(s.attempts ?? 1) > 1 ? ` · ${s.attempts} essais` : ''}`}</td>
                <td className="num">{s.not_run ? '' : ms(s.ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!run.skipped && run.duration_s !== undefined && <p className="au-note">Durée totale : {run.duration_s} s.</p>}
    </>
  )
}
