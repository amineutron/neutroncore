import { useState } from 'react'
import { toast } from '../../lib/dialog'
import { ENV_DEFAULT, ENV_LABEL, ENV_TOOLS, effectiveEnv, envCommand, envIsEmpty, envLabels, needsUi, type EnvChoice } from '../../lib/vmEnv'
import { deployImage } from '../../lib/vmHubApi'
import { FMT_LABEL, FMT_TIME, hasUi, sizeText, type LibEntry } from '../../lib/vmLibrary'
import { nameError } from '../../lib/vmsConsole'
import { Btn } from '../ui'
import { Modal, Q } from './Help'

/** Entier dans [lo, hi] ou message : la saisie reste libre jusqu'a la validation (voir NumField). */
export function intError(text: string, lo: number, hi: number, unit: string): string | null {
  const t = text.trim()
  if (!/^\d{1,6}$/.test(t)) return 'un nombre entier'
  const n = Number(t)
  return n < lo || n > hi ? `entre ${lo} et ${hi} ${unit}`.trim() : null
}

function Field({ id, label, value, onChange, error, help }: { id: string; label: string; value: string; onChange: (v: string) => void; error: string | null; help?: string }) {
  return (
    <div className="vh-field" style={{ flex: 1 }}>
      <label htmlFor={id}>{label}{help && <Q k={help} />}</label>
      <input id={id} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} />
      {error && <span id={`${id}-e`} className="vh-err" role="alert">{error}</span>}
    </div>
  )
}

/** Deploiement d'une edition de la bibliotheque, avec « mon environnement » en option. */
export function DeployDialog({ entry, names, onClose, onDone }: { entry: LibEntry; names: string[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [vcpus, setVcpus] = useState('2')
  const [ram, setRam] = useState(String(entry.ram))
  const [disk, setDisk] = useState(String(Math.max(entry.disk, 1)))
  const [net, setNet] = useState('default')
  const [profile, setProfile] = useState<'normal' | 'examen'>('normal')
  const [envOn, setEnvOn] = useState(false)
  const [env, setEnv] = useState<EnvChoice>(ENV_DEFAULT)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const ui = hasUi(entry)
  const eff = effectiveEnv(env, ui)
  const nameBad = name ? nameError(name, names) : 'donne un nom'
  const eV = intError(vcpus, 1, 32, 'vcpu')
  const eR = intError(ram, 128, 262144, 'Mo')
  const eD = intError(disk, entry.disk, 4000, 'Go')
  const eN = nameError(net)
  const invalid = !!(nameBad || eV || eR || eD || eN)

  async function submit() {
    if (invalid) return
    setBusy(true); setErr('')
    try {
      await deployImage({ image: entry.id, name, vcpus: Number(vcpus), ram_mb: Number(ram), disk_gb: Number(disk), network: net, profile, env: envOn && !envIsEmpty(eff) ? eff : null })
      toast(`déploiement lancé : ${name}`)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <Modal title={`Déployer ${entry.nom} · ${entry.ver}`} sub={<>{FMT_LABEL[entry.fmt]} · {sizeText(entry.mb)}{entry.cached ? ' (en cache)' : ''} · mise en route ~{FMT_TIME[entry.fmt]}</>} onClose={onClose}
      footer={<>{err && <span className="vh-err">{err}</span>}<Btn onClick={onClose}>annuler</Btn><Btn solid disabled={busy || invalid} onClick={submit}>{busy ? '…' : 'déployer'}</Btn></>}>
      <div className="nc-scope">
        <div className="vh-field">
          <label htmlFor="dp-n">nom de la machine</label>
          <input id="dp-n" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. tp-linux-03" autoFocus aria-describedby="dp-n-e" />
          {name && nameBad && <span id="dp-n-e" className="vh-err" role="alert">{nameBad}</span>}
        </div>
        <div className="vh-row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <Field id="dp-v" label="vcpu" value={vcpus} onChange={setVcpus} error={eV} help="hw-vcpu" />
          <Field id="dp-r" label="mémoire (Mo)" value={ram} onChange={setRam} error={eR} help="hw-ram" />
          <Field id="dp-d" label="disque (Go)" value={disk} onChange={setDisk} error={eD} help="hw-disk" />
        </div>
        <div className="vh-row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <div className="vh-field" style={{ flex: 1 }}>
            <label htmlFor="dp-nt">réseau<Q k="hw-net" /></label>
            <input id="dp-nt" value={net} onChange={(e) => setNet(e.target.value)} aria-invalid={!!eN} aria-describedby={eN ? 'dp-nt-e' : undefined} />
            {eN && <span id="dp-nt-e" className="vh-err" role="alert">{eN}</span>}
          </div>
          <div className="vh-field" style={{ flex: 1 }}><label htmlFor="dp-p">profil<Q k="profile" /></label>
            <select id="dp-p" value={profile} onChange={(e) => setProfile(e.target.value as 'normal' | 'examen')}><option value="normal">normal</option><option value="examen">examen</option></select></div>
        </div>
        <div className="vh-env">
          <label className="vh-chk"><input type="checkbox" checked={envOn} onChange={(e) => setEnvOn(e.target.checked)} /> appliquer mon environnement<Q k="env" /></label>
          {envOn && (
            <>
              {(Object.keys(ENV_LABEL) as (keyof EnvChoice)[]).map((k) => {
                const off = needsUi(k) && !ui
                return (
                  <label key={k} className="vh-chk" style={off ? { opacity: 0.5 } : undefined}>
                    <input type="checkbox" disabled={off} checked={eff[k]} onChange={(e) => setEnv({ ...env, [k]: e.target.checked })} />
                    {ENV_LABEL[k]}{k === 'tools' ? ` : ${ENV_TOOLS.join(', ')}` : ''}{off ? ' (interface graphique requise)' : ''}
                  </label>
                )
              })}
              <p className="lite" style={{ margin: '6px 0 0' }}>{envIsEmpty(eff) ? 'Rien à appliquer.' : `Sera appliqué : ${envLabels(eff)} — ${envCommand(eff, entry.dist)}`}</p>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
