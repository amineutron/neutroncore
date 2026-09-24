import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, withConfirm } from '../lib/api'
import type { ChatMsg, LiveSession, Pending } from '../lib/sessions'
import { fmtClock } from '../lib/sessions'
import { Btn } from './ui'
import { Markdown } from './Markdown'

// Conversation d'une session Claude Code + zone de réponse (texte ou touches).
// Chargement initial des derniers messages, puis ajout incrémental par offset.

const KEYS: { key: string; label: string }[] = [
  { key: 'enter', label: 'entrée' }, { key: 'escape', label: 'échap' },
  { key: 'up', label: 'haut' }, { key: 'down', label: 'bas' }, { key: 'tab', label: 'tab' }, { key: 'ctrl+c', label: 'ctrl+c' },
]

function Tools({ tools }: { tools: string[] }) {
  const [open, setOpen] = useState(false)
  const shown = open ? tools : tools.slice(0, 2)
  return (
    <div className="cs-tools">
      {shown.map((t, i) => {
        const sep = t.indexOf(': ')
        const name = sep > 0 ? t.slice(0, sep) : t
        const arg = sep > 0 ? t.slice(sep + 2) : ''
        return <div key={i} className="cs-tool"><span className="cs-tool-name">{name}</span>{arg && <code>{arg}</code>}</div>
      })}
      {tools.length > 2 && (
        <button className="cs-tools-more" onClick={() => setOpen((o) => !o)}>
          {open ? 'replier' : `+ ${tools.length - 2} outils`}
        </button>
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
  return (
    <div className="cs-chat">
      <div className="cs-scroll" ref={scroller}>
        {truncated && <div className="cs-more">… début de la conversation dans le terminal</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.who === 'me' ? 'me' : 'ly'}`}>
            {m.who === 'claude' && <div className="who">claude · {fmtClock(m.at)}</div>}
            {m.who === 'claude' ? (
              <div className="bub">
                {m.text && <Markdown text={m.text} />}
                {m.tools && m.tools.length > 0 && <Tools tools={m.tools} />}
              </div>
            ) : <div className="cs-text">{m.text}</div>}
          </div>
        ))}
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
      <div className="cs-keys">
        {['y', 'n'].map((k) => <Btn key={k} sm disabled={ro || busy} onClick={() => send({ text: k })}>{k}</Btn>)}
        {KEYS.map((k) => <Btn key={k.key} sm disabled={ro || busy} onClick={() => send({ key: k.key })}>{k.label}</Btn>)}
      </div>
      <form className="cs-form" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send({ text }) }}>
        <textarea
          value={text} disabled={ro || busy} rows={2}
          placeholder={ro ? 'lecture seule' : 'répondre à claude… (entrée = envoyer, maj+entrée = ligne)'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) send({ text }) } }}
        />
        <Btn sm solid disabled={ro || busy || !text.trim()}>{busy ? '…' : 'envoyer'}</Btn>
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
          <div className="cs-pending-qt">{q.header && <code>{q.header}</code>}{q.question}</div>
          <ul>{q.options.map((o, i) => <li key={i}><b>{i + 1}. {o.label}</b>{o.description && <span> — {o.description}</span>}</li>)}</ul>
          {qi === 0 && p.questions!.length > 1 && <small>les choix ci-dessous répondent à la 1re question ; enchaîne au clavier (touches) pour les suivantes</small>}
        </div>
      ))}
      {p.detail && (
        openDetail
          ? (p.kind === 'plan' ? <div className="cs-pending-plan"><Markdown text={p.detail} /></div> : <pre className="cs-pending-detail">{p.detail}</pre>)
          : <button className="cs-tools-more" onClick={() => setOpenDetail(true)}>voir le détail ({p.detail.length} car.)</button>
      )}
      <div className="cs-pending-opts">
        {p.options.map((o, i) => (
          <Btn key={i} sm solid={i === 0} disabled={disabled} onClick={() => onPick(o.keys)}>{o.label}</Btn>
        ))}
      </div>
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

// Ajoute les nouveaux messages ; si le dernier affiché et le premier reçu sont
// tous deux de claude (tour encore en cours), on les fusionne.
function mergeTail(prev: ChatMsg[], fresh: ChatMsg[]): ChatMsg[] {
  const last = prev[prev.length - 1]
  const first = fresh[0]
  if (last && first && last.who === 'claude' && first.who === 'claude') {
    const merged: ChatMsg = {
      ...last,
      text: [last.text, first.text].filter(Boolean).join('\n'),
      at: first.at ?? last.at,
      tools: [...(last.tools ?? []), ...(first.tools ?? [])],
    }
    return [...prev.slice(0, -1), merged, ...fresh.slice(1)]
  }
  return [...prev, ...fresh]
}
