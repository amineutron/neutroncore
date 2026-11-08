import { useCallback, useEffect, useRef, useState, type CompositionEvent, type FormEvent, type KeyboardEvent } from 'react'
import { confirmDialog, toast } from '../../lib/dialog'
import { usePoll } from '../../lib/poll'
import { useFullscreenOverlay } from '../../lib/useFullscreenOverlay'
import { addVncDisplay, fetchView } from '../../lib/vmHubApi'
import { keydownToPresses, textKeysyms } from '../../lib/vmKeys'
import { LINK_LABEL, viewVerdict, type Link, type ViewRes } from '../../lib/vmView'
import { AbortedError, screenSource, type ScreenSession } from '../../lib/vmViewSources'
import { Btn, Card, Chip } from '../ui'
import { Q } from './Help'

// Onglet « écran » : ce que la machine expose (GET /vms-console/{vm}/view), puis un client VNC dans la page.
// On ne se connecte jamais tout seul : le jeton est court et la vue est exclusive. Un seul canvas monte a la fois,
// demonte proprement (disconnect) quand on quitte l'onglet ou la machine, y compris si on quitte PENDANT l'ouverture
// (compteur de generation + AbortSignal : une session qui arrive trop tard est fermee aussitot, jamais laissee sur un
// noeud detache — la vue VNC est exclusive, un flux oublie bloquerait la machine 10 min).

const IDLE: Link = { st: 'idle', detail: '' }

export function Screen({ vm, state, onApplied }: { vm: string; state: string; onApplied: () => void }) {
  const view = usePoll<ViewRes>(() => fetchView(vm), 10000)
  const verdict = viewVerdict(view.error && !view.data ? { success: false, state, display: 'vnc', vnc: null, serial: false, reason: view.error } : view.data, state)
  const [link, setLink] = useState<Link>(IDLE)
  const [name, setName] = useState('')
  const [full, setFull] = useState(false)
  const [busy, setBusy] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const target = useRef<HTMLDivElement>(null)
  const kbd = useRef<HTMLTextAreaElement>(null)
  const sess = useRef<ScreenSession | null>(null)
  const gen = useRef(0)                       // numero de la connexion en cours : tout ce qui arrive d'une autre est jete
  const abort = useRef<AbortController | null>(null)

  const disconnect = useCallback(() => {
    if (abort.current) { gen.current++; abort.current.abort(); abort.current = null; setLink(IDLE) }   // ouverture en cours : annulee
    const s = sess.current
    sess.current = null
    s?.disconnect()   // sa fermeture repasse par onDisconnect (« déconnecté »), la generation n'a pas change
  }, [])
  useEffect(() => () => disconnect(), [disconnect, vm])   // changement de machine ou sortie de l'onglet : canvas demonte

  // la machine s'eteint ou perd son affichage : le flux tombe tout seul, mais on ferme aussi de notre cote
  useEffect(() => { if (verdict.kind !== 'vnc') { setFull(false); if (sess.current || abort.current) disconnect() } }, [verdict.kind, disconnect])
  const leaveFull = useCallback(() => setFull(false), [])
  useFullscreenOverlay(full, stage, leaveFull)

  async function connect() {
    if (!target.current || sess.current || abort.current) return
    const g = ++gen.current
    const ac = new AbortController()
    abort.current = ac
    setLink({ st: 'connecting', detail: '' }); setName('')
    let mine: ScreenSession | null = null
    try {
      const open = await screenSource()
      if (g !== gen.current || !target.current) return
      const s = await open(target.current, vm, {
        onConnect: () => { if (g === gen.current) setLink({ st: 'connected', detail: '' }) },
        onDisconnect: (reason, clean) => {
          if (sess.current === mine) sess.current = null   // seulement sa propre session (B3)
          if (g === gen.current) setLink({ st: 'closed', detail: clean ? reason : reason || 'connexion perdue' })
        },
        onSecurityFailure: (reason) => { if (g === gen.current) setLink({ st: 'closed', detail: reason }) },
        onName: (n) => { if (g === gen.current) setName(n) },
      }, ac.signal)
      mine = s
      if (g !== gen.current) { s.disconnect(); return }   // on a quitte pendant l'ouverture : fermeture immediate
      sess.current = s
    } catch (e) {
      if (g !== gen.current || e instanceof AbortedError) return
      setLink({ st: 'closed', detail: e instanceof Error ? e.message : String(e) })
    } finally { if (abort.current === ac) abort.current = null }
  }

  async function toVnc() {
    const add = verdict.action === 'add-vnc'
    const ok = await confirmDialog({ title: `${verdict.actionLabel} sur ${vm} ?`, body: add ? 'Ajoute une carte graphique virtuelle avec une console VNC. Effectif au prochain démarrage.' : 'Remplace la console SPICE par une console VNC ; les conforts SPICE (presse-papiers partagé, redimensionnement automatique) ne seront plus là. Effectif au prochain démarrage.', ok: verdict.actionLabel })
    if (!ok) return
    setBusy(true)
    try {
      await addVncDisplay(vm)
      toast(`${vm} : affichage VNC ${add ? 'ajouté' : 'choisi'} — démarre la machine pour la voir`)
      onApplied(); setTimeout(view.refresh, 1500)
    } catch (e) { toast(e instanceof Error ? e.message : String(e), 'crit') } finally { setBusy(false) }
  }

  async function paste() {
    try {
      const text = navigator.clipboard?.readText ? await navigator.clipboard.readText() : ''
      if (!text) { toast('presse-papiers vide ou inaccessible (autorise la lecture dans le navigateur)', 'crit'); return }
      sess.current?.paste(text); toast(`${text.length} caractères envoyés à la machine`)
    } catch { toast('lecture du presse-papiers refusée par le navigateur', 'crit') }
  }

  // Champ cache du clavier tactile : les touches speciales et raccourcis partent au keydown, le texte (y compris une
  // composition terminee) au fil de la saisie, puis le champ est vide. Ce qu'il recoit va a la machine, pas a la page.
  function onKbdKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    const presses = keydownToPresses(e.nativeEvent)
    if (!presses) return
    e.preventDefault()
    for (const p of presses) sess.current?.key(p.keysym, p.code, true)
    for (const p of [...presses].reverse()) sess.current?.key(p.keysym, p.code, false)
  }
  function flushKbd(text: string) {
    for (const ks of textKeysyms(text)) sess.current?.key(ks, null)
    if (kbd.current) kbd.current.value = ''
  }
  const onKbdInput = (e: FormEvent<HTMLTextAreaElement>) => { if (!(e.nativeEvent as InputEvent).isComposing) flushKbd(e.currentTarget.value) }
  const onKbdCompose = (e: CompositionEvent<HTMLTextAreaElement>) => flushKbd(e.data)

  const live = link.st === 'connected' || link.st === 'connecting'
  const tone = link.st === 'connected' ? 'ok' : link.st === 'connecting' ? 'warn' : 'rose'
  return (
    <Card title="écran" lite={verdict.kind === 'vnc' ? (view.data?.vnc ? `vnc ${view.data.vnc.host}:${view.data.vnc.port}` : '') : ''}>
      <p className="vh-lab" style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4 }}>{verdict.title}<Q k="screen-vnc" />{verdict.kind === 'spice' && <Q k="hw-display" />}</p>
      {verdict.kind !== 'vnc' && (
        <div className="vh-screen-state" data-kind={verdict.kind}>
          <p style={{ margin: 0 }}>{verdict.text}</p>
          {verdict.action && (
            <div className="vh-row" style={{ marginTop: 10 }}>
              <Btn sm solid disabled={!verdict.actionOk || busy} onClick={toVnc}>{busy ? 'application…' : verdict.actionLabel}</Btn>
              {!verdict.actionOk && <span className="lite vh-screen-why">{verdict.actionReason}</span>}
            </div>
          )}
        </div>
      )}
      {verdict.kind === 'vnc' && (
        <div ref={stage} className={`vh-view${full ? ' vh-plein' : ''}`} data-full={full || undefined} role={full ? 'dialog' : undefined} aria-modal={full || undefined} aria-label={full ? `écran de ${vm} en plein écran` : undefined}>
          <div className="vh-viewbar">
            <Chip tone={tone}><span className="vh-link-dot" />{LINK_LABEL[link.st]}{name && link.st === 'connected' ? ` · ${name}` : ''}</Chip>
            {link.detail && <span className="lite vh-link-why">{link.detail}</span>}
            <span style={{ flex: 1 }} />
            {!live && <Btn sm solid onClick={connect}>{link.st === 'closed' ? 'se reconnecter' : 'se connecter'}</Btn>}
            {live && <>
              <Btn sm onClick={() => sess.current?.sendCtrlAltDel()}>Ctrl+Alt+Suppr</Btn>
              <Btn sm onClick={paste}>coller</Btn>
              <button type="button" className="btn sm vh-coarse-only" onClick={() => kbd.current?.focus()}>clavier</button>
            </>}
            <Btn sm onClick={() => { setFull((f) => !f); setTimeout(() => sess.current?.setScale(true), 50) }}>{full ? 'quitter le plein écran' : 'plein écran'}</Btn>
            {live && <Btn sm danger onClick={disconnect}>{link.st === 'connecting' ? 'annuler' : 'se déconnecter'}</Btn>}
            <Q k="fullscreen-kbd" /><Q k="cad" />
          </div>
          <div ref={target} className="vh-viewport" aria-label={`écran de ${vm}`} />
          <textarea ref={kbd} className="vh-kbd" aria-label="clavier pour la machine" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
            onKeyDown={onKbdKey} onInput={onKbdInput} onCompositionEnd={onKbdCompose} />
          {!live && <p className="lite vh-view-hint">{verdict.text}</p>}
        </div>
      )}
    </Card>
  )
}
