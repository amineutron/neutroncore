import { useEffect, useState, useSyncExternalStore } from 'react'
import { confirmDialog } from '../lib/dialog'
import { offlineLabel, pendingLabel } from '../lib/offline/format'
import { applyRegistration, NO_SW_KEY } from '../lib/offline/register'
import { network, offline, startOffline, OFFLINE_ENABLED } from '../lib/offline/runtime'
import { checkForUpdate } from '../lib/offline/update'
import './offline.css'

const NOTE_MS = 9_000
const UPDATE_CHECK_MS = 600_000

function noSw(): boolean {
  try { return localStorage.getItem(NO_SW_KEY) === '1' } catch { return false }
}

/**
 * Bandeau unique : hors ligne (age des donnees, actions en attente), resultat de la
 * resynchronisation, et nouvelle version. A monter une fois dans App, avec le BUILD_ID.
 */
export default function OfflineBanner({ buildId }: { buildId: string }) {
  const snap = useSyncExternalStore(offline.subscribe, offline.getSnapshot)
  const [now, setNow] = useState(() => Date.now())
  const [update, setUpdate] = useState(false)

  useEffect(() => {
    if (!OFFLINE_ENABLED) return
    const stop = startOffline()
    void applyRegistration({
      sw: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
      secure: window.isSecureContext,
      base: import.meta.env.BASE_URL,
      buildId,
      demo: false,
      disabled: noSw(),
      caches: 'caches' in window ? window.caches : undefined,
    })
    const check = () => { void checkForUpdate(fetch.bind(window), import.meta.env.BASE_URL, buildId).then((u) => u && setUpdate(true)) }
    check()
    const t = setInterval(check, UPDATE_CHECK_MS)
    const unsub = network.subscribe(() => { if (network.state() === 'online') check() })
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { stop(); clearInterval(t); unsub(); document.removeEventListener('visibilitychange', onVisible) }
  }, [buildId])

  // l'age affiche avance seul ; le marqueur global grise l'ecran tant que c'est du cache
  const isOff = snap.net === 'offline'
  useEffect(() => {
    if (isOff) document.documentElement.setAttribute('data-offline', '1')
    else document.documentElement.removeAttribute('data-offline')
    if (!isOff) return
    const t = setInterval(() => setNow(Date.now()), 30_000)
    setNow(Date.now())
    return () => clearInterval(t)
  }, [isOff])

  // le compte rendu de resynchronisation se retire seul
  const noteAt = snap.lastFlush?.at
  useEffect(() => {
    if (!noteAt) return
    const t = setTimeout(() => offline.dismissNote(), NOTE_MS)
    return () => clearTimeout(t)
  }, [noteAt])

  async function discard() {
    const ok = await confirmDialog({
      title: 'abandonner les actions en attente ?',
      body: 'elles ne seront jamais envoyées.',
      ok: 'abandonner',
      danger: true,
    })
    if (ok) offline.discardQueue()
  }

  const f = snap.lastFlush
  const lost = f ? f.rejected + f.expired : 0
  return (
    <div className="ofl" role="status" aria-live="polite">
      {isOff && (
        <div className="ofl-bar off">
          <span className="t">
            {offlineLabel(snap.staleSince, now)}
            {snap.pending > 0 && ` · ${pendingLabel(snap.pending)}`}
          </span>
          <button type="button" className="btn" onClick={() => void network.probeNow()}>réessayer</button>
          {snap.pending > 0 && <button type="button" className="btn" onClick={() => void discard()}>abandonner</button>}
        </div>
      )}
      {!isOff && snap.pending > 0 && (
        <div className="ofl-bar warn">
          <span className="t">{pendingLabel(snap.pending)} — envoi dès que possible</span>
        </div>
      )}
      {f && (
        <div className={`ofl-bar ${lost > 0 ? 'warn' : 'ok'}`}>
          <span className="t">
            reconnecté{f.done > 0 && ` — ${f.done} action${f.done > 1 ? 's' : ''} rejouée${f.done > 1 ? 's' : ''}`}
            {lost > 0 && ` — ${lost} abandonnée${lost > 1 ? 's' : ''} (refusée${lost > 1 ? 's' : ''} ou trop ancienne${lost > 1 ? 's' : ''})`}
          </span>
        </div>
      )}
      {update && (
        <div className="ofl-bar">
          <span className="t">nouvelle version disponible</span>
          <button type="button" className="btn sm solid" onClick={() => location.reload()}>recharger</button>
        </div>
      )}
    </div>
  )
}
