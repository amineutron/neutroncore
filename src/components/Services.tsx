import { useState } from 'react'
import { apiPost, withConfirm } from '../lib/api'
import { confirmDialog, toast } from '../lib/dialog'
import { Card } from './ui'

export type Service = {
  name: string; display_name: string; status: string; type: string
  extra: Record<string, string>; controllable?: boolean
}

// État des services ; ceux que l'API sait piloter (controllable) se démarrent
// ou s'arrêtent d'un clic, après confirmation et jeton X-Confirm.
export function Services({ services, onChange }: { services: Service[]; onChange: () => void }) {
  const [busy, setBusy] = useState('')

  async function toggle(s: Service) {
    const stop = s.status === 'up'
    const ok = await confirmDialog(stop
      ? { title: `arrêter ${s.display_name} ?`, body: 'Tout ce qui en dépend cessera de répondre jusqu’au redémarrage.', ok: 'arrêter', danger: true }
      : { title: `démarrer ${s.display_name} ?`, ok: 'démarrer' })
    if (!ok) return
    const action = stop ? 'stop' : 'start'
    setBusy(s.name)
    try {
      const r = await apiPost<{ success: boolean; message?: string }>(
        `/services/${s.name}/${action}`, undefined, await withConfirm(`service_${action}_${s.name}`))
      toast(r.success ? `${s.display_name} : ${stop ? 'arrêté' : 'démarré'}` : `échec : ${r.message ?? s.display_name}`, r.success ? 'ok' : 'crit')
      onChange()
      // un conteneur met quelques secondes à répondre : second relevé
      setTimeout(onChange, 6000)
    } catch (e) {
      toast(`échec : ${(e as Error).message}`, 'crit')
    } finally { setBusy('') }
  }

  const sorted = [...services].sort((a, b) => (a.status === 'up' ? 1 : 0) - (b.status === 'up' ? 1 : 0))
  return (
    <Card title="services" lite="les indisponibles en premier · clic : démarrer / arrêter" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sorted.map((s) => {
          const down = s.status !== 'up'
          const content = (
            <>
              <span className={`dot ${s.status === 'up' ? 'ok' : s.status === 'starting' ? 'warn' : s.status === 'down' ? 'crit' : 'off'}`} />
              {s.display_name}
              {busy === s.name
                ? <span className="spinner" style={{ width: 10, height: 10 }} />
                : down && <span style={{ color: 'var(--crit)', fontFamily: 'var(--mono)', fontSize: 9.5 }}>{s.status === 'down' ? 'down' : s.status}</span>}
            </>
          )
          const style = down ? { borderColor: 'color-mix(in srgb, var(--crit) 45%, var(--line))' } : undefined
          return s.controllable
            ? (
              <button key={s.name} className="svc svc-btn" style={style} disabled={busy === s.name}
                title={down ? 'démarrer' : 'arrêter'} onClick={() => toggle(s)}>{content}</button>
            )
            : <span key={s.name} className="svc" style={style} title="non pilotable depuis l'app">{content}</span>
        })}
      </div>
    </Card>
  )
}
