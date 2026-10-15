import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, withConfirm } from '../lib/api'
import type { ChatMsg, LiveSession, Pending } from '../lib/sessions'
import { commandes, dureeTour, fmtClock, fmtDuree, mergeTail, resumeCommandes, userText } from '../lib/sessions'
import { Btn } from './ui'
import { Markdown } from './Markdown'

// Conversation d'une session Claude Code + zone de réponse (texte ou touches).
// Chargement initial des derniers messages, puis ajout incrémental par offset.

const KEYS: { key: string; label: string }[] = [
  { key: 'enter', label: 'entrée' }, { key: 'escape', label: 'échap' },
  { key: 'up', label: 'haut' }, { key: 'down', label: 'bas' }, { key: 'tab', label: 'tab' }, { key: 'ctrl+c', label: 'ctrl+c' },
]

const VISIBLES = 4       // commandes montrées d'office quand l'exécution est dépliée

// Exécution d'un tour : une ligne de résumé (combien de commandes, lesquelles), dépliable en liste
// rangée, la plus récente en haut. Dépliée d'office tant que le tour est en cours.
function Execution({ m, live }: { m: ChatMsg; live: boolean }) {
  const [choix, setChoix] = useState<boolean | null>(null)
  const [tout, setTout] = useState(false)
  const cmds = commandes(m)
  const open = choix ?? live
  const shown = tout ? cmds : cmds.slice(0, VISIBLES)
  return (
    <div className={`cs-exec ${open ? 'open' : ''} ${live ? 'live' : ''}`}>
      <button type="button" className="cs-exec-head" aria-expanded={open} onClick={() => setChoix(!open)}>
        <span className="cs-exec-chev" aria-hidden />
        <b>{live ? 'en cours' : 'exécution'}</b>
        <span>{cmds.length} commande{cmds.length > 1 ? 's' : ''}</span>
        <i>{open ? '' : live ? `${cmds[0].nom}${cmds[0].arg ? ` · ${cmds[0].arg}` : ''}` : resumeCommandes(cmds)}</i>
      </button>
      {open && (
        <ol className="cs-exec-list">
          {shown.map((c, i) => (
            <li key={cmds.length - i} className={i === 0 && live ? 'now' : ''}>
              <time>{fmtClock(c.at)}</time>
              <span className="cs-tool-name">{c.nom}</span>
              {c.arg && <code title={c.arg}>{c.arg}</code>}
            </li>
          ))}
          {cmds.length > VISIBLES && (
            <li className="more"><button type="button" className="cs-tools-more" onClick={() => setTout(!tout)}>
              {tout ? 'ne garder que les dernières' : `voir les ${cmds.length - VISIBLES} précédentes`}</button></li>
          )}
        </ol>
      )}
    </div>
  )
}

export function SessionChat({ session, onSent }: { session: LiveSession; onSent: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [offset, setOffset] = useState(0)
  const [truncated, setTruncated] = useState(false)
  // brouillon persisté par session : survit au changement d'écran, au
  // repli de la carte et au rechargement (la zone est démontée à chaque fois)
  const [text, setTextState] = useState(() => loadDraft(session.sessionId))
  const setText = (v: string) => { setTextState(v); saveDraft(session.sessionId, v) }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [touches, setTouches] = useState(false)       // touches du terminal : repliées, la zone de réponse reste nette
  const [loadErr, setLoadErr] = useState('')
  // session neuve : Claude Code n'a pas encore écrit de transcript
  const [empty, setEmpty] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  offsetRef.current = offset

  useEffect(() => {
    let stop = false
    let timer: ReturnType<typeof setInterval> | null = null
    const load = async (first: boolean) => {
      try {
        const q = first ? 'limit=80' : `offset=${offsetRef.current}`
        const r = await apiGet<{ messages: ChatMsg[]; offset: number; truncated: boolean; empty?: boolean }>(`/launcher/sessions/${session.sessionId}/messages?${q}`)
        if (stop) return
        setLoadErr('')
        setEmpty(!!r.empty)
        setOffset(r.offset)
        if (first) { setMsgs(r.messages); setTruncated(r.truncated) }
        else if (r.messages.length) setMsgs((m) => mergeTail(m, r.messages))
      } catch (e) { if (!stop) setLoadErr((e as Error).message) }
    }
    load(true)
    timer = setInterval(() => { if (!document.hidden) load(false) }, 3000)
    return () => { stop = true; if (timer) clearInterval(timer) }
  }, [session.sessionId])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length])

  async function send(body: { text?: string; key?: string; keys?: string[] }) {
    setBusy(true); setErr('')
    try {
      await apiPost(`/launcher/sessions/${session.sessionId}/reply`, body, await withConfirm('launcher_reply'))
      if (body.text) setText('')
      onSent()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const ro = !session.controllable
  const visibles = msgs.filter((m) => m.who === 'claude' || userText(m.text))
  // tour en cours : le registre dit « busy » et Claude n'attend rien
  const enCours = (session.status === 'busy' || session.status === 'running') && !session.waiting
  return (
    <div className="cs-chat">
      <div className="cs-scroll" ref={scroller}>
        {truncated && <div className="cs-more">… début de la conversation dans le terminal</div>}
        {visibles.map((m, i) => {
          if (m.who !== 'claude') return <div key={i} className="msg me"><div className="cs-text">{userText(m.text)}</div></div>
          const live = enCours && i === visibles.length - 1
          const tour = dureeTour(m)
          return (
            <div key={i} className="msg ly">
              <div className="who">
                claude · {fmtClock(m.at)}
                {m.think_s !== undefined && m.think_s >= 1 && <span className="cs-temps" title="Temps passé à réfléchir pendant ce tour">réflexion {fmtDuree(m.think_s)}</span>}
                {tour !== null && <span className="cs-temps" title="Durée du tour, commandes comprises">{live ? 'depuis' : 'tour'} {fmtDuree(tour)}</span>}
              </div>
              <div className="bub">
                {m.tools && m.tools.length > 0 && <Execution m={m} live={live} />}
                {m.text && <Markdown text={m.text} />}
              </div>
            </div>
          )
        })}
        {msgs.length === 0 && !loadErr && <div className="cs-more">{empty ? 'session neuve : aucun message pour l\'instant' : 'chargement…'}</div>}
        {session.waiting && (
          <div className="cs-wait-banner">
            <span className="cs-dot wait" /> en attente : {session.wait_message || 'réponse ou permission demandée'}
          </div>
        )}
        {session.waiting && session.pending && (
          <PendingPanel p={session.pending} disabled={ro || busy} onPick={(keys) => send({ keys })} />
        )}
      </div>
      {ro && (
        <div className="cs-ro">
          lecture seule : fenêtre kitty injoignable (terminal lancé avant l'activation du pilotage, ou hors kitty). Relance la session depuis le lanceur pour répondre d'ici.
        </div>
      )}
      {touches && (
        <div className="cs-keys">
          {['y', 'n'].map((k) => <Btn key={k} sm disabled={ro || busy} onClick={() => send({ text: k })}>{k}</Btn>)}
          {KEYS.map((k) => <Btn key={k.key} sm disabled={ro || busy} onClick={() => send({ key: k.key })}>{k.label}</Btn>)}
        </div>
      )}
      <form className="cs-form" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send({ text }) }}>
        <textarea
          value={text} disabled={ro || busy} rows={2}
          placeholder={ro ? 'lecture seule' : 'répondre à claude… (entrée = envoyer, maj+entrée = ligne)'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) send({ text }) } }}
        />
        <div className="cs-form-btns">
          <Btn sm solid disabled={ro || busy || !text.trim()}>{busy ? '…' : 'envoyer'}</Btn>
          <button type="button" className={`btn sm ${touches ? 'solid' : ''}`} aria-expanded={touches} title="Touches du terminal : entrée, échap, flèches, y / n" onClick={() => setTouches(!touches)}>touches</button>
        </div>
      </form>
      {(err || loadErr) && <div className="cs-err">{err || loadErr}</div>}
    </div>
  )
}

// Panneau de la demande en attente : ce que Claude veut faire (diff, commande,
// plan, question) et les vrais choix du dialogue, envoyés comme touches.
function PendingPanel({ p, disabled, onPick }: { p: Pending; disabled: boolean; onPick: (keys: string[]) => void }) {
  const [openDetail, setOpenDetail] = useState(p.kind !== 'permission' || p.detail.length < 600)
  return (
    <div className={`cs-pending kind-${p.kind}`}>
      <div className="cs-pending-head"><b>{p.title}</b>{p.kind === 'permission' && <code>{p.tool}</code>}</div>
      {p.kind === 'question' && p.questions?.map((q, qi) => (
        <div key={qi} className="cs-pending-q">
          <div className="cs-pending-qt">{q.header && <code>{q.header}</code>}<Markdown text={q.question} /></div>
          {/* les choix de la 1re question sont des cartes à toucher ; ceux des suivantes se lisent, puis se saisissent au clavier */}
          <div className="cs-choices">
            {q.options.map((o, i) => {
              const keys = qi === 0 && q.options.length === p.options.length ? p.options[i]?.keys : undefined
              const body = <><b><i>{i + 1}</i>{o.label}</b>{o.description && <Markdown text={o.description} />}</>
              return keys
                ? <button key={i} type="button" className="cs-choice" disabled={disabled} onClick={() => onPick(keys)}>{body}</button>
                : <div key={i} className="cs-choice static">{body}</div>
            })}
          </div>
          {q.multi && <small>plusieurs réponses possibles : touche la première ici, complète dans la fenêtre</small>}
          {qi === 0 && p.questions!.length > 1 && <small>{p.questions!.length} questions : les cartes répondent à la première, les suivantes se répondent au clavier</small>}
        </div>
      ))}
      {p.detail && (
        openDetail
          ? (p.kind === 'plan' ? <div className="cs-pending-plan"><Markdown text={p.detail} /></div> : <pre className="cs-pending-detail">{p.detail}</pre>)
          : <button className="cs-tools-more" onClick={() => setOpenDetail(true)}>voir le détail ({p.detail.length} car.)</button>
      )}
      {/* une question dont les cartes ne correspondent pas aux touches connues garde ses boutons : on peut toujours répondre */}
      {(p.kind !== 'question' || (p.questions?.[0]?.options.length ?? 0) !== p.options.length || p.options.length === 0) && (
        <div className="cs-pending-opts">
          {p.options.map((o, i) => (
            <Btn key={i} sm solid={i === 0} disabled={disabled} onClick={() => onPick(o.keys)}>{o.label}</Btn>
          ))}
        </div>
      )}
      <small className="cs-pending-hint">les boutons envoient les touches du dialogue ({p.options.map((o) => o.keys.join('+')).join(' / ')})</small>
    </div>
  )
}

const DRAFT_KEY = 'cs-draft:'
function loadDraft(sid: string): string {
  try { return localStorage.getItem(DRAFT_KEY + sid) ?? '' } catch { return '' }
}
function saveDraft(sid: string, v: string) {
  try { v ? localStorage.setItem(DRAFT_KEY + sid, v) : localStorage.removeItem(DRAFT_KEY + sid) } catch { /* stockage indisponible */ }
}
