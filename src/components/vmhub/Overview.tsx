import { alertsOf, fmtGb, normHost, type Overview as Ov } from '../../lib/vmHub'
import type { Power } from '../../lib/vmHubApi'
import { sizeText, type LibEntry } from '../../lib/vmLibrary'
import { Btn, Chip } from '../ui'
import { Families } from './Families'
import { HostPanel } from './HostPanel'
import { Legend } from './Kind'
import { Q } from './Help'

export type OverviewActs = {
  open: (n: string) => void; console: (n: string) => void; power: (n: string, a: Power) => void
  fromTemplate: (n: string) => void; deploy: (libId: string) => void; goLibrary: () => void; importArchive: () => void
  newVm: () => void; seeVm: (n: string, tab?: string) => void
}

const rel = (ts: number) => {
  const s = Date.now() / 1000 - ts
  return s < 3600 ? `il y a ${Math.max(1, Math.floor(s / 60))} min` : s < 86400 ? `il y a ${Math.floor(s / 3600)} h` : `il y a ${Math.floor(s / 86400)} j`
}

function Quick({ list, onDeploy }: { list: LibEntry[]; onDeploy: (id: string) => void }) {
  return (
    <>
      {list.map((l) => (
        <div key={l.id} className="vh-libq">
          <span title={l.deployable ? undefined : l.reason}><b>{l.nom}</b> <span className="lite">{l.ver} · {sizeText(l.mb)}{l.cached ? ' · en cache' : ''}</span></span>
          <Btn sm disabled={!l.deployable} onClick={() => onDeploy(l.id)}>déployer</Btn>
        </div>
      ))}
    </>
  )
}

/** Accueil du hub : familles de machines, ajout, etat de l'hote, points a regarder. */
export function Overview({ ov, lib, busy, act }: { ov: Ov; lib: LibEntry[]; busy: Set<string>; act: OverviewActs }) {
  const vms = ov.vms
  const machines = vms.filter((v) => !v.meta.template)
  const tpls = vms.length - machines.length
  const run = machines.filter((v) => v.state === 'running').length
  const pau = machines.filter((v) => v.state === 'paused').length
  const host = normHost(ov.host)
  const alerts = alertsOf(vms, host)
  const lite = lib.filter((l) => l.fmt !== 'iso' && l.mb <= 700).sort((a, b) => a.mb - b.mb).slice(0, 3)
  const isos = lib.filter((l) => l.fmt === 'iso' && l.tags.includes('léger')).sort((a, b) => a.mb - b.mb).slice(0, 3)
  return (
    <div className="vh-grid">
      <div className="vh-col">
        <div className="vh-panel">
          <div className="vh-ph"><h2>familles de machines<Q k="kinds" /></h2><span className="lite">{machines.length} machines · {run} en marche · {pau} en pause · {tpls} modèle(s)</span></div>
          <Legend />
          <Families vms={vms} busy={busy} act={act} />
        </div>
        <div className="vh-panel">
          <div className="vh-ph"><h2>ajouter une machine</h2><span style={{ flex: 1 }} /><Btn sm onClick={act.goLibrary}>bibliothèque complète</Btn></div>
          <div className="vh-add">
            <div className="vh-box"><h3>depuis un modèle</h3><p className="lite" style={{ margin: '0 0 10px' }}>Clone lié en une seconde, presque sans espace, ou copie intégrale.</p><Btn sm solid disabled={!tpls} onClick={act.newVm}>choisir un modèle</Btn></div>
            <div className="vh-box"><h3>image prête à l'emploi<Q k="lib-fmt" /></h3><Quick list={lite} onDeploy={act.deploy} /></div>
            <div className="vh-box"><h3>iso légère<Q k="lib-fmt" /></h3><Quick list={isos} onDeploy={act.deploy} /></div>
            <div className="vh-box"><h3>depuis une archive</h3><p className="lite" style={{ margin: '0 0 10px' }}>Réimporter une VM exportée ({ov.archives.length} archive(s)).</p><Btn sm onClick={act.importArchive}>importer</Btn></div>
          </div>
        </div>
      </div>
      <div className="vh-col">
        <HostPanel vms={vms} host={host} onOpen={act.open} />
        <div className="vh-panel">
          <div className="vh-ph"><h2>à regarder</h2></div>
          {alerts.length === 0 && <p className="lite">rien à signaler.</p>}
          {alerts.map((a, i) => (
            <div key={i} className="vh-alert"><span>{a.text}</span>{a.vm && <Btn sm onClick={() => act.seeVm(a.vm as string, a.kind === 'nosnap' ? 'snapshots' : 'apercu')}>voir</Btn>}</div>
          ))}
        </div>
        <div className="vh-panel">
          <div className="vh-ph"><h2>archives récentes</h2></div>
          {ov.archives.slice(0, 3).map((a) => (
            <div key={a.name} className="vh-alert"><span className="mono" style={{ fontSize: 11.5, overflowWrap: 'anywhere' }}>{a.name}<br /><span className="lite">{fmtGb(a.size / 1e9)} · {rel(a.mtime)}</span></span></div>
          ))}
          {ov.archives.length === 0 && <p className="lite">aucune archive.</p>}
          {ov.stale && <Chip tone="warn">dernier état connu</Chip>}
        </div>
      </div>
    </div>
  )
}
