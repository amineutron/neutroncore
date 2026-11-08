import { useState } from 'react'
import { toast } from '../../lib/dialog'
import { kindOf, type HubVm } from '../../lib/vmHub'
import { setTemplate } from '../../lib/vmHubApi'
import { Btn } from '../ui'
import { Modal, Q } from './Help'
import { KindPill } from './Kind'

/** Passage en modele : explique ou la machine va, pourquoi elle quitte « machines », ce qu'elle devient. */
export function TemplateDialog({ vm, onClose, onDone }: { vm: HubVm; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const n = vm.snapshot_count ?? 0
  async function go() {
    setBusy(true); setErr('')
    try {
      await setTemplate(vm.name, true)
      toast(`${vm.name} est maintenant un modèle : elle a quitté « machines » et se trouve dans « modèles »`)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }
  return (
    <Modal title={`Passer ${vm.name} en modèle ?`} sub={<>Elle change de catégorie. Voici ce qui se passe.<Q k="tpl" /></>} onClose={onClose}
      footer={<>{err && <span className="vh-err">{err}</span>}<Btn onClick={onClose}>annuler</Btn><Btn solid disabled={busy} onClick={go}>{busy ? '…' : 'passer en modèle'}</Btn></>}>
      <div className="vh-flow" aria-hidden>
        <div className="col"><span className="vh-lab">machines</span><KindPill kind={kindOf(vm)} /></div>
        <div className="col tgt"><span className="vh-lab">modèles</span><span className="slot">{vm.name}</span></div>
        <span className="chip"><KindPill kind="tpl" /></span>
      </div>
      <ul className="vh-why">
        <li><b>Où elle va.</b> Elle quitte la liste « machines » et apparaît dans l'onglet « modèles » (et en tête de sa famille sur l'accueil), en violet.</li>
        <li><b>Pourquoi elle disparaît de « machines ».</b> Un modèle ne se démarre pas : il sert uniquement de base pour fabriquer d'autres machines. Si elle continuait de tourner, son disque changerait sous les clones liés qui s'y appuient.</li>
        <li><b>À quoi elle sert ensuite.</b> Depuis « modèles », « créer une vm » en fait un clone lié (instantané, ~0,2 Go) ou une copie intégrale. {n > 0 ? `Ses ${n} snapshot(s) et sa configuration sont conservés.` : 'Sa configuration est conservée.'}</li>
        <li><b>Retour possible.</b> Tant qu'aucun clone lié n'en dépend, elle peut redevenir une machine normale.</li>
      </ul>
    </Modal>
  )
}
