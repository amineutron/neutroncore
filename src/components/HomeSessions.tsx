import { useContext } from 'react'
import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { NavContext } from '../App'
import type { LiveSession } from '../lib/sessions'
import { displayName, fmtClock, glyphState, stateLabel } from '../lib/sessions'
import { SessionGlyph } from './SessionGlyph'
import { Eyebrow } from './ui'

// Sessions Claude Code sur l'accueil et en mode télé : le glyphe de chaque
// session (mascotte animée si la fiche en a une) réagit à l'état réel.
// Exclues : sessions en veille et sessions marquées « masquer de l'accueil ».
// Formats : short = glyphes seuls · medium = glyphe + nom + état (colonne)
//           long = bande pleine largeur avec le dernier échange.

export type HomeFormat = 'short' | 'medium' | 'long'

export function visibleOnHome(s: LiveSession): boolean {
  return s.state !== 'parked' && !s.meta.home_hidden
}

export function HomeSessions({ format = 'medium', tv = false }: { format?: HomeFormat; tv?: boolean }) {
  const navigate = useContext(NavContext)
  const list = usePoll<{ sessions: LiveSession[] }>(() => apiGet('/launcher/sessions'), 5000)
  const sessions = (list.data?.sessions ?? []).filter(visibleOnHome)
  if (sessions.length === 0) return tv ? <div className="card home-sess"><Eyebrow>sessions claude code</Eyebrow><div className="home-sess-empty">aucune session ouverte</div></div> : null

  function open(s: LiveSession) {
    if (tv) return
    try { sessionStorage.setItem('deepLinkTarget', s.sessionId) } catch { /* stockage indisponible */ }
    navigate('lanceur')
  }
  const size = format === 'short' ? 44 : format === 'long' ? 64 : 52

  return (
    <div className={`card home-sess fmt-${format} ${tv ? 'tv' : ''}`}>
      <Eyebrow>sessions claude code</Eyebrow>
      <div className="home-sess-row">
        {sessions.map((s) => {
          const g = glyphState(s)
          return (
            <button key={s.sessionId} type="button" className={`home-sess-cell st-${g}`} title={`${displayName(s)} — ${stateLabel(s)}`}
              style={s.meta.color ? ({ '--sc': s.meta.color } as React.CSSProperties) : undefined} onClick={() => open(s)}>
              <span className="cs-glyph-wrap"><SessionGlyph meta={s.meta} fallback={s.repo ?? s.name} state={g} size={size} /></span>
              {format !== 'short' && (
                <span className="home-sess-txt">
                  <b>{displayName(s)}</b>
                  <i>{stateLabel(s)}{format === 'long' && s.repo ? ` · ${s.repo}` : ''}</i>
                  {format === 'long' && (s.last_claude || s.last_user) && (
                    <em>{s.last_claude || s.last_user}{s.last_at ? <small> {fmtClock(s.last_at)}</small> : null}</em>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
