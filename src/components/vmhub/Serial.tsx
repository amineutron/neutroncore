import { useCallback, useEffect, useRef, useState } from 'react'
import { useFullscreenOverlay } from '../../lib/useFullscreenOverlay'
import { LINK_LABEL, type Link } from '../../lib/vmView'
import { AbortedError, serialSource, type SerialSession } from '../../lib/vmViewSources'
import type { Term } from '../../lib/vmTerminal'
import { Btn, Card, Chip } from '../ui'
import { Q } from './Help'

// Console serie d'une machine : xterm.js (bloc charge a la demande) sur un WebSocket binaire. Le terminal est cree
// a l'ouverture du sous-onglet ; la connexion, elle, se fait a la demande (jeton court). `{"resize":[cols,rows]}`
// part a l'ouverture puis a chaque redimensionnement (ResizeObserver + addon fit). Quitter pendant l'ouverture annule
// (AbortSignal + generation) : rien ne reste ouvert ; aucune ecriture sur un terminal dispose.

const IDLE: Link = { st: 'idle', detail: '' }
const HINT = 'la console série ne montre quelque chose que si l\'invité a une console sur ttyS0 (images cloud : oui ; une Fedora Workstation : non sans console=ttyS0). Entrée pour réveiller l\'invite.'

export function Serial({ vm, up }: { vm: string; up: boolean }) {
  const stage = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const term = useRef<Term | null>(null)
  const sess = useRef<SerialSession | null>(null)
  const gen = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const [link, setLink] = useState<Link>(IDLE)
  const [full, setFull] = useState(false)
  const [ready, setReady] = useState(false)
  const [loadErr, setLoadErr] = useState('')

  const disconnect = useCallback(() => {
    if (abort.current) { gen.current++; abort.current.abort(); abort.current = null; setLink(IDLE) }   // ouverture en cours : annulee
    const s = sess.current
    sess.current = null
    s?.close()   // sa fermeture repasse par onClose (« déconnecté »), la generation n'a pas change
  }, [])

  // terminal monte une fois par machine ; demonte (et flux ferme) quand on quitte
  useEffect(() => {
    let alive = true
    const el = box.current
    if (!el) return
    setLoadErr('')
    import('../../lib/vmTerminal').then(({ createTerminal }) => {
      if (!alive) return
      const t = createTerminal(el)
      term.current = t
      t.term.writeln(`\x1b[2m${vm} — console série. « se connecter » pour ouvrir le flux.\x1b[0m`)
      t.term.onData((d) => sess.current?.send(d))
      setReady(true)
    }).catch((e: unknown) => { if (alive) setLoadErr(`terminal introuvable : ${e instanceof Error ? e.message : String(e)}`) })
    const ro = new ResizeObserver(() => { term.current?.fit(); if (term.current && sess.current) sess.current.resize(term.current.term.cols, term.current.term.rows) })
    ro.observe(el)
    return () => { alive = false; ro.disconnect(); disconnect(); term.current?.dispose(); term.current = null; setReady(false) }
  }, [vm, disconnect])

  useEffect(() => { if (!up) { setFull(false); if (sess.current || abort.current) disconnect() } }, [up, disconnect])
  useEffect(() => { const id = setTimeout(() => term.current?.fit(), 60); return () => clearTimeout(id) }, [full])
  const leaveFull = useCallback(() => setFull(false), [])
  useFullscreenOverlay(full, stage, leaveFull)

  async function connect() {
    const t = term.current
    if (!t || sess.current || abort.current) return
    const g = ++gen.current
    const ac = new AbortController()
    abort.current = ac
    setLink({ st: 'connecting', detail: '' })
    const alive = () => g === gen.current && term.current === t   // meme connexion, terminal pas dispose
    let mine: SerialSession | null = null
    try {
      const open = await serialSource()
      if (!alive()) return
      const s = await open(vm, {
        onOpen: () => { if (!alive()) return; setLink({ st: 'connected', detail: '' }); t.fit(); mine?.resize(t.term.cols, t.term.rows); t.term.focus() },
        onData: (bytes) => { if (alive()) t.term.write(bytes) },
        onClose: (reason, clean) => {
          if (sess.current === mine) sess.current = null
          if (!alive()) return
          setLink({ st: 'closed', detail: reason }); t.term.writeln(`\r\n\x1b[2m[${clean ? 'fermé' : 'coupé'} : ${reason}]\x1b[0m`)
        },
      }, ac.signal)
      mine = s
      if (!alive()) { s.close(); return }   // on a quitte pendant l'ouverture : fermeture immediate
      sess.current = s
    } catch (e) {
      if (!alive() || e instanceof AbortedError) return
      setLink({ st: 'closed', detail: e instanceof Error ? e.message : String(e) })
    } finally { if (abort.current === ac) abort.current = null }
  }

  const live = link.st === 'connected' || link.st === 'connecting'
  const tone = link.st === 'connected' ? 'ok' : link.st === 'connecting' ? 'warn' : 'rose'
  return (
    <Card title="terminal série">
      <div ref={stage} className={`vh-view vh-serial${full ? ' vh-plein' : ''}`} data-full={full || undefined} role={full ? 'dialog' : undefined} aria-modal={full || undefined} aria-label={full ? `console série de ${vm} en plein écran` : undefined}>
        <div className="vh-viewbar">
          <Chip tone={tone}><span className="vh-link-dot" />{LINK_LABEL[link.st]}</Chip>
          {link.detail && <span className="lite vh-link-why">{link.detail}</span>}
          <span style={{ flex: 1 }} />
          {!live && <Btn sm solid disabled={!up || !ready} onClick={connect}>{link.st === 'closed' ? 'se reconnecter' : 'se connecter'}</Btn>}
          {live && <button type="button" className="btn sm vh-coarse-only" onClick={() => term.current?.term.focus()}>clavier</button>}
          <Btn sm onClick={() => setFull((f) => !f)}>{full ? 'quitter le plein écran' : 'plein écran'}</Btn>
          {live && <Btn sm danger onClick={disconnect}>{link.st === 'connecting' ? 'annuler' : 'se déconnecter'}</Btn>}
          <Q k="serial" /><Q k="fullscreen-kbd" />
        </div>
        <div ref={box} className="vh-viewport vh-term" aria-label={`console série de ${vm}`} />
        {loadErr && <p className="vm-err vh-view-err">{loadErr} <button type="button" className="btn sm solid" onClick={() => window.location.reload()}>recharger</button></p>}
        {!up && <p className="lite vh-view-hint">la machine doit être démarrée.</p>}
        <p className="lite vh-view-hint">{HINT}</p>
      </div>
    </Card>
  )
}
