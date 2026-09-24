import { useEffect, useRef, useState } from 'react'
import { apiPost, withConfirm } from '../lib/api'
import type { Vm } from '../lib/vms'
import { Btn, Chip } from './ui'

// Démarrage / arrêt d'une VM avec double vérification :
// 1er clic = armé (6 s pour confirmer), 2e clic = requête avec jeton HMAC
// lié à la VM et à l'action. Suivi par relecture de la liste toutes les 5 s.
type Action = 'start' | 'stop' | 'force_stop'
type Phase = 'idle' | 'armed' | 'pending' | 'done' | 'error'

const ARM_MS = 6000
const POLL_MS = 5000
const FORCE_AFTER_MS = 60000 // arrêt propre ignoré (pas d'OS invité, VM plantée)

const LABELS: Record<Action, { ask: string; confirm: string; busy: string; target: string }> = {
  start: { ask: 'démarrer', confirm: 'oui, démarrer', busy: 'démarrage…', target: 'up' },
  stop: { ask: 'arrêter', confirm: 'oui, arrêter', busy: 'arrêt…', target: 'down' },
  force_stop: { ask: "forcer l'arrêt", confirm: 'oui, forcer', busy: 'arrêt forcé…', target: 'down' },
}

export function VmRow({ vm, onRefresh, i }: { vm: Vm; onRefresh: () => void; i: number }) {
  const name = vm.name.replace(/^vm_/, '')
  const [phase, setPhase] = useState<Phase>('idle')
  const [action, setAction] = useState<Action>(vm.status === 'up' ? 'stop' : 'start')
  const [err, setErr] = useState('')
  const [canForce, setCanForce] = useState(false)
  const startedAt = useRef(0)

  // armé : désarmement automatique si pas de confirmation
  useEffect(() => {
    if (phase !== 'armed') return
    const t = setTimeout(() => setPhase('idle'), ARM_MS)
    return () => clearTimeout(t)
  }, [phase])

  // en cours : relecture de la liste jusqu'à l'état visé
  useEffect(() => {
    if (phase !== 'pending') return
    const poll = setInterval(() => {
      onRefresh()
      if (action === 'stop' && Date.now() - startedAt.current > FORCE_AFTER_MS) setCanForce(true)
    }, POLL_MS)
    return () => clearInterval(poll)
  }, [phase, action, onRefresh])

  useEffect(() => {
    if (phase === 'pending' && vm.status === LABELS[action].target) {
      setPhase('done')
      setCanForce(false)
      const t = setTimeout(() => setPhase('idle'), 1600)
      return () => clearTimeout(t)
    }
  }, [vm.status, phase, action])

  function arm(a: Action) {
    setErr('')
    setAction(a)
    setPhase('armed')
  }

  async function confirm() {
    setPhase('pending')
    setCanForce(false)
    startedAt.current = Date.now()
    try {
      const res = await apiPost<{ success: boolean; error: string | null }>(
        `/services/vms/${encodeURIComponent(name)}/${action}`, undefined, await withConfirm(`vm_${action}_${name}`),
      )
      if (!res.success) throw new Error(res.error ?? 'échec')
      onRefresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setPhase('error')
      setTimeout(() => setPhase((p) => (p === 'error' ? 'idle' : p)), 900)
    }
  }

  const up = vm.status === 'up'
  const transition = vm.status === 'starting'
  const dot = phase === 'pending' || transition ? 'busy' : up ? 'ok' : 'off'
  const L = LABELS[action]

  return (
    <tr className={`vm-row ${phase}`} style={{ '--i': i } as React.CSSProperties}>
      <td className="mono">
        <span className={`vm-dot ${dot}`} />
        {name}
      </td>
      <td style={{ textAlign: 'right' }}>
        <div className="vm-actions">
          {phase === 'pending'
            ? <span className="vm-busy">{L.busy}</span>
            : phase !== 'armed' && <Chip tone={up ? 'ok' : undefined}>{vm.extra?.vm_state ?? vm.status}</Chip>}
          {phase === 'armed' ? (
            <>
              <Btn sm solid={action === 'start'} danger={action !== 'start'} onClick={confirm}>{L.confirm}</Btn>
              <span className="x" onClick={() => setPhase('idle')}>annuler</span>
            </>
          ) : phase === 'pending' ? (
            canForce && <Btn sm danger onClick={() => arm('force_stop')}>{LABELS.force_stop.ask}</Btn>
          ) : !transition && (
            <Btn sm danger={up} onClick={() => arm(up ? 'stop' : 'start')}>{up ? LABELS.stop.ask : LABELS.start.ask}</Btn>
          )}
        </div>
        {phase === 'armed' && <div className="vm-countdown"><i style={{ animationDuration: `${ARM_MS}ms` }} /></div>}
        {phase === 'pending' && <div className="ag-progress vm-progress"><i /></div>}
        {err && <p className="vm-err">{err}</p>}
      </td>
    </tr>
  )
}
