import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, apiPut, sessionEvents, withConfirm } from '../lib/api'
import { usePoll } from '../lib/poll'
import { getSettings } from '../lib/settings'
import type { LiveSession, RecentSession, SessionMeta } from '../lib/sessions'
import { OTHERS_KEY, displayName, fmtAge, fmtClock, glyphState, stateLabel, tone } from '../lib/sessions'
import { Btn, Chip, Eyebrow } from './ui'
import { SessionChat } from './SessionChat'
import { SessionMetaEditor } from './SessionMeta'
import { SessionGlyph } from './SessionGlyph'
import { SessionClose } from './SessionClose'
import { ARRIVAL_MS, addLaunch, getLaunches, launchExpired, matchLaunch, removeLaunch, subscribeLaunches, type Launch } from '../lib/launches'

// Bloc « sessions » du lanceur : sessions Claude Code vivantes dans les dossiers
// du lanceur (cartes dépliables, plein écran, réponse), récentes à reprendre,
// notifications spéciales via le flux SSE des hooks Claude Code.

type Flash = { kind: 'wait' | 'done' | 'arrive'; at: number }

function notifyDesktop(title: string, body: string) {
  const st = getSettings()
  if (!st.notifications || !st.sessionBrowserNotif || !('Notification' in window)) return
  if (Notification.permission === 'granted') new Notification(title, { body: body.slice(0, 140), icon: `${import.meta.env.BASE_URL}icon-512.png` })
  else if (Notification.permission === 'default') Notification.requestPermission()
}

function readOthers(): boolean {
  try { return localStorage.getItem(OTHERS_KEY) === '1' } catch { return false }
}

export function Sessions({ onCounts }: { onCounts?: (byRepo: Record<string, number>) => void }) {
  const [others, setOthers] = useState(readOthers)
  const list = usePoll<{ sessions: LiveSession[]; waiting: number }>(() => apiGet(`/launcher/sessions?others=${others ? 1 : 0}`), 5000)
  const recent = usePoll<{ sessions: RecentSession[] }>(() => apiGet('/launcher/sessions/recent'), 60000)
  const [open, setOpen] = useState<string | null>(null)
  const [maxi, setMaxi] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [closing, setClosing] = useState<string | null>(null)
  const [flash, setFlash] = useState<Record<string, Flash>>({})
  const [toast, setToast] = useState<{ repo: string; text: string } | null>(null)
  const [busy, setBusy] = useState('')
  const [metaOverride, setMetaOverride] = useState<Record<string, SessionMeta>>({})
  const refreshRef = useRef(list.refresh)
  refreshRef.current = list.refresh
  // lancements en route : carte fantôme + poll accéléré jusqu'à l'arrivée de la session
  const [launches, setLaunches] = useState<Launch[]>(getLaunches)
  const [, tickNow] = useState(0)
  useEffect(() => subscribeLaunches(() => setLaunches(getLaunches())), [])
  useEffect(() => {
    if (launches.length === 0) return
    const t = setInterval(() => { refreshRef.current(); tickNow((n) => n + 1) }, 1500)
    return () => clearInterval(t)
  }, [launches.length])

  // flux des hooks : notification (claude attend) / stop (réponse terminée)
  useEffect(() => {
    const ctl = new AbortController()
    let stopped = false
    const run = async () => {
      while (!stopped) {
        try {
          await sessionEvents((ev) => {
            const sid = String(ev.sessionId ?? '')
            const cwd = String(ev.cwd ?? '')
            const repo = cwd.split('/').filter(Boolean).pop() ?? 'session'
            // session en veille : la liste se met à jour, mais ni toast, ni notif, ni halo
            if (ev.parked) { refreshRef.current(); return }
            if (ev.type === 'notification') {
              setFlash((f) => ({ ...f, [sid]: { kind: 'wait', at: Date.now() } }))
              const text = String(ev.message ?? 'claude attend ta réponse')
              if (getSettings().lyraAnim === 'toast') setToast({ repo, text })
              notifyDesktop(`claude · ${repo}`, text)
            } else if (ev.type === 'stop') {
              setFlash((f) => ({ ...f, [sid]: { kind: 'done', at: Date.now() } }))
            }
            refreshRef.current()
          }, ctl.signal)
        } catch { /* reconnexion */ }
        if (!stopped) await new Promise((r) => setTimeout(r, 4000))
      }
    }
    run()
    return () => { stopped = true; ctl.abort() }
  }, [])

  // les flashs "done" s'effacent seuls ; le toast aussi
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now()
      setFlash((f) => {
        const kept = Object.fromEntries(Object.entries(f).filter(([, v]) => v.kind === 'wait' || now - v.at < (v.kind === 'arrive' ? ARRIVAL_MS : 4500)))
        return Object.keys(kept).length === Object.keys(f).length ? f : kept
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const sessions = (list.data?.sessions ?? []).map((s) => (metaOverride[s.sessionId] ? { ...s, meta: metaOverride[s.sessionId] } : s))

  useEffect(() => {
    if (!list.data || launches.length === 0) return
    for (const s of sessions) {
      const l = matchLaunch(s, launches)
      if (!l) continue
      removeLaunch(l.id)
      setFlash((f) => ({ ...f, [s.sessionId]: { kind: 'arrive', at: Date.now() } }))
      setOpen(s.sessionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data])

  useEffect(() => {
    if (!onCounts) return
    const counts: Record<string, number> = {}
    for (const s of sessions) if (s.repo) counts[s.repo] = (counts[s.repo] ?? 0) + 1
    onCounts(counts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data])

  // cible d'un lien profond (?session=ID ou notification telephone) : deplier la session a l'arrivee de la liste
  useEffect(() => {
    if (!list.data) return
    let target = ''
    try { target = new URLSearchParams(window.location.search).get('session') || sessionStorage.getItem('deepLinkTarget') || '' } catch { /* stockage indisponible */ }
    if (target && sessions.some((s) => s.sessionId === target)) {
      setOpen(target)
      try { sessionStorage.removeItem('deepLinkTarget'); window.history.replaceState(null, '', window.location.pathname) } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data])

  // si la session ouverte disparaît, on referme
  useEffect(() => {
    if (open && list.data && !sessions.some((s) => s.sessionId === open)) { setOpen(null); setMaxi(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data])

  function toggleOthers() {
    const v = !others
    setOthers(v)
    try { localStorage.setItem(OTHERS_KEY, v ? '1' : '0') } catch { /* stockage indisponible */ }
  }
  async function focus(s: LiveSession) {
    setBusy(s.sessionId)
    try { await apiPost(`/launcher/sessions/${s.sessionId}/focus`) } catch { /* fenêtre injoignable */ } finally { setBusy('') }
  }
  async function resume(r: RecentSession) {
    setBusy(r.sessionId)
    try {
      await apiPost('/launcher/sessions/resume', { sessionId: r.sessionId, cwd: r.cwd }, await withConfirm('launcher_claude'))
      addLaunch({ cwd: r.cwd, repo: r.meta.alias || r.repo, sessionId: r.sessionId })
      recent.refresh(); list.refresh()
    }
    finally { setBusy('') }
  }
  function select(sid: string) {
    if (open === sid) { setOpen(null); setMaxi(false) } else { setOpen(sid); setEditing(null); setClosing(null) }
  }
  // afficher / masquer la session sur l'accueil et en mode tele (fiche, persistant)
  async function toggleHome(s: LiveSession) {
    setBusy(s.sessionId)
    try {
      const r = await apiPut<{ meta: SessionMeta }>(`/launcher/sessions/${s.sessionId}/meta`, { home_hidden: !s.meta.home_hidden })
      setMetaOverride((o) => ({ ...o, [s.sessionId]: r.meta }))
      list.refresh()
    } catch { /* resynchronise au prochain poll */ } finally { setBusy('') }
  }
  // veille <-> active, ou retour a active depuis « en fermeture » (reversible, sans confirmation)
  async function setState(s: LiveSession, state: '' | 'parked') {
    setBusy(s.sessionId)
    try {
      await apiPost(`/launcher/sessions/${s.sessionId}/state`, { state })
      if (state === 'parked' && open === s.sessionId) { setOpen(null); setMaxi(false) }
      list.refresh()
    } catch { /* la liste se resynchronise au prochain poll */ } finally { setBusy('') }
  }

  const anim = getSettings().lyraAnim
  const waiting = list.data?.waiting ?? 0
  const active = sessions.filter((s) => !s.state)
  const closingList = sessions.filter((s) => s.state === 'closing')
  const parked = sessions.filter((s) => s.state === 'parked')

  const renderCard = (s: LiveSession) => {
    const isOpen = open === s.sessionId
    const fl = flash[s.sessionId]
    const t = tone(s)
    const g = glyphState(s)
    const cls = ['cs', `tone-${t}`, s.state, s.close_ready ? 'ready' : '', isOpen ? 'open' : '', isOpen && maxi ? 'max' : '',
      s.waiting && s.state !== 'parked' && ['pulse', 'shake', 'ring'].includes(anim) ? `anim-${anim}` : '',
      fl?.kind === 'done' ? 'anim-done' : '', fl?.kind === 'arrive' ? 'anim-arrive' : ''].filter(Boolean).join(' ')
    const color = s.meta.color
    return (
      <div key={s.sessionId} className={cls} style={color ? ({ '--sc': color } as React.CSSProperties) : undefined}>
        {s.meta.comment && <div className="cs-comment">{s.meta.comment}</div>}
        <div className="cs-head" onClick={() => select(s.sessionId)}>
          <span className="cs-glyph-wrap"><SessionGlyph meta={s.meta} fallback={s.repo ?? s.name} state={g} /><i className={`cs-dot ${g === 'err' ? 'wait' : g}`} /></span>
          <div className="cs-title">
            <b>{displayName(s)}{s.meta.pinned && <span className="cs-pin" title="épinglée">*</span>}</b>
            <span className="cs-line">
              <i className="cs-repo" title={s.cwd}>{s.repo ?? 'hors favoris'}</i>
              <i className={`cs-state ${g === 'err' ? 'wait' : g}`}>{stateLabel(s)}</i>
              <i className="cs-age">{s.meta.alias ? `${s.name} · ` : ''}{fmtAge(s.age_s)}</i>
              {!s.controllable && <i className="cs-rolabel">lecture seule</i>}
            </span>
          </div>
          <div className="cs-actions" onClick={(e) => e.stopPropagation()}>
            <Btn sm onClick={() => { setEditing(editing === s.sessionId ? null : s.sessionId); setClosing(null) }}>fiche</Btn>
            <Btn sm disabled={busy === s.sessionId || !s.controllable} onClick={() => focus(s)}>fenêtre</Btn>
            {s.state !== 'closing' && (
              <Btn sm disabled={busy === s.sessionId} onClick={() => setState(s, s.state === 'parked' ? '' : 'parked')}>{s.state === 'parked' ? 'réveiller' : 'veille'}</Btn>
            )}
            {s.state !== 'parked' && (
              <button className={`btn sm ${s.meta.home_hidden ? '' : 'on-home'}`} disabled={busy === s.sessionId} title={s.meta.home_hidden ? 'masquée de l’accueil et de la télé — clic pour l’afficher' : 'visible sur l’accueil et la télé — clic pour la masquer'} onClick={() => toggleHome(s)}>
                {s.meta.home_hidden ? 'accueil : non' : 'accueil : oui'}
              </button>
            )}
            <Btn sm disabled={busy === s.sessionId} onClick={() => { setClosing(closing === s.sessionId ? null : s.sessionId); setEditing(null) }}>{s.state === 'closing' ? 'terminer' : 'fermer'}</Btn>
            <Btn sm solid onClick={() => { setOpen(s.sessionId); setMaxi(!(isOpen && maxi)) }}>{isOpen && maxi ? 'réduire' : 'plein écran'}</Btn>
          </div>
        </div>
        {!isOpen && (
          <div className="cs-preview" onClick={() => select(s.sessionId)}>
            {s.last_user && <div><em>toi</em> {s.last_user}</div>}
            {s.last_claude && <div><em>claude</em> {s.last_claude}</div>}
            {s.last_at && <div className="cs-when">{fmtClock(s.last_at)}</div>}
          </div>
        )}
        {s.state === 'closing' && (
          <div className={`cs-closing-bar ${s.close_ready ? 'ready' : ''}`}>
            <b>{s.close_ready ? 'prête à fermer' : 'en fermeture'}</b>
            <span>{s.close_ready ? 'Claude a terminé la clôture : vérifie le chat, puis termine.' : 'Claude exécute la clôture — vérifie le chat, réponds si une étape attend ton accord.'}</span>
            <Btn sm disabled={busy === s.sessionId} onClick={() => setState(s, '')}>annuler la fermeture</Btn>
            <Btn sm solid onClick={() => { setClosing(s.sessionId); setEditing(null) }}>terminer</Btn>
          </div>
        )}
        {closing === s.sessionId && (
          <SessionClose
            session={s}
            onDone={(what) => { if (what === 'closed' && open === s.sessionId) { setOpen(null); setMaxi(false) } list.refresh(); recent.refresh() }}
            onClose={() => setClosing(null)}
          />
        )}
        {editing === s.sessionId && (
          <SessionMetaEditor
            sessionId={s.sessionId} meta={s.meta} controllable={s.controllable}
            onSaved={(m) => { setMetaOverride((o) => ({ ...o, [s.sessionId]: m })); list.refresh() }}
            onClose={() => setEditing(null)}
          />
        )}
        {isOpen && <SessionChat session={s} onSent={() => { setFlash((f) => { const { [s.sessionId]: _, ...rest } = f; return rest }); list.refresh() }} />}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
        <Eyebrow>sessions claude code</Eyebrow>
        {waiting > 0 && <Chip tone="rose">{waiting} en attente</Chip>}
        {active.length > 0 && waiting === 0 && <Chip>{active.length} active{active.length > 1 ? 's' : ''}</Chip>}
        {parked.length > 0 && <Chip>{parked.length} en veille</Chip>}
        {closingList.length > 0 && <Chip tone="warn">{closingList.length} en fermeture</Chip>}
        <span style={{ flex: 1 }} />
        <label className="cs-check" style={{ margin: 0 }}>
          <input type="checkbox" checked={others} onChange={toggleOthers} /> hors favoris aussi
        </label>
      </div>
      {toast && (
        <div className="cs-toast" onClick={() => setToast(null)}>
          <b>claude · {toast.repo}</b><span>{toast.text}</span>
        </div>
      )}
      <p className="cs-hint">Une carte = une session Claude Code ouverte sur le PC. Le nom du dossier est en couleur ; touche la carte pour lire la conversation et répondre.</p>
      <div className="cs-list">
        {launches.map((l) => {
          const late = launchExpired(l)
          return (
            <div key={l.id} className={`cs-launch ${late ? 'late' : ''}`}>
              <span className="glyph">{l.repo.split(/[-_ ]/).map((w) => w[0]).join('').slice(0, 2)}</span>
              <div className="cs-title">
                <b>{late ? 'aucune session détectée' : l.sessionId ? 'reprise en cours' : 'claude démarre'}{!late && <span className="cs-launch-dots"><i /><i /><i /></span>}</b>
                <span className="cs-line"><i className="cs-repo">{l.repo}</i><i className="cs-age">{late ? 'regarde le terminal sur le PC (kitty ouverte ?)' : `${Math.max(0, Math.round((Date.now() - l.at) / 1000))} s — la carte arrive dès que la session s’enregistre`}</i></span>
                {!late && <div className="cs-launch-track" />}
              </div>
              <div className="cs-actions"><Btn sm onClick={() => removeLaunch(l.id)}>{late ? 'ok' : 'masquer'}</Btn></div>
            </div>
          )
        })}
        {active.map(renderCard)}
        {closingList.length > 0 && (
          <div className="cs-group" style={{ margin: '4px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <Eyebrow>en fermeture</Eyebrow><span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--faint)' }}>{closingList.length} — vérifie, puis termine</span>
            </div>
            <div className="cs-list" style={{ margin: 0 }}>{closingList.map(renderCard)}</div>
          </div>
        )}
        {parked.length > 0 && (
          <details className="cs-group">
            <summary><Eyebrow>en veille</Eyebrow><span>{parked.length} mise{parked.length > 1 ? 's' : ''} de côté — « réveiller » pour la remettre en tête</span></summary>
            <div className="cs-list" style={{ margin: 0 }}>{parked.map(renderCard)}</div>
          </details>
        )}
        {list.data && sessions.length === 0 && (
          <div className="cs-empty">
            Aucune session Claude Code dans les dossiers du lanceur.
            {list.error ? ` (${list.error})` : ' Lance-en une depuis un favori ci-dessous : elle apparaîtra ici.'}
          </div>
        )}
        {!list.data && !list.error && <div className="cs-empty">recherche des sessions…</div>}
      </div>
      {maxi && open && <div className="cs-backdrop" onClick={() => setMaxi(false)} />}

      {(recent.data?.sessions.length ?? 0) > 0 && (
        <details className="cs-recent">
          <summary><Eyebrow>récentes à reprendre</Eyebrow><span>{recent.data!.sessions.length}</span></summary>
          <div className="cs-recent-list">
            {recent.data!.sessions.map((r) => (
              <div key={r.sessionId} className="cs-recent-row" style={r.meta.color ? ({ '--sc': r.meta.color } as React.CSSProperties) : undefined}>
                <SessionGlyph meta={r.meta} fallback={r.repo} />
                <div className="cs-title">
                  <b>{r.meta.alias || r.title}</b>
                  <span className="cs-line">
                    <i className="cs-repo" title={r.cwd}>{r.repo}</i>
                    <i className="cs-age">{new Date(r.updatedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</i>
                    {r.meta.comment && <i className="cs-age">{r.meta.comment}</i>}
                  </span>
                </div>
                <Btn sm solid disabled={busy === r.sessionId} onClick={() => resume(r)}>{busy === r.sessionId ? '…' : 'reprendre'}</Btn>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  )
}
