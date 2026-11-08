import { useCallback, useEffect, useRef, useState } from 'react'
import { confirmDialog, toast } from '../../lib/dialog'
import { usePoll } from '../../lib/poll'
import { addVncDisplay, fetchView } from '../../lib/vmHubApi'
import { LINK_LABEL, viewVerdict, type Link, type ViewRes } from '../../lib/vmView'
import { screenSource, type ScreenSession } from '../../lib/vmViewSources'
import { Btn, Card, Chip } from '../ui'
import { Q } from './Help'

// Onglet « écran » : ce que la machine expose (GET /vms-console/{vm}/view), puis un client VNC dans la page.
// On ne se connecte jamais tout seul : le jeton est court et la vue est exclusive. Un seul canvas monte a la fois,
// demonte proprement (disconnect) quand on quitte l'onglet ou la machine.

const IDLE: Link = { st: 'idle', detail: '' }

export function Screen({ vm, state, onApplied }: { vm: string; state: string; onApplied: () => void }) {
  const view = usePoll<ViewRes>(() => fetchView(vm), 10000)
  const verdict = viewVerdict(view.error && !view.data ? { success: false, state, display: 'vnc', vnc: null, serial: false, reason: view.error } : view.data, state)
  const [link, setLink] = useState<Link>(IDLE)
  const [name, setName] = useState('')
  const [full, setFull] = useState(false)
  const [busy, setBusy] = useState(false)
  const target = useRef<HTMLDivElement>(null)
  const sess = useRef<ScreenSession | null>(null)

  const disconnect = useCallback(() => { sess.current?.disconnect(); sess.current = null }, [])
  useEffect(() => () => disconnect(), [disconnect, vm])   // changement de machine ou sortie de l'onglet : canvas demonte

  // la machine s'eteint ou perd son affichage : le flux tombe tout seul, mais on ferme aussi de notre cote
  useEffect(() => { if (verdict.kind !== 'vnc' && sess.current) disconnect() }, [verdict.kind, disconnect])

  // Echap quitte le plein ecran seulement si le clavier n'est pas tenu par la machine (sinon la touche lui revient)
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !target.current?.contains(document.activeElement)) setFull(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  async function connect() {
    if (!target.current || sess.current) return
    setLink({ st: 'connecting', detail: '' }); setName('')
    try {
      const open = await screenSource()
      if (!target.current) return
      sess.current = await open(target.current, vm, {
        onConnect: () => setLink({ st: 'connected', detail: '' }),
        onDisconnect: (reason, clean) => { sess.current = null; setLink({ st: 'closed', detail: clean ? reason : reason || 'connexion perdue' }) },
        onSecurityFailure: (reason) => setLink({ st: 'closed', detail: `refusé par le serveur VNC : ${reason}` }),
        onName: setName,
      })
    } catch (e) { sess.current = null; setLink({ st: 'closed', detail: e instanceof Error ? e.message : String(e) }) }
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
        <div className={`vh-view${full ? ' vh-plein' : ''}`} data-full={full || undefined}>
          <div className="vh-viewbar">
            <Chip tone={tone}><span className="vh-link-dot" />{LINK_LABEL[link.st]}{name && link.st === 'connected' ? ` · ${name}` : ''}</Chip>
            {link.detail && <span className="lite vh-link-why">{link.detail}</span>}
            <span style={{ flex: 1 }} />
            {!live && <Btn sm solid onClick={connect}>{link.st === 'closed' ? 'se reconnecter' : 'se connecter'}</Btn>}
            {live && <>
              <Btn sm onClick={() => sess.current?.sendCtrlAltDel()}>Ctrl+Alt+Suppr</Btn>
              <Btn sm onClick={paste}>coller</Btn>
              <button type="button" className="btn sm vh-coarse-only" onClick={() => sess.current?.focus()}>clavier</button>
            </>}
            <Btn sm onClick={() => { setFull((f) => !f); setTimeout(() => sess.current?.setScale(true), 50) }}>{full ? 'quitter le plein écran' : 'plein écran'}</Btn>
            {live && <Btn sm danger onClick={disconnect}>se déconnecter</Btn>}
            <Q k="fullscreen-kbd" /><Q k="cad" />
          </div>
          <div ref={target} className="vh-viewport" aria-label={`écran de ${vm}`} />
          {!live && <p className="lite vh-view-hint">{verdict.text}</p>}
        </div>
      )}
    </Card>
  )
}
