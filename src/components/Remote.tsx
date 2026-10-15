import { useState } from 'react'
import { apiPost } from '../lib/api'
import { toast } from '../lib/dialog'
import { Card } from './ui'

// Touches acceptées par POST /tv/key (liste fermée côté API : routers/tv.py TV_KEYS)
const ARROWS: Record<string, string> = {
  ArrowUp: 'CursorUp', ArrowDown: 'CursorDown', ArrowLeft: 'CursorLeft', ArrowRight: 'CursorRight',
  Enter: 'Confirm', Backspace: 'Back', Escape: 'Back', ' ': 'Pause', h: 'Home',
}
const NAV = [
  { key: 'Home', label: 'accueil' }, { key: 'Back', label: 'retour' },
  { key: 'Options', label: 'options' }, { key: 'Info', label: 'infos' },
]
const TRANSPORT = [
  { key: 'Rewind', label: '«', aria: 'retour rapide' }, { key: 'Play', label: 'lire', aria: 'lecture' },
  { key: 'Pause', label: 'pause', aria: 'pause' }, { key: 'Stop', label: 'stop', aria: 'arrêt' },
  { key: 'FastForward', label: '»', aria: 'avance rapide' },
]
const SOURCES = ['TV', 'BD', 'GAME', 'SAT/CBL', 'DVD', 'MPLAY']
const APPS = ['plex', 'youtube', 'netflix', 'disney', 'prime']

// Télécommande de la TV (touches JointSpace), entrées du Denon et applications.
// La carte prend le focus : flèches, Entrée, Retour arrière et Espace pilotent la TV.
export function Remote({ source, tvOn, onChange }: { source?: string; tvOn: boolean; onChange: () => void }) {
  const [last, setLast] = useState('')

  async function send(path: string, body: Record<string, string>, label: string) {
    setLast(label)
    try {
      const r = await apiPost<{ success?: boolean; error?: string }>(path, body)
      if (r.success === false) toast(`échec : ${label}${r.error ? ` — ${r.error}` : ''}`, 'crit')
      else if (path !== '/tv/key') onChange()
    } catch (e) {
      toast(`erreur : ${label} — ${(e as Error).message}`, 'crit')
    } finally {
      setTimeout(() => setLast((l) => (l === label ? '' : l)), 220)
    }
  }
  const key = (k: string) => send('/tv/key', { key: k }, k)

  function onKeyDown(e: React.KeyboardEvent) {
    // une touche tapée dans un bouton de la carte garde son rôle natif (Entrée, Espace)
    if (e.target !== e.currentTarget && (e.key === 'Enter' || e.key === ' ')) return
    const k = ARROWS[e.key]
    if (!k || e.repeat) return
    e.preventDefault()
    void key(k)
  }

  const pad = (k: string, label: string, cls: string, aria: string) => (
    <button className={`rc-key ${cls} ${last === k ? 'hit' : ''}`} aria-label={aria} onClick={() => key(k)}>{label}</button>
  )

  return (
    <Card title="télécommande" lite={tvOn ? 'clic dans la carte : flèches du clavier' : 'tv éteinte'}>
      <div className="rc" tabIndex={0} onKeyDown={onKeyDown} aria-label="Télécommande de la TV">
        <div className="rc-pad">
          {pad('CursorUp', '▲', 'up', 'haut')}
          {pad('CursorLeft', '◀', 'left', 'gauche')}
          {pad('Confirm', 'ok', 'ok', 'valider')}
          {pad('CursorRight', '▶', 'right', 'droite')}
          {pad('CursorDown', '▼', 'down', 'bas')}
        </div>
        <div className="rc-side">
          <div className="rc-row">
            {NAV.map((n) => (
              <button key={n.key} className={`btn sm ${last === n.key ? 'solid' : ''}`} onClick={() => key(n.key)}>{n.label}</button>
            ))}
          </div>
          <div className="rc-row">
            {TRANSPORT.map((n) => (
              <button key={n.key} className={`btn sm ${last === n.key ? 'solid' : ''}`} aria-label={n.aria} onClick={() => key(n.key)}>{n.label}</button>
            ))}
          </div>
          <div className="rc-label">applications</div>
          <div className="rc-row">
            {APPS.map((a) => (
              <button key={a} className={`btn sm ${last === a ? 'solid' : ''}`} onClick={() => send('/tv/app', { app: a }, a)}>{a}</button>
            ))}
          </div>
          <div className="rc-label">entrée de l'ampli</div>
          <div className="rc-row">
            {SOURCES.map((s) => (
              <button key={s} className={`btn sm ${source?.toUpperCase() === s ? 'solid' : ''}`}
                onClick={() => send('/tv/source', { source: s }, `entrée ${s}`)}>{s.toLowerCase()}</button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
