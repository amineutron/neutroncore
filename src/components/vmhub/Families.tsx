import { buildFamilies, byName, fmtGb, kindOf, type FamNode, type HubVm } from '../../lib/vmHub'
import type { Power } from '../../lib/vmHubApi'
import { Btn } from '../ui'
import { KindPill } from './Kind'

type Act = { open: (n: string) => void; console: (n: string) => void; power: (n: string, a: Power) => void; fromTemplate: (n: string) => void }
/** Boutons d'alimentation d'une rangee de famille : courts, selon l'etat (le detail de la machine offre le reste). */
const POWER_BTNS: Record<string, { a: Power; label: string }[]> = {
  stopped: [{ a: 'start', label: 'démarrer' }], running: [{ a: 'pause', label: 'pause' }, { a: 'stop', label: 'arrêter' }], paused: [{ a: 'resume', label: 'reprendre' }],
}

const STATE_LABEL: Record<string, string> = { running: 'en marche', stopped: 'éteinte', paused: 'en pause', starting: 'transition…', unknown: 'inconnu' }

function Node({ n, all, act, i, busy }: { n: FamNode; all: Map<string, HubVm>; act: Act; i: number; busy: Set<string> }) {
  const v = n.vm
  const k = kindOf(v)
  const base = v.meta.base ? all.get(v.meta.base) : undefined
  const sub = k === 'cow'
    ? <><b>+{fmtGb(v.disk_used_gb)}</b> de différences sur {v.meta.base} ({fmtGb(base?.disk_used_gb)})</>
    : <>{fmtGb(v.disk_used_gb)} sur {v.disk_total_gb ?? '?'} Go</>
  const locked = busy.has(v.name) || v.state === 'starting'
  const group = (cls: 'k-cow' | 'k-copy', cap: string, list: FamNode[]) => list.length > 0 && (
    <div className={`vh-kids ${cls}`}>
      <div className="vh-cap">{cap}</div>
      {list.map((c) => <Node key={c.vm.name} n={c} all={all} act={act} i={i} busy={busy} />)}
    </div>
  )
  return (
    <div className="vh-fam" style={{ ['--i' as string]: i }}>
      <div className={`vh-node${v.meta.template ? ' tpl' : ''}`}>
        {v.meta.template
          ? <span style={{ color: 'var(--vh-tpl)' }} aria-hidden>◆</span>
          : <span className={`vm-dot ${v.state === 'running' ? 'ok' : v.state === 'stopped' ? 'off' : 'busy'}`} title={STATE_LABEL[v.state]} />}
        <div>
          <button className="nm" onClick={() => act.open(v.name)}>{v.name}</button>
          <div className="sub">{v.ram_mb ?? '?'} Mo · {v.vcpus ?? '?'} vcpu · {sub}</div>
        </div>
        <div className="fr">
          <KindPill kind={k} />
          {v.meta.profile === 'examen' && !v.meta.template && <span className="vh-tag" style={{ color: 'var(--rose)' }}>examen</span>}
          {v.meta.template
            ? <Btn sm onClick={() => act.fromTemplate(v.name)}>+ créer</Btn>
            : <>
              {(POWER_BTNS[v.state] ?? []).map((p) => <Btn key={p.a} sm disabled={locked} onClick={() => act.power(v.name, p.a)}>{p.label}</Btn>)}
              <Btn sm onClick={() => act.console(v.name)}>console</Btn>
            </>}
        </div>
      </div>
      {group('k-cow', `clones liés : ils partagent le disque de ${v.name}`, n.cow)}
      {group('k-copy', `copies intégrales : indépendantes de ${v.name}`, n.copies)}
    </div>
  )
}

/** Arbre des familles : modeles et leurs machines, puis machines seules. */
export function Families({ vms, act, busy }: { vms: HubVm[]; act: Act; busy: Set<string> }) {
  const f = buildFamilies(vms)
  const all = byName(vms)
  let i = 0
  return (
    <>
      {f.templates.length > 0 && (
        <>
          <div className="vh-cap" style={{ marginTop: 12 }}>modèles et ce qui en vient</div>
          {f.templates.map((n) => <Node key={n.vm.name} n={n} all={all} act={act} i={i++} busy={busy} />)}
        </>
      )}
      {f.loose.length > 0 && (
        <>
          <div className="vh-cap" style={{ marginTop: 14 }}>machines seules</div>
          {f.loose.map((n) => <Node key={n.vm.name} n={n} all={all} act={act} i={i++} busy={busy} />)}
        </>
      )}
      {vms.length === 0 && <div className="vh-empty">aucune machine reçue pour l'instant.</div>}
    </>
  )
}
