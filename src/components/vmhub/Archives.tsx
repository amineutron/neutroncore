import { useState } from 'react'
import { toast } from '../../lib/dialog'
import type { Archive } from '../../lib/vmHub'
import { importArchive } from '../../lib/vmHubApi'
import { fmtSize, nameError } from '../../lib/vmsConsole'
import { Btn } from '../ui'
import { Modal, Q } from './Help'

const when = (ts: number) => new Date(ts * 1000).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const modeOf = (name: string) => (name.endsWith('-exam.tar.gz') ? 'examen (exam)' : name.endsWith('-classic.tar.gz') ? 'normal (classic)' : 'custom')

function ImportDialog({ archive, names, onClose, onDone }: { archive: Archive; names: string[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(archive.name.replace(/-export-.*$/, '') + '-import')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const bad = nameError(name, names)
  async function go() {
    if (bad) { setErr(bad); return }
    setBusy(true); setErr('')
    try {
      await importArchive(archive.name, name)
      toast(`import lancé : ${name}`)
      onDone()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return (
    <Modal title="Importer une archive" sub={<>Nouvel identifiant et nouvelle adresse MAC générés.<Q k="import" /></>} onClose={onClose}
      footer={<>{err && <span className="vh-err">{err}</span>}<Btn onClick={onClose}>annuler</Btn><Btn solid disabled={busy || !!bad} onClick={go}>{busy ? '…' : 'importer'}</Btn></>}>
      <div className="nc-scope">
        <p className="mono" style={{ fontSize: 11.5, overflowWrap: 'anywhere' }}>{archive.name}</p>
        <div className="vh-field"><label htmlFor="im-n">nom de la nouvelle machine</label><input id="im-n" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-describedby="im-e" />{bad && <span id="im-e" className="vh-err" role="alert">{bad}</span>}</div>
      </div>
    </Modal>
  )
}

/** Archives exportees : mode, taille, date, import. */
export function Archives({ archives, names, onImported }: { archives: Archive[]; names: string[]; onImported: () => void }) {
  const [pick, setPick] = useState<Archive | null>(null)
  return (
    <div className="vh-enter">
      <div className="vh-ph"><h2>archives exportées<Q k="export-modes" /></h2></div>
      {archives.length === 0 && <div className="vh-empty">aucune archive dans le dossier d'exports.</div>}
      {archives.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table><thead><tr><th>archive</th><th>mode</th><th>taille</th><th>date</th><th /></tr></thead>
            <tbody>{archives.map((a) => (
              <tr key={a.name}><td className="mono" style={{ overflowWrap: 'anywhere' }}>{a.name}</td><td>{modeOf(a.name)}</td><td>{fmtSize(a.size)}</td><td>{when(a.mtime)}</td>
                <td><Btn sm onClick={() => setPick(a)}>importer</Btn></td></tr>
            ))}</tbody></table>
        </div>
      )}
      {pick && <ImportDialog archive={pick} names={names} onClose={() => setPick(null)} onDone={() => { setPick(null); onImported() }} />}
    </div>
  )
}
