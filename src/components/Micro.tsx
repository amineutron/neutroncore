import { useEffect, useRef } from 'react'
import { sendable } from '../lib/micro'
import { useMicro } from './micro/useMicro'

const PANEL = {
  position: 'absolute', left: 0, right: 0, bottom: 'calc(100% + 8px)', zIndex: 5, padding: 12,
  background: 'var(--surface)', border: '1px solid var(--line2)', borderRadius: 12, display: 'grid', gap: 8,
} as const
const NOTE = { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' } as const

// Appui-pour-parler pour le chat Lyra. Maintenir le bouton (ou Espace / Entree) enregistre ; au relachement
// l'audio est transcrit en local, puis le texte est MONTRE dans un encart. Rien ne part vers Lyra avant un
// clic sur « envoyer » : onSend est l'unique sortie. Une commande « /... » dictee est refusee.
export function Micro({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const m = useMicro()
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => { if (m.state === 'review') field.current?.focus() }, [m.state])

  const recording = m.state === 'recording'
  const busy = m.state === 'transcribing'
  const verdict = sendable(m.text)
  const label = !m.supported ? m.unsupportedReason : recording ? 'relâche pour transcrire' : 'maintiens pour parler'

  function confirm() {
    if (!verdict.ok) return
    const text = m.text.trim()
    m.reset()
    onSend(text)
  }

  return (
    <>
      {(m.state === 'review' || m.state === 'error') && (
        <div style={PANEL} role="dialog" aria-label="Dictée vocale">
          {m.state === 'error' ? (
            <>
              <span style={{ ...NOTE, color: 'var(--crit)' }}>{m.error}</span>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn sm" onClick={m.reset}>fermer</button>
              </div>
            </>
          ) : (
            <>
              <span style={NOTE}>vérifie ce que j’ai compris, corrige si besoin, puis envoie</span>
              <input
                ref={field} aria-label="Texte dicté" value={m.text} maxLength={500}
                onChange={(e) => m.setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') m.reset() }}
              />
              {!verdict.ok && <span style={{ ...NOTE, color: 'var(--warn)' }}>{verdict.reason}</span>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn sm" onClick={m.reset}>annuler</button>
                <button className="btn sm solid" disabled={!verdict.ok || disabled} onClick={confirm}>envoyer</button>
              </div>
            </>
          )}
        </div>
      )}
      <button
        className="mic" aria-label="Dictée vocale (maintenir pour parler)" title={label}
        disabled={disabled || busy || !m.supported}
        style={{ background: recording ? 'var(--crit)' : 'var(--surface2)', border: '1px solid var(--line2)', touchAction: 'none', opacity: m.supported ? 1 : 0.45 }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); void m.start() }}
        onPointerUp={m.stop}
        onPointerCancel={m.stop}
        onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); void m.start() } }}
        onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') m.stop() }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {busy ? <span className="tourne" aria-hidden /> : (
          <svg viewBox="0 0 24 24" style={{ fill: recording ? '#fff' : 'var(--muted)' }}>
            <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15zm6-3.5a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93V22h2v-2.57A8 8 0 0 0 20 11.5h-2z" />
          </svg>
        )}
      </button>
    </>
  )
}
