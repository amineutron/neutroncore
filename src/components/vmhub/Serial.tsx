import { useCallback, useEffect, useRef, useState } from 'react'
import { LINK_LABEL, type Link } from '../../lib/vmView'
import { serialSource, type SerialSession } from '../../lib/vmViewSources'
import type { Term } from '../../lib/vmTerminal'
import { Btn, Card, Chip } from '../ui'
import { Q } from './Help'

// Console serie d'une machine : xterm.js (bloc charge a la demande) sur un WebSocket binaire. Le terminal est cree
// a l'ouverture du sous-onglet ; la connexion, elle, se fait a la demande (jeton court). `{"resize":[cols,rows]}`
// part a l'ouverture puis a chaque redimensionnement (ResizeObserver + addon fit).

const IDLE: Link = { st: 'idle', detail: '' }
const HINT = 'la console série ne montre quelque chose que si l\'invité a une console sur ttyS0 (images cloud : oui ; une Fedora Workstation : non sans console=ttyS0). Entrée pour réveiller l\'invite.'

export function Serial({ vm, up }: { vm: string; up: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const term = useRef<Term | null>(null)
  const sess = useRef<SerialSession | null>(null)
  const [link, setLink] = useState<Link>(IDLE)
  const [full, setFull] = useState(false)
  const [ready, setReady] = useState(false)

  const disconnect = useCallback(() => { sess.current?.close(); sess.current = null }, [])

  // terminal monte une fois par machine ; demonte (et flux ferme) quand on quitte
  useEffect(() => {
    let alive = true
    const el = box.current
    if (!el) return
    import('../../lib/vmTerminal').then(({ createTerminal }) => {
      if (!alive || !el) return
      const t = createTerminal(el)
      term.current = t
      t.term.writeln(`\x1b[2m${vm} — console série. « se connecter » pour ouvrir le flux.\x1b[0m`)
      t.term.onData((d) => sess.current?.send(d))
      setReady(true)
    })
    const ro = new ResizeObserver(() => { term.current?.fit(); if (term.current && sess.current) sess.current.resize(term.current.term.cols, term.current.term.rows) })
    ro.observe(el)
    return () => { alive = false; ro.disconnect(); disconnect(); term.current?.dispose(); term.current = null; setReady(false) }
  }, [vm, disconnect])

  useEffect(() => { if (!up && sess.current) disconnect() }, [up, disconnect])
  useEffect(() => { setTimeout(() => term.current?.fit(), 60) }, [full])
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !box.current?.contains(document.activeElement)) setFull(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  async function connect() {
    const t = term.current
    if (!t || sess.current) return
    setLink({ st: 'connecting', detail: '' })
    try {
      const open = await serialSource()
      sess.current = await open(vm, {
        onOpen: () => { setLink({ st: 'connected', detail: '' }); t.fit(); sess.current?.resize(t.term.cols, t.term.rows); t.term.focus() },
        onData: (bytes) => t.term.write(bytes),
        onClose: (reason, clean) => { sess.current = null; setLink({ st: 'closed', detail: reason }); t.term.writeln(`\r\n\x1b[2m[${clean ? 'fermé' : 'coupé'} : ${reason}]\x1b[0m`) },
      })
    } catch (e) { sess.current = null; setLink({ st: 'closed', detail: e instanceof Error ? e.message : String(e) }) }
  }

  const live = link.st === 'connected' || link.st === 'connecting'
  const tone = link.st === 'connected' ? 'ok' : link.st === 'connecting' ? 'warn' : 'rose'
  return (
    <Card title="terminal série">
      <div className={`vh-view vh-serial${full ? ' vh-plein' : ''}`} data-full={full || undefined}>
        <div className="vh-viewbar">
          <Chip tone={tone}><span className="vh-link-dot" />{LINK_LABEL[link.st]}</Chip>
          {link.detail && <span className="lite vh-link-why">{link.detail}</span>}
          <span style={{ flex: 1 }} />
          {!live && <Btn sm solid disabled={!up || !ready} onClick={connect}>{link.st === 'closed' ? 'se reconnecter' : 'se connecter'}</Btn>}
          {live && <button type="button" className="btn sm vh-coarse-only" onClick={() => term.current?.term.focus()}>clavier</button>}
          <Btn sm onClick={() => setFull((f) => !f)}>{full ? 'quitter le plein écran' : 'plein écran'}</Btn>
          {live && <Btn sm danger onClick={disconnect}>se déconnecter</Btn>}
          <Q k="serial" /><Q k="fullscreen-kbd" />
        </div>
        <div ref={box} className="vh-viewport vh-term" aria-label={`console série de ${vm}`} />
        {!up && <p className="lite vh-view-hint">la machine doit être démarrée.</p>}
        <p className="lite vh-view-hint">{HINT}</p>
      </div>
    </Card>
  )
}
