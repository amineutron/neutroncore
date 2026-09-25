import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, lyraChat } from '../lib/api'
import { usePoll, fmtRemaining } from '../lib/poll'
import { fetchVms, type Vm } from '../lib/vms'
import { getSettings } from '../lib/settings'
import { onLyraEvent } from '../lib/mascotBus'
import { Mascot } from './Mascot'

type Msg =
  | { who: 'help' }
  | { who: 'me'; text: string }
  | { who: 'lyra'; text: string; kind?: string; at: string }
  | { who: 'ask'; text: string; chatId: string }

const QUICK = ['état des vms', 'lance un backup', 'scène iron man', 'tout éteindre']


type CatalogTool = { name: string; description: string; args: string }
type CatalogServer = { server: string; count: number; description: string; tools: CatalogTool[] }

const BASE_COMMANDS: { cmd: string; desc: string }[] = [
  { cmd: '/help', desc: 'ce menu — clique un serveur pour explorer ses outils' },
  { cmd: '/clear', desc: 'vide la conversation affichée (l’historique serveur reste)' },
  { cmd: '/mode', desc: 'affiche le mode ; /mode performance = domotique sans confirmation (jamais VM/backup dangereux) ; /mode default = confirmations' },
  { cmd: '/status', desc: 'état du daemon lyra (joignable, heartbeat)' },
]

// Suggestions affichées dès que la saisie commence par "/" (affinées en tapant)
const SLASH_SUGGESTIONS: { cmd: string; desc: string }[] = [
  ...BASE_COMMANDS,
  { cmd: '/mode performance', desc: 'domotique exécutée sans confirmation' },
  { cmd: '/mode default', desc: 'confirmations activées' },
]

type TrackSession = {
  id: string; name: string; template: string; status: string
  processed?: number | null; total?: number | null; log?: string | null
  logs?: { timestamp: string; message: string }[]
  extra?: Record<string, string>; created_at?: string
}

function HelpTree({ catalog }: { catalog: CatalogServer[] }) {
  const [open, setOpen] = useState<string[]>([])
  const toggle = (k: string) => setOpen((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))
  const row = { fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.5 } as const
  return (
    <div className="bub" style={{ maxWidth: '100%' }}>
      <div className="eyebrow">commandes du chat</div>
      {BASE_COMMANDS.map((c) => (
        <div key={c.cmd} style={{ ...row, marginBottom: 3 }}>
          <span style={{ color: 'var(--gold)' }}>{c.cmd}</span>
          <span style={{ color: 'var(--muted)' }}> — {c.desc}</span>
        </div>
      ))}
      <div className="eyebrow" style={{ marginTop: 10 }}>outils lyra (rag) — clique pour déplier</div>
      {catalog.length === 0 && <span style={{ ...row, color: 'var(--faint)' }}>catalogue indisponible</span>}
      {catalog.map((s) => (
        <div key={s.server}>
          <div style={{ ...row, cursor: 'pointer', padding: '2px 0' }} onClick={() => toggle(s.server)}>
            <span style={{ color: 'var(--rose)' }}>{open.includes(s.server) ? '[-]' : '[+]'} {s.server}</span>
            <span style={{ color: 'var(--muted)' }}> ({s.tools.length}) — {s.description}</span>
          </div>
          {open.includes(s.server) && s.tools.map((t) => {
            const k = `${s.server}:${t.name}`
            return (
              <div key={k} style={{ marginLeft: 14 }}>
                <div style={{ ...row, cursor: 'pointer', padding: '1px 0' }} onClick={() => toggle(k)}>
                  <span style={{ color: 'var(--gold)' }}>{open.includes(k) ? '[-]' : '[+]'} {t.name}</span>
                  <span style={{ color: 'var(--muted)' }}> — {t.description}</span>
                </div>
                {open.includes(k) && (
                  <div style={{ ...row, marginLeft: 16, color: 'var(--faint)', borderLeft: '2px solid var(--line2)', paddingLeft: 8, marginBottom: 4 }}>
                    arguments : {t.args}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function notifyDesktop(text: string) {
  if (!getSettings().notifications || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification('lyra', { body: text.slice(0, 140), icon: `${import.meta.env.BASE_URL}icon-512.png` })
  } else if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

export function LyraPanel({ hidden, floating, onClose, onUnread }: {
  hidden: boolean; floating?: boolean; onClose: () => void; onUnread: () => void
}) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [maxi, setMaxi] = useState(false)
  const [reader, setReader] = useState<string | null>(null)  // contenu du modal de lecture
  const [listening, setListening] = useState(false)
  const [catalog, setCatalog] = useState<CatalogServer[]>([])
  const [currentTool, setCurrentTool] = useState('')
  const [watchedVms, setWatchedVms] = useState<string[]>([])
  const [vmStates, setVmStates] = useState<Vm[]>([])
  // suivi des VMs demarrees via Lyra : poll seulement tant qu'une VM suivie
  // n'est pas encore active (chaque appel coute 3 a 7 s cote daemon)
  const vmPending = watchedVms.some((vm) => vmStates.find((v) => v.name === `vm_${vm}`)?.status !== 'up')
  usePoll(() => fetchVms().then((d) => setVmStates(d.vms)), 10000, vmPending)
  // suivi live des taches Lyra longues (clone systeme, backup...) via tracking
  const trackWatch = usePoll<TrackSession[]>(() => apiGet('/tracking/sessions'), 6000)
  const runningTasks = (trackWatch.data ?? []).filter(
    (s) => s.status === 'running' && s.template === 'lyra_task',
  )
  const [openTask, setOpenTask] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [slashSelected, setSlashSelected] = useState(0)
  const slashSuggestions = input.startsWith('/')
    ? SLASH_SUGGESTIONS.filter((s) => s.cmd.startsWith(input.trimStart()))
    : []
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const status = usePoll<{ reachable: boolean; heartbeat_age: number | null }>(
    () => apiGet('/lyra/status'), 30000,
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [msgs])

  const hiddenRef = useRef(hidden)
  hiddenRef.current = hidden

  // convertit un événement du pont (SSE ou historique) en message affichable
  function evToMsg(ev: Record<string, unknown>, at: string): Msg | null {
    const type = ev.type as string
    if (type === 'user_text') return { who: 'me', text: ev.text as string }
    if (type === 'output') {
      const kind = ev.kind as string
      if (kind === 'tool_call') return { who: 'lyra', text: `outil : ${ev.tool as string}`, kind: 'tool', at }
      const text = ((ev.text as string) ?? '').trim()
      return text ? { who: 'lyra', text, kind, at } : null
    }
    if (type === 'ask') return { who: 'ask', text: ev.prompt as string, chatId: ev.chat_id as string }
    if (type === 'busy' || type === 'error') return { who: 'lyra', text: (ev.text as string) ?? type, kind: 'error', at }
    return null
  }

  // restaure la conversation gardée côté backend (sessions durables)
  useEffect(() => {
    apiGet<{ events: Record<string, unknown>[]; active: boolean }>('/lyra/history')
      .then((h) => {
        const restored = h.events
          .map((ev) => evToMsg(ev, new Date(((ev.ts as number) ?? 0) * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })))
          .filter((m): m is Msg => m !== null)
          // les "ask" passés ne sont plus actionnables sans session active
          .filter((m) => m.who !== 'ask' || h.active)
        if (restored.length > 0) setMsgs(restored)
      })
      .catch(() => { /* backend redémarré : pas d'historique */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const push = (m: Msg) => {
    setMsgs((prev) => [...prev, m])
    // message de Lyra pendant que le panneau est réduit ou l'onglet en fond :
    // badge animé + notification navigateur
    if (m.who === 'lyra' || m.who === 'ask') {
      if (hiddenRef.current) onUnread()
      if (hiddenRef.current || document.hidden) notifyDesktop(m.text)
    }
  }
  const now = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const [chatMode, setChatMode] = useState<'default' | 'performance'>(
    () => (localStorage.getItem('neutroncore_lyra_mode') as 'default' | 'performance') || 'default',
  )

  function handleSlash(text: string): boolean {
    const [cmd, ...rest] = text.slice(1).trim().split(/\s+/)
    const arg = rest.join(' ')
    const reply = (t: string) => push({ who: 'lyra', text: t, kind: 'tool', at: now() })
    switch (cmd) {
      case 'help':
        if (catalog.length === 0) {
          apiGet<{ servers: CatalogServer[] }>('/lyra/catalog')
            .then((c) => setCatalog(c.servers))
            .catch(() => { /* menu sans rag */ })
        }
        push({ who: 'help' })
        return true
      case 'clear':
        setMsgs([])
        return true
      case 'mode':
        if (arg === 'performance' || arg === 'default') {
          setChatMode(arg)
          localStorage.setItem('neutroncore_lyra_mode', arg)
          reply(arg === 'performance'
            ? 'mode performance : domotique exécutée sans confirmation (jamais pour les actions dangereuses VM/backup)'
            : 'mode default : confirmations activées')
        } else {
          reply(`mode actuel : ${chatMode} — /mode performance | /mode default`)
        }
        return true
      case 'status':
        apiGet<{ reachable: boolean; status: string; heartbeat_age: number | null }>('/lyra/status')
          .then((s) => reply(`daemon : ${s.reachable ? 'joignable' : 'injoignable'} · ${s.status} · heartbeat il y a ${s.heartbeat_age ?? '?'} s`))
          .catch((e) => reply(`status impossible : ${(e as Error).message}`))
        return true
      default:
        reply(`commande inconnue : /${cmd} — tape /help`)
        return true
    }
  }

  async function send(text: string) {
    if (!text.trim() || busy) return
    setInput('')
    if (text.trim().startsWith('/')) {
      push({ who: 'me', text })
      handleSlash(text.trim())
      return
    }
    push({ who: 'me', text })
    setBusy(true)
    onLyraEvent({ type: 'user_text' })
    try {
      await lyraChat(text, (ev) => {
        onLyraEvent(ev)
        // encart "tache en cours" : outil en vol + VMs a suivre
        if (ev.type === 'output' && ev.kind === 'tool_call') {
          setCurrentTool(String(ev.tool ?? ''))
          const args = (ev.arguments ?? {}) as Record<string, unknown>
          if (String(ev.tool).includes('vm_start') && args.vm_name) {
            const vm = String(args.vm_name)
            setWatchedVms((w) => (w.includes(vm) ? w : [...w, vm]))
          }
        }
        if (ev.type === 'result') setCurrentTool('')
        const type = ev.type as string
        if (type === 'output') {
          const kind = ev.kind as string
          if (kind === 'tool_call') {
            push({ who: 'lyra', text: `outil : ${ev.tool as string}`, kind: 'tool', at: now() })
          } else {
            // tool_result inclus : c'est souvent LA réponse (liste de VMs...)
            const text = (ev.text as string) ?? ''
            if (text.trim()) push({ who: 'lyra', text, kind, at: now() })
          }
        } else if (type === 'ask') {
          push({ who: 'ask', text: ev.prompt as string, chatId: ev.chat_id as string })
        } else if (type === 'busy' || type === 'error') {
          push({ who: 'lyra', text: (ev.text as string) ?? type, kind: 'error', at: now() })
        }
      }, undefined, chatMode)
    } catch (e) {
      push({ who: 'lyra', text: `Lyra injoignable : ${(e as Error).message}`, kind: 'error', at: now() })
    } finally {
      setBusy(false)
    }
  }

  async function startVoice() {
    if (!localStorage.getItem('neutroncore_audio_warned')) {
      window.alert('Dictée vocale : veille à bien choisir ta source audio dans paramètres > audio avant utilisation.')
      localStorage.setItem('neutroncore_audio_warned', '1')
    }
    const wanted = getSettings().audioInput
    if (wanted && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices()
        if (!devs.some((d) => d.kind === 'audioinput' && d.deviceId === wanted)) {
          push({ who: 'lyra', text: 'Micro configuré introuvable — branche-le ou choisis-en un autre dans paramètres > audio. J\'utilise l\'entrée système par défaut.', kind: 'error', at: now() })
        }
      } catch { /* permissions non accordées : on continue */ }
    }
    const SR = (window as unknown as Record<string, any>).SpeechRecognition
      ?? (window as unknown as Record<string, any>).webkitSpeechRecognition
    if (!SR) {
      push({ who: 'lyra', text: 'Dictee vocale non supportee par ce navigateur (utilise Chrome).', kind: 'error', at: now() })
      return
    }
    const rec = new SR()
    rec.lang = 'fr-FR'
    rec.interimResults = false
    rec.onresult = (e: any) => {
      const txt = e.results[0][0].transcript
      setListening(false)
      send(txt)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    setListening(true)
    rec.start()
  }

  async function answer(chatId: string, value: string) {
    setMsgs((prev) => prev.filter((m) => m.who !== 'ask'))
    onLyraEvent({ type: 'answer_sent' })
    try {
      await apiPost('/lyra/answer', { chat_id: chatId, value })
    } catch {
      push({ who: 'lyra', text: 'La session de confirmation a expiré.', kind: 'error', at: now() })
    }
  }

  return (
    <aside className={`lyra-panel ${floating ? 'floating' : ''} ${maxi ? 'max' : ''} ${hidden ? 'hidden' : ''}`}>
      <div className="lyra-head">
        <span className="core" />
        <b>lyra</b>
        <span>{status.data?.reachable ? 'daemon ok' : 'hors ligne'}</span>
        {getSettings().mascots && (
          <span style={{ display: 'flex', gap: 8, marginLeft: 10 }}>
            {getSettings().mascotFastOn && <Mascot kind="fast" name={getSettings().mascotFast} live size={5} />}
            {getSettings().mascotSlowOn && <Mascot kind="slow" name={getSettings().mascotSlow} live size={5} />}
          </span>
        )}
        {floating && <span className="x" onClick={() => setMaxi((v) => !v)}>{maxi ? 'reduire' : 'plein ecran'}</span>}
        <span className="x" onClick={onClose}>fermer</span>
      </div>
      {(busy || currentTool || watchedVms.length > 0 || runningTasks.length > 0) && (
        <div style={{ margin: '10px 14px 0', border: '1px solid var(--line2)', borderLeft: '3px solid var(--gold)', borderRadius: 8, padding: '8px 11px', background: 'var(--surface)' }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>tâche en cours</div>
          {busy && (
            <div style={{ fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--muted)', marginBottom: 3 }}>
              <span className="dot warn" style={{ marginRight: 6 }} />{currentTool ? `outil : ${currentTool}` : 'lyra réfléchit…'}
            </div>
          )}
          {runningTasks.map((t) => {
            const pct = t.total ? Math.min(100, Math.round(((t.processed ?? 0) / t.total) * 100)) : null
            // le dernier log est plus frais que extra.phase (fige a "Demarrage")
            const lastLog = t.logs?.length ? t.logs[t.logs.length - 1].message : t.log
            const detail = lastLog || t.extra?.phase || ''
            const remaining = fmtRemaining(t.created_at, pct ?? 0) ?? t.extra?.eta
            const opened = openTask === t.id
            return (
              <div key={t.id} style={{ fontSize: 11.5, fontFamily: 'var(--mono)', marginBottom: 5, cursor: 'pointer' }}
                onClick={() => setOpenTask(opened ? null : t.id)} title="cliquer pour le détail">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="dot warn" />
                  <span style={{ flex: 1 }}>{t.name}{pct !== null ? ` · ${pct}%` : ''}</span>
                  {remaining && <span style={{ color: 'var(--warn)' }}>{remaining}</span>}
                </div>
                {!opened && detail && <div style={{ color: 'var(--muted)', margin: '2px 0 3px 14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail}</div>}
                {pct !== null && (
                  <div className="bar" style={{ marginLeft: 14 }}><i style={{ width: `${pct}%` }} /></div>
                )}
                {opened && (
                  <div className="sess-detail" style={{ marginLeft: 14 }}>
                    {t.created_at && <div>démarrée {new Date(t.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>}
                    {(t.logs ?? []).slice(-5).map((l, i) => (
                      <div className="logline" key={i}><b>{l.timestamp.slice(11, 19)}</b> {l.message.slice(0, 90)}</div>
                    ))}
                    {(t.logs ?? []).length === 0 && <div style={{ color: 'var(--faint)' }}>pas encore de logs</div>}
                  </div>
                )}
              </div>
            )
          })}
          {watchedVms.map((vm) => {
            const svc = vmStates.find((s) => s.name === `vm_${vm}`)
            const st = svc?.extra?.vm_state ?? svc?.status ?? 'inconnu'
            const up = svc?.status === 'up'
            return (
              <div key={vm} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontFamily: 'var(--mono)', marginBottom: 3 }}>
                <span className={`dot ${up ? 'ok' : 'warn'}`} />
                <span style={{ flex: 1 }}>{vm} : {up ? 'démarrée' : st}</span>
                <span className="x" style={{ fontSize: 10 }} onClick={() => setWatchedVms((w) => w.filter((x) => x !== vm))}>retirer</span>
              </div>
            )
          })}
        </div>
      )}
      <div className="lyra-msgs" ref={scrollRef}>
        {msgs.length === 0 && (
          <div className="msg ly">
            <div className="who">lyra</div>
            <div className="bub">Je t'écoute — VMs, backups, lumières, scènes… demande-moi.</div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.who === 'help' ? (
            <div key={i} className="msg ly" style={{ maxWidth: '98%' }}>
              <div className="who">lyra · aide</div>
              <HelpTree catalog={catalog} />
            </div>
          ) : m.who === 'me' ? (
            <div key={i} className="msg me">{m.text}</div>
          ) : m.who === 'ask' ? (() => {
            const destructive = m.text.includes('ACTION DESTRUCTIVE')
            const sensitive = !destructive && m.text.includes('ACTION SENSIBLE')
            const tone = destructive ? 'var(--crit)' : sensitive ? 'var(--warn)' : undefined
            return (
            <div key={i} className="msg ly">
              <div className="who" style={tone ? { color: tone } : undefined}>
                {destructive ? 'lyra · CONFIRMATION DESTRUCTIVE'
                  : sensitive ? 'lyra · action sensible' : 'lyra · confirmation'}
              </div>
              <div className="bub" style={tone ? { borderColor: tone, boxShadow: `0 0 12px color-mix(in srgb, ${tone} ${destructive ? 35 : 22}%, transparent)` } : undefined}>
                {m.text}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {destructive ? (
                    <>
                      <button className="btn sm" style={{ background: 'var(--crit)', border: 'none', color: '#fff', fontWeight: 600 }}
                        onClick={() => answer(m.chatId, 'o')}>confirmer la destruction</button>
                      <button className="btn sm" onClick={() => answer(m.chatId, 'n')}>annuler</button>
                    </>
                  ) : sensitive ? (
                    <>
                      <button className="btn sm" style={{ background: 'var(--warn)', border: 'none', color: '#1a1206', fontWeight: 600 }}
                        onClick={() => answer(m.chatId, 'o')}>confirmer</button>
                      <button className="btn sm" onClick={() => answer(m.chatId, 'n')}>annuler</button>
                    </>
                  ) : (
                    <>
                      <button className="btn sm solid" onClick={() => answer(m.chatId, 'o')}>oui</button>
                      <button className="btn sm danger" onClick={() => answer(m.chatId, 'n')}>non</button>
                    </>
                  )}
                </div>
              </div>
            </div>
            )
          })() : (
            <div key={i} className="msg ly">
              <div className="who">lyra · {m.at}</div>
              {(() => {
                const isPre = m.text.includes('\n') && (m.text.includes('===') || m.text.split('\n').some((l) => l.length > 44))
                return (
                  <>
                  <div
                    className={`bub ${isPre ? 'pre' : ''}`}
                    style={{
                      ...(isPre ? {} : { whiteSpace: 'pre-wrap' as const }),
                      ...(m.kind === 'error' ? { borderColor: '#ff5c7455' } : {}),
                      ...(m.kind === 'tool' ? { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' } : {}),
                    }}
                  >{m.text}</div>
                    {isPre && (
                      <button
                        className="btn sm"
                        style={{ marginTop: 4, fontSize: 9.5, padding: '2px 8px' }}
                        onClick={() => setReader(m.text)}
                      >lire en plein écran</button>
                    )}
                  </>
                )
              })()}
            </div>
          ),
        )}
        {busy && (
          <div className="msg ly">
            <div className="who">lyra</div>
            <div className="bub" style={{ color: 'var(--faint)' }}>…</div>
          </div>
        )}
      </div>
      <div className="lyra-quick">
        {QUICK.map((q) => (
          <span key={q} className="chip" onClick={() => send(q)}>{q}</span>
        ))}
      </div>
      <div className="lyra-input" style={{ position: 'relative' }}>
        {slashSuggestions.length > 0 && (
          <div className="slash-pop">
            {slashSuggestions.map((s, i) => (
              <div
                key={s.cmd}
                className={`row ${i === Math.min(slashSelected, slashSuggestions.length - 1) ? 'sel' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); send(s.cmd) }}
                onMouseEnter={() => setSlashSelected(i)}
              >
                <b>{s.cmd}</b>
                <span>{s.desc}</span>
              </div>
            ))}
          </div>
        )}
        <input
          placeholder="Écris à Lyra… (/help)"
          aria-label="Message à Lyra"
          value={input}
          onChange={(e) => { setInput(e.target.value); setSlashSelected(0) }}
          onKeyDown={(e) => {
            if (slashSuggestions.length > 0) {
              const sel = Math.min(slashSelected, slashSuggestions.length - 1)
              if (e.key === 'ArrowUp') { e.preventDefault(); setSlashSelected((sel + slashSuggestions.length - 1) % slashSuggestions.length); return }
              if (e.key === 'ArrowDown') { e.preventDefault(); setSlashSelected((sel + 1) % slashSuggestions.length); return }
              if (e.key === 'Tab') { e.preventDefault(); setInput(slashSuggestions[sel].cmd); return }
              if (e.key === 'Escape') { setInput(''); return }
              if (e.key === 'Enter') { send(input === slashSuggestions[sel].cmd ? input : slashSuggestions[sel].cmd); return }
            }
            if (e.key === 'Enter') send(input)
          }}
        />
        <button
          className="mic" aria-label="Dictee vocale"
          style={{ background: listening ? 'var(--crit)' : 'var(--surface2)', border: '1px solid var(--line2)' }}
          onClick={startVoice}
        >
          <svg viewBox="0 0 24 24" style={{ fill: listening ? '#fff' : 'var(--muted)' }}><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15zm6-3.5a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93V22h2v-2.57A8 8 0 0 0 20 11.5h-2z"/></svg>
        </button>
        <button className="mic" aria-label="Envoyer" onClick={() => send(input)}>
          <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
        </button>
      </div>
      {reader && (
        <div className="pre-modal" onClick={() => setReader(null)}>
          <div className="inner" onClick={(e) => e.stopPropagation()}>
            <div className="head">lyra — lecture<span style={{ flex: 1 }} /><span className="x" onClick={() => setReader(null)}>fermer</span></div>
            <pre>{reader}</pre>
          </div>
        </div>
      )}
    </aside>
  )
}
