import { useEffect, useState, useSyncExternalStore } from 'react'
import { answerDialog, currentDialog, dismissToast, getToasts, subscribeDialogs, type Pending } from '../lib/dialog'

function Question({ d }: { d: Pending }) {
  const [checked, setChecked] = useState(false)
  const close = (ok: boolean) => answerDialog(d.id, { ok, checked: ok && checked })
  // Échap annule. Entrée n'est PAS interceptée : elle active le bouton qui a le
  // focus, et ce focus démarre sur « annuler » pour une action destructive.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') answerDialog(d.id, { ok: false, checked: false }) }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.() }
  }, [d.id])
  return (
    <div className="pre-modal nc-dialog" onClick={() => close(false)}>
      <div className="inner" role="alertdialog" aria-modal="true" aria-label={d.title} aria-describedby="nc-dialog-body" onClick={(e) => e.stopPropagation()}>
        <div className="nc-dialog-body" id="nc-dialog-body">
          <b>{d.title}</b>
          {d.body && <p>{d.body}</p>}
          {d.check && (
            <label className="nc-dialog-check">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              {d.check}
            </label>
          )}
        </div>
        <div className="nc-dialog-actions">
          {/* .x : le bouton retour (popstate dans App) ferme la modale par cet élément */}
          {d.single
            ? <button className="btn solid x" autoFocus onClick={() => close(false)}>{d.ok ?? 'compris'}</button>
            : (
              <>
                <button className="btn x" autoFocus={!!d.danger} onClick={() => close(false)}>{d.cancel ?? 'annuler'}</button>
                <button className={`btn ${d.danger ? 'danger armed' : 'solid'}`} autoFocus={!d.danger} onClick={() => close(true)}>
                  {d.ok ?? 'confirmer'}
                </button>
              </>
            )}
        </div>
      </div>
    </div>
  )
}

// Hôte unique des dialogues et messages (monté dans App)
export function Dialogs() {
  const d = useSyncExternalStore(subscribeDialogs, currentDialog)
  const toasts = useSyncExternalStore(subscribeDialogs, getToasts)
  return (
    <>
      {d && <Question key={d.id} d={d} />}
      {toasts.length > 0 && (
        <div className="nc-toasts" role="status">
          {toasts.map((t) => (
            <div key={t.id} className={`nc-toast ${t.tone}`} onClick={() => dismissToast(t.id)}>{t.text}</div>
          ))}
        </div>
      )}
    </>
  )
}
