import { useState } from 'react'
import { toast } from '../../lib/dialog'
import { dependents, fmtGb, type HubVm } from '../../lib/vmHub'
import { cloneVm } from '../../lib/vmHubApi'
import { nameError } from '../../lib/vmsConsole'
import { Btn } from '../ui'
import { Modal, Q } from './Help'
import { KindPill } from './Kind'

/** Creer une machine depuis un modele : clone lie (leger) ou copie integrale. */
export function CloneDialog({ source, names, onClose, onDone }: { source: HubVm; names: string[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [linked, setLinked] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const bad = name ? nameError(name, names) : 'donne un nom'
  async function go() {
    if (bad) { setErr(bad); return }
    setBusy(true); setErr('')
    try {
      await cloneVm(source.name, { new_name: name, linked, network: 'default', autostart: false })
      toast(`${linked ? 'clone lié' : 'copie intégrale'} lancé : ${name}`)
      onDone()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return (
    <Modal title={`Créer une machine depuis ${source.name}`} sub={<>Deux façons, aux conséquences très différentes.<Q k="clone-type" /></>} onClose={onClose}
      footer={<>{err && <span className="vh-err">{err}</span>}<Btn onClick={onClose}>annuler</Btn><Btn solid disabled={busy || !!bad} onClick={go}>{busy ? '…' : 'créer'}</Btn></>}>
      <div className="nc-scope">
        <div className="vh-field"><label htmlFor="cl-n">nom de la nouvelle machine</label><input id="cl-n" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. tp-linux-03" autoFocus aria-describedby="cl-e" />{name && bad && <span id="cl-e" className="vh-err" role="alert">{bad}</span>}</div>
        <div className="vh-radios">
          <label><input type="radio" name="cl" checked={linked} onChange={() => setLinked(true)} /><span><KindPill kind="cow" /><small>instantané, ~0,2 Go, dépend de {source.name} (qu'on ne pourra plus supprimer ni modifier)</small></span></label>
          <label><input type="radio" name="cl" checked={!linked} onChange={() => setLinked(false)} /><span><KindPill kind="copy" /><small>indépendante, prend {fmtGb(source.disk_used_gb)}, copie en quelques dizaines de secondes</small></span></label>
        </div>
      </div>
    </Modal>
  )
}

/** Onglet « modeles » : cartes des modeles, avec ce qui en depend. */
export function Templates({ vms, just, onCreate, onOpen }: { vms: HubVm[]; just: string | null; onCreate: (v: HubVm) => void; onOpen: (n: string) => void }) {
  const tpls = vms.filter((v) => v.meta.template)
  return (
    <div className="vh-enter">
      <div className="vh-ph"><h2>modèles<Q k="tpl" /></h2><span className="lite">Un modèle est en lecture seule et sert de base à des clones liés (rapides, presque sans espace) ou complets.</span></div>
      {tpls.length === 0 && <div className="vh-empty">aucun modèle. Sur une machine éteinte, utilise « passer en modèle ».</div>}
      <div className="vh-cards">
        {tpls.map((v) => {
          const dep = dependents(vms, v.name)
          return (
            <div key={v.name} className={`vh-box${v.name === just ? ' arrive' : ''}`}>
              <div className="vh-row" style={{ justifyContent: 'space-between' }}><b className="mono">{v.name}</b><KindPill kind="tpl" /></div>
              <dl className="vh-kv" style={{ margin: '10px 0' }}>
                <dt>ressources</dt><dd>{v.vcpus ?? '?'} vcpu · {v.ram_mb ?? '?'} Mo · {v.disk_total_gb ?? '?'} Go</dd>
                <dt>disque utilisé</dt><dd>{fmtGb(v.disk_used_gb)}</dd><dt>clones liés</dt><dd>{dep.length}</dd>
              </dl>
              <div className="vh-row"><Btn sm solid onClick={() => onCreate(v)}>+ créer une vm</Btn><Btn sm onClick={() => onOpen(v.name)}>détails</Btn></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
