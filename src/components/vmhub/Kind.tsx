import { KIND_LABEL, REL_LABEL, chainOf, kindOf, type HubVm, type Kind } from '../../lib/vmHub'
import { Q } from './Help'

export function KindPill({ kind, mini }: { kind: Kind; mini?: boolean }) {
  return <span className={`vh-kind k-${kind}${mini ? ' mini' : ''}`} title={KIND_LABEL[kind]}><i />{!mini && KIND_LABEL[kind]}</span>
}

export function Legend({ kinds = ['tpl', 'cow', 'copy', 'own'] }: { kinds?: Kind[] }) {
  return <div className="vh-legend">{kinds.map((k) => <KindPill key={k} kind={k} />)}<Q k="kinds" /></div>
}

/** Chaine de provenance, de la plus ancienne source a la machine (trait plein = clone lie, pointille = copie). */
export function Provenance({ vm, vms, onOpen }: { vm: HubVm; vms: HubVm[]; onOpen: (name: string) => void }) {
  const chain = chainOf(vm, vms)
  if (chain.length === 1) {
    return (
      <div className="vh-prov">
        <span className={`vh-pn me k-${kindOf(vm)}`} style={{ ['--i' as string]: 0 }}><i />{vm.name}</span>
        <span className="lite" style={{ marginLeft: 10 }}>aucun parent : installée de zéro</span>
      </div>
    )
  }
  return (
    <div className="vh-prov">
      {chain.map((n, i) => (
        <span key={`${n.id}-${i}`} style={{ display: 'contents' }}>
          {n.self
            ? <span className={`vh-pn me k-${n.kind ?? 'own'}`} style={{ ['--i' as string]: i * 2 }}><i />{n.id}</span>
            : n.exists && n.kind
              ? <button className={`vh-pn k-${n.kind}`} style={{ ['--i' as string]: i * 2 }} onClick={() => onOpen(n.id)}><i />{n.id}</button>
              : <span className={`vh-pn ${n.ext ? 'ext' : 'gone'}`} style={{ ['--i' as string]: i * 2 }} title={n.ext ? 'source externe' : 'machine supprimée depuis'}>{n.id}{n.ext ? '' : ' (supprimée)'}</span>}
          {n.rel && (
            <span className={`vh-pa ${n.rel !== 'cow' ? 'dash' : ''} ${n.rel}`} style={{ ['--i' as string]: i * 2 + 1 }}>
              <em style={{ fontStyle: 'normal' }}>{REL_LABEL[n.rel]}</em><span className="ln"><s /><b /></span>
            </span>
          )}
        </span>
      ))}
    </div>
  )
}
