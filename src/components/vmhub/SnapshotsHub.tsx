import { useMemo, useState } from 'react'
import { apiGet } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { afterDelete, treeOf, type SnapIn } from '../../lib/vmSnapTree'
import { confirmTwice, nameError, useVmOp } from '../../lib/vmsConsole'
import { Btn, Card, Chip } from '../ui'
import { Q } from './Help'
import { NOW_NODE, SnapGraph } from './SnapGraph'

type Res = { success: boolean; error: string | null; snapshots: SnapIn[]; tree?: SnapIn[]; current?: string | null }

/** Snapshots d'une VM : arbre interactif (une couleur par branche) + panneau de details et d'actions. */
export function SnapshotsHub({ vm, running, busyVm, onStarted }: { vm: string; running: boolean; busyVm: boolean; onStarted: () => void }) {
  const list = usePoll<Res>(() => apiGet(`/vms-console/${encodeURIComponent(vm)}/snapshots`), 20000)
  const op = useVmOp(() => { onStarted(); setTimeout(list.refresh, 4000) })
  const [sel, setSel] = useState<string>('')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [live, setLive] = useState(false)
  const [fit, setFit] = useState(0)
  const nodes = useMemo(() => treeOf(list.data?.tree ?? list.data?.snapshots ?? []), [list.data])
  // le snapshot courant vient de l'API quand elle le donne ; sinon on prend le dernier cree et on le dit
  const apiHead = list.data?.current && nodes.some((n) => n.name === list.data?.current) ? list.data.current : null
  const head = apiHead ?? (nodes.length ? nodes[nodes.length - 1].name : null)
  const cur = sel && (sel === NOW_NODE || nodes.some((n) => n.name === sel)) ? sel : NOW_NODE
  const node = nodes.find((n) => n.name === cur)
  const kids = nodes.filter((n) => n.parent === cur)
  const base = `/vms-console/${encodeURIComponent(vm)}/snapshots`
  const bad = name ? (name === NOW_NODE ? 'ce nom est réservé' : nameError(name, nodes.map((n) => n.name))) : null
  const lock = busyVm || op.busy
  const del = node ? afterDelete(nodes, node.name) : null

  async function restore(s: string) {
    if (await confirmTwice('restaurer', `la vm ${vm} reviendra à l'état du snapshot ${s} (l'état actuel est perdu)`)) await op.run('POST', `${base}/${encodeURIComponent(s)}/restore`, 'snapshot_restore', vm)
  }
  async function remove(s: string) {
    if (await confirmTwice('supprimer le snapshot', `${s} de la vm ${vm}`)) await op.run('DELETE', `${base}/${encodeURIComponent(s)}`, 'snapshot_delete', vm)
  }
  async function create() {
    if (await op.run('POST', base, 'snapshot_create', vm, { name, description: desc, live: live && running })) { setName(''); setDesc('') }
  }

  return (
    <Card title="snapshots" lite={list.data ? `${nodes.length}` : undefined}>
      {list.data && !list.data.success && <Chip tone="crit">{list.data.error}</Chip>}
      <div className="vh-snap">
        <div style={{ minWidth: 0 }}>
          <div className="vh-sbar">
            <Q k="snap-what" />
            <span className="lite">chaque couleur est une branche · cercle doré : {apiHead ? 'vous êtes ici' : 'dernier snapshot créé'}</span>
            <span style={{ flex: 1 }} />
            <Btn sm onClick={() => setFit((n) => n + 1)}>ajuster</Btn>
          </div>
          <SnapGraph nodes={nodes} head={head} selected={cur} meta={{}} dirty={false} running={running} onSelect={setSel} resetKey={`${vm}-${nodes.length}-${fit}`} />
          <details className="vh-how">
            <summary>comment lire cet arbre ?</summary>
            <ul>
              <li>Chaque point est un snapshot, chaque couleur une branche. Le temps va de gauche à droite.</li>
              <li>Le point en pointillés « maintenant » est l'état en cours, pas encore sauvegardé.</li>
              <li>Revenir à un point puis faire un nouveau snapshot ouvre une branche : rien n'est écrasé.</li>
              <li>Glisser pour déplacer, molette pour zoomer, flèches pour naviguer, clic pour sélectionner.</li>
            </ul>
          </details>
        </div>
        <aside className="vh-spanel" aria-live="polite">
          {node ? (
            <>
              <h3>{node.name}</h3>
              <dl className="vh-kv">
                <dt>parent</dt><dd>{node.parent ?? 'racine'}</dd>
                <dt>enfants</dt><dd>{kids.length}</dd>
                <dt>profondeur</dt><dd>{node.depth}</dd>
              </dl>
              <div className="vh-row">
                <Btn sm solid disabled={lock} onClick={() => restore(node.name)}>restaurer</Btn><Q k="snap-ram" />
                <Btn sm danger disabled={lock || !!(del && 'error' in del)} onClick={() => remove(node.name)}>supprimer</Btn><Q k="snap-delete" />
              </div>
              <p className="lite" style={{ margin: 0 }}>
                {del && 'error' in del ? del.error : kids.length ? `Ses ${kids.length} enfant(s) seraient rattachés à « ${node.parent ?? 'la racine'} ».` : 'Aucun enfant : suppression sans conséquence sur les autres.'}
              </p>
              <p className="lite" style={{ margin: 0 }}>Pour ouvrir une branche : restaure ce point, puis crée un snapshot.<Q k="snap-branch" /></p>
            </>
          ) : (
            <>
              <h3>état actuel</h3>
              <p className="lite" style={{ margin: 0 }}>Le prochain snapshot sera rattaché à « {head ?? 'la racine'} ».{!apiHead && head ? ' (le plus récent : l\'API ne précise pas encore le snapshot courant)' : ''}<Q k="snap-now" /></p>
            </>
          )}
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
          <div className="vh-lab">nouveau snapshot</div>
          <input placeholder="nom du snapshot" value={name} onChange={(e) => setName(e.target.value)} aria-label="nom du snapshot" />
          <input placeholder="description (facultatif)" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="description" />
          <label className="vh-chk"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} disabled={!running} /> inclure la mémoire (à chaud)<Q k="snap-ram" /></label>
          <Btn sm solid disabled={!name || !!bad || lock} onClick={create}>snapshot maintenant</Btn>
          {bad && <p className="lite" style={{ color: 'var(--rose)', margin: 0 }}>{bad}</p>}
          {op.err && <p className="vm-err">{op.err}</p>}
        </aside>
      </div>
    </Card>
  )
}
