import { useState } from 'react'
import { apiPost, withConfirm } from '../lib/api'
import type { LiveSession } from '../lib/sessions'
import { CLOSING_DEFAULT, CLOSING_STEPS, displayName } from '../lib/sessions'
import { Btn } from './ui'

// Fermeture d'une session Claude Code, en deux temps :
//   1. « fermer ? »  ->  2. « clôturer proprement avant ? » (étapes à cocher)
//      - clôturer : le prompt de clôture part dans la session, qui passe
//        « en fermeture » (chat toujours accessible) ; on ferme quand elle est prête
//      - fermer sans clôturer : seconde confirmation explicite, puis /exit
// Depuis une carte déjà en fermeture, seul « terminer » (double confirmation) reste.

type Step = 'ask' | 'clean' | 'confirm-now'

export function SessionClose({ session, onDone, onClose }: {
  session: LiveSession; onDone: (what: 'closing' | 'closed') => void; onClose: () => void
}) {
  const alreadyClosing = session.state === 'closing'
  const [step, setStep] = useState<Step>(alreadyClosing ? 'confirm-now' : 'ask')
  const [steps, setSteps] = useState<string[]>(CLOSING_DEFAULT)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const name = displayName(session)

  function toggle(id: string) {
    setSteps((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function run(mode: 'clean' | 'now') {
    setBusy(true); setErr('')
    try {
      await apiPost(`/launcher/sessions/${session.sessionId}/close`, { mode, steps: mode === 'clean' ? steps : [] }, await withConfirm('launcher_close'))
      onDone(mode === 'clean' ? 'closing' : 'closed')
      onClose()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="cs-close" onClick={(e) => e.stopPropagation()}>
      {step === 'ask' && (
        <>
          <b>Fermer la session « {name} » ?</b>
          <p>La session Claude Code sera quittée dans son terminal. Elle restera dans « récentes à reprendre ».</p>
          <div className="cs-close-btns">
            <Btn sm onClick={onClose}>annuler</Btn>
            <Btn sm solid onClick={() => setStep('clean')}>oui, fermer</Btn>
          </div>
        </>
      )}
      {step === 'clean' && (
        <>
          <b>Clôturer proprement avant de fermer ?</b>
          <p>Claude reçoit une consigne de clôture et la carte passe « en fermeture » : tu gardes le chat pour vérifier, puis tu termines quand elle est prête.</p>
          <div className="cs-close-steps">
            {CLOSING_STEPS.map((st) => (
              <label key={st.id} className={`cs-check ${!session.controllable ? 'off' : ''}`}>
                <input type="checkbox" checked={steps.includes(st.id)} disabled={!session.controllable} onChange={() => toggle(st.id)} />
                <span><b>{st.label}</b><small>{st.desc}</small></span>
              </label>
            ))}
          </div>
          {!session.controllable && <div className="cs-ro">fenêtre injoignable : impossible d’envoyer la consigne de clôture, seule la fermeture immédiate est possible.</div>}
          <div className="cs-close-btns">
            <Btn sm onClick={onClose}>annuler</Btn>
            <Btn sm onClick={() => setStep('confirm-now')}>fermer sans clôturer</Btn>
            <Btn sm solid disabled={busy || !session.controllable} onClick={() => run('clean')}>{busy ? '…' : 'clôturer proprement'}</Btn>
          </div>
        </>
      )}
      {step === 'confirm-now' && (
        <>
          <b className="crit">{alreadyClosing ? `Terminer la session « ${name} » maintenant ?` : `Fermer « ${name} » sans clôture ?`}</b>
          <p>
            {alreadyClosing
              ? (session.close_ready ? 'Claude a signalé que la clôture est terminée.' : 'La clôture n’est pas encore signalée comme terminée par Claude.')
              : 'Rien ne sera résumé ni vérifié. Le travail non commité reste sur le disque.'}
            {' '}Dernière confirmation.
          </p>
          <div className="cs-close-btns">
            <Btn sm onClick={onClose}>annuler</Btn>
            <Btn sm solid disabled={busy} onClick={() => run('now')}>{busy ? '…' : 'confirmer la fermeture'}</Btn>
          </div>
        </>
      )}
      {err && <div className="cs-err">{err}</div>}
    </div>
  )
}
