import { useEffect, useRef, useState } from 'react'
import { toast } from '../lib/dialog'
import { POWER_LABEL, powerVm, type Power } from '../lib/vmHubApi'
import { LIFE_LABEL, POWER_ACTIONS, POWER_BUSY, POWER_SHORT, POWER_TARGET, isDangerous, lifeOf, pollVerdict, reachedTarget } from '../lib/vmPower'
import type { Vm } from '../lib/vms'
import { Btn, Chip } from './ui'

// Alimentation d'une VM avec double vérification : 1er clic = armé (6 s pour confirmer),
// 2e clic = requête avec jeton HMAC lié à la VM et à l'action. Suivi par relecture toutes les 5 s.
// Boutons selon l'état : en marche -> pause, redémarrer, arrêter, forcer ; en pause -> reprendre,
// forcer ; éteinte -> démarrer.
type Phase = 'idle' | 'armed' | 'pending' | 'done' | 'error'

const ARM_MS = 6000
const POLL_MS = 5000

export function VmRow({ vm, onRefresh, i }: { vm: Vm; onRefresh: () => void; i: number }) {
  const name = vm.name.replace(/^vm_/, '')
  const life = lifeOf(vm)
  const [phase, setPhase] = useState<Phase>('idle')
  const [action, setAction] = useState<Power>(life === 'stopped' ? 'start' : 'stop')
  const [err, setErr] = useState('')
  const [canForce, setCanForce] = useState(false)
  const startedAt = useRef(0)
  const left = useRef(false)   // redémarrage : la machine a quitté « en marche » au moins une fois
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (f: () => void, ms: number) => { timers.current = [...timers.current, setTimeout(f, ms)] }
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])   // démontage : aucun rappel orphelin

  // armé : désarmement automatique si pas de confirmation
  useEffect(() => {
    if (phase !== 'armed') return
    const t = setTimeout(() => setPhase('idle'), ARM_MS)
    return () => clearTimeout(t)
  }, [phase])

  // en cours : relecture jusqu'à l'état visé ; au-delà des délais, proposer de forcer (arrêt) ou conclure (redémarrage
  // jamais vu passer par la transition : l'effet de fin ne se rejoue pas si `life` ne bouge pas, donc on conclut ici)
  useEffect(() => {
    if (phase !== 'pending') return
    const poll = setInterval(() => {
      onRefresh()
      const v = pollVerdict(action, Date.now() - startedAt.current)
      if (v.canForce) setCanForce(true)
      if (v.done) { setPhase('done'); setCanForce(false) }
    }, POLL_MS)
    return () => clearInterval(poll)
  }, [phase, action, onRefresh])

  useEffect(() => {
    if (phase !== 'pending') return
    if (life !== POWER_TARGET[action]) left.current = true
    if (reachedTarget(action, life, left.current)) { setPhase('done'); setCanForce(false) }
  }, [life, phase, action])

  // fait : retour au repos (effet a part : un effet qui change `phase` verrait son propre minuteur annule)
  useEffect(() => {
    if (phase !== 'done') return
    const t = setTimeout(() => setPhase('idle'), 1600)
    return () => clearTimeout(t)
  }, [phase])

  function arm(a: Power) {
    setErr('')
    setAction(a)
    setPhase('armed')
  }

  async function confirm() {
    setPhase('pending')
    setCanForce(false)
    left.current = false
    startedAt.current = Date.now()
    try {
      await powerVm(name, action)
      toast(`${POWER_LABEL[action].toast} ${name}`)
      onRefresh()
      later(onRefresh, 3000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setPhase('error')
      later(() => setPhase((p) => (p === 'error' ? 'idle' : p)), 900)
    }
  }

  const dot = phase === 'pending' || life === 'transition' ? 'busy' : life === 'running' ? 'ok' : life === 'paused' ? 'warn' : 'off'

  return (
    <tr className={`vm-row ${phase}`} style={{ '--i': i } as React.CSSProperties} data-life={life}>
      <td className="mono">
        <span className={`vm-dot ${dot}`} />
        {name}
      </td>
      <td style={{ textAlign: 'right' }}>
        <div className="vm-actions">
          {phase === 'pending'
            ? <span className="vm-busy">{POWER_BUSY[action]}</span>
            : phase !== 'armed' && <Chip tone={life === 'running' ? 'ok' : life === 'paused' ? 'warn' : undefined}>{LIFE_LABEL[life]}</Chip>}
          {phase === 'armed' ? (
            <>
              <Btn sm solid={!isDangerous(action)} danger={isDangerous(action)} onClick={confirm}>oui, {POWER_LABEL[action].verb}</Btn>
              <button type="button" className="x" onClick={() => setPhase('idle')}>annuler</button>
            </>
          ) : phase === 'pending' ? (
            canForce && <Btn sm danger onClick={() => arm('force_stop')}>{POWER_LABEL.force_stop.verb}</Btn>
          ) : POWER_ACTIONS[life].map((a) => (
            <Btn key={a} sm danger={isDangerous(a)} solid={a === 'start' || a === 'resume'} onClick={() => arm(a)}>{POWER_SHORT[a]}</Btn>
          ))}
        </div>
        {phase === 'armed' && <div className="vm-countdown"><i style={{ animationDuration: `${ARM_MS}ms` }} /></div>}
        {phase === 'pending' && <div className="ag-progress vm-progress"><i /></div>}
        {err && <p className="vm-err">{err}</p>}
      </td>
    </tr>
  )
}
