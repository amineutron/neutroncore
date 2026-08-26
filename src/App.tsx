import { createContext, useEffect, useRef, useState } from 'react'
import { getApiKey, setApiKey, apiGet } from './lib/api'
import { applySettings, getSettings } from './lib/settings'
import { LyraPanel } from './components/LyraPanel'
import { BootSplash } from './components/BootSplash'
import { WelcomeBack } from './components/WelcomeBack'
import { Tour, tourSeen, markTourSeen, type TourName } from './components/Tour'
import { Parametres } from './screens/Parametres'
import { Accueil } from './screens/Accueil'
import { Media } from './screens/Media'
import { Demandes } from './screens/Demandes'
import { Downloads } from './screens/Downloads'
import { Taches } from './screens/Taches'
import { Projets } from './screens/Projets'
import { Ambiance } from './screens/Ambiance'
import { Lanceur } from './screens/Lanceur'
import { usePoll } from './lib/poll'
import { Outils } from './screens/Outils'
import { Tests } from './screens/Tests'
import { TvDashboard } from './screens/TvDashboard'

export type ScreenId = 'accueil' | 'films' | 'demandes' | 'dl' | 'taches' | 'projets' | 'ambiance' | 'lanceur' | 'outils' | 'tests' | 'parametres'

// Permet aux écrans (tuiles de l'accueil...) de naviguer vers un autre onglet
export const NavContext = createContext<(s: ScreenId) => void>(() => {})

const NAV: { group: string; items: { id: ScreenId; label: string }[] }[] = [
  { group: 'pilotage', items: [{ id: 'accueil', label: 'accueil' }, { id: 'taches', label: 'tâches' }, { id: 'projets', label: 'projets' }] },
  { group: 'média', items: [{ id: 'films', label: 'films & séries' }, { id: 'demandes', label: 'demandes' }, { id: 'dl', label: 'téléchargements' }] },
  { group: 'maison', items: [{ id: 'ambiance', label: 'ambiance' }, { id: 'lanceur', label: 'lanceur' }] },
  { group: 'système', items: [{ id: 'outils', label: 'outils & vms' }, { id: 'tests', label: 'tests' }, { id: 'parametres', label: 'paramètres' }] },
]

const LAST_VISIT = 'neutroncore_last_visit'
const FORCE_INTRO = 'neutroncore_force_intro'   // rejeu demande depuis les reglages
const ABSENCE_LONGUE = 4 * 3600 * 1000          // au-dela : sequence complete

type Intro = { kind: 'boot' | 'welcome' | null; awayMs: number }

/** Quelle intro jouer a cette ouverture ? Marque la visite au passage. */
function pickIntro(): Intro {
  const s = getSettings()
  const last = Number(localStorage.getItem(LAST_VISIT) || 0)
  const awayMs = last ? Date.now() - last : 0
  localStorage.setItem(LAST_VISIT, String(Date.now()))

  const forced = localStorage.getItem(FORCE_INTRO)
  if (forced) {
    localStorage.removeItem(FORCE_INTRO)
    return { kind: forced === 'welcome' ? 'welcome' : 'boot', awayMs }
  }
  // premiere ouverture ou longue absence : la sequence complete
  if (!last || awayMs > ABSENCE_LONGUE) return { kind: s.bootAnim ? 'boot' : null, awayMs }
  return { kind: s.welcomeAnim ? 'welcome' : null, awayMs }
}

// Hash du bundle charge — permet de reperer d'un coup d'oeil un appareil
// reste sur une vieille version (PWA/onglet jamais recharge)
export const BUILD_ID =
  (document.querySelector('script[src*="/app/assets/"]') as HTMLScriptElement | null)
    ?.src.match(/index-([\w-]+)\.js/)?.[1] ?? 'dev'

const SCREENS: Record<ScreenId, () => React.JSX.Element> = {
  accueil: Accueil, films: Media, demandes: Demandes, dl: Downloads, taches: Taches,
  projets: Projets, ambiance: Ambiance, lanceur: Lanceur, outils: Outils, tests: Tests, parametres: Parametres,
}

function Setup({ onDone }: { onDone: () => void }) {
  const [key, setKey] = useState('')
  const [err, setErr] = useState('')
  async function test() {
    setApiKey(key)
    try {
      await apiGet('/services')
      onDone()
    } catch {
      setErr('Clé refusée — vérifie ~/.lyra-control.env (LYRA_CONTROL_API_KEY).')
    }
  }
  return (
    <div style={{ maxWidth: 460, margin: '18vh auto', padding: 24 }}>
      <div className="brand" style={{ border: 'none', paddingLeft: 0 }}>
        <img src="/app/logo.svg" width={40} height={40} alt="" />
        <div>
          <div className="wm">neutroncore<i>.app</i></div>
          <div className="sub">amineutron</div>
        </div>
      </div>
      <div className="card">
        <h3>première connexion</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Colle la clé API de lyra-control-api pour relier l'app au PC.
        </p>
        <div className="lyra-input" style={{ margin: 0 }}>
          <input
            type="password" placeholder="clé API" value={key} aria-label="Clé API"
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && test()}
          />
        </div>
        {err && <p style={{ color: 'var(--crit)', fontSize: 12, marginTop: 10 }}>{err}</p>}
        <div style={{ marginTop: 14 }}>
          <button className="btn solid" onClick={test}>connecter</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(() => Boolean(getApiKey()))
  const [screen, setScreen] = useState<ScreenId>(() => {
    const q = new URLSearchParams(window.location.search).get('screen') as ScreenId | null
    return q && NAV.some((g) => g.items.some((i) => i.id === q)) ? q : ((getSettings().startScreen as ScreenId) || 'accueil')
  })
  // lien profond (notification ntfy sur le telephone) : l'app Android recoit l'URL via appUrlOpen
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (!cap?.isNativePlatform?.()) return
    const handle = (url: string) => {
      try {
        const u = new URL(url)
        const sc = u.searchParams.get('screen') as ScreenId | null
        const sid = u.searchParams.get('session')
        if (sid) sessionStorage.setItem('deepLinkTarget', sid)
        if (sc) setScreen(sc)
      } catch { /* url inattendue */ }
    }
    import('@capacitor/app').then(({ App: CapApp }) => {
      // demarrage a froid par le lien : l'URL est dans getLaunchUrl, pas dans l'evenement
      CapApp.getLaunchUrl().then((r) => { if (r?.url) handle(r.url) }).catch(() => { /* pas de lien */ })
      CapApp.addListener('appUrlOpen', ({ url }) => handle(url))
    }).catch(() => { /* plugin absent sur le web */ })
  }, [])
  const [lyraOpen, setLyraOpen] = useState(false)
  const [lyraUnread, setLyraUnread] = useState(0)
  // badge « lanceur » : sessions claude code qui attendent une réponse / actives
  const sessionsBadge = usePoll<{ sessions: { state?: string }[]; waiting: number }>(() => apiGet('/launcher/sessions'), 10000)
  const waitingCount = sessionsBadge.data?.waiting ?? 0
  const activeCount = (sessionsBadge.data?.sessions ?? []).filter((s) => s.state !== 'parked').length
  const [clock, setClock] = useState('')
  const [updateReady, setUpdateReady] = useState(false)
  const [tvMode, setTvMode] = useState(() => localStorage.getItem('neutroncore_tv') === '1')
  const [menuOpen, setMenuOpen] = useState(false)
  // intro (reglable) puis tour de premier lancement
  const [intro] = useState<Intro>(pickIntro)
  const [introOn, setIntroOn] = useState(() => intro.kind !== null)
  const [tourOn, setTourOn] = useState<TourName | null>(
    () => (intro.kind === null && !tourSeen()) ? 'main' : null)

  const nav = (s: ScreenId) => { setScreen(s); setMenuOpen(false) }

  useEffect(() => {
    if (tvMode) document.documentElement.dataset.tv = '1'
    else delete document.documentElement.dataset.tv
    localStorage.setItem('neutroncore_tv', tvMode ? '1' : '0')
  }, [tvMode])

  // auto-détection d'un nouveau build : compare le bundle référencé par
  // l'index frais avec celui réellement chargé
  useEffect(() => {
    const current = (document.querySelector('script[src*="/app/assets/"]') as HTMLScriptElement | null)?.src
    if (!current) return
    const check = async () => {
      try {
        const html = await (await fetch('/app/', { cache: 'no-store' })).text()
        const m = html.match(/\/app\/assets\/index-[\w-]+\.js/)
        if (m && !current.endsWith(m[0].split('/').pop()!)) setUpdateReady(true)
      } catch { /* hors ligne */ }
    }
    const t = setInterval(check, 600000)
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  useEffect(() => {
    applySettings()
    const update = () =>
      setClock(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    update()
    const t = setInterval(update, 15000)
    // scrollbar auto-masquée : classe "scrolling" pendant le défilement
    let hideTimer: ReturnType<typeof setTimeout>
    const onScroll = () => {
      document.documentElement.classList.add('scrolling')
      clearTimeout(hideTimer)
      hideTimer = setTimeout(() => document.documentElement.classList.remove('scrolling'), 900)
    }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      clearInterval(t)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [])

  useEffect(() => {
    if (lyraOpen) setLyraUnread(0)
  }, [lyraOpen])

  // Bouton retour Android (et geste retour du navigateur) : on empile une
  // entrée d'historique par surcouche ouverte, et on la ferme au retour plutôt
  // que de quitter l'application. La coque native délègue à cet historique.
  const overlays = (tourOn ? 1 : 0) + (menuOpen ? 1 : 0) + (lyraOpen ? 1 : 0)
    + (tvMode ? 1 : 0) + (screen !== 'accueil' ? 1 : 0)
  const prevOverlays = useRef(0)
  useEffect(() => {
    if (overlays > prevOverlays.current) history.pushState({ nc: overlays }, '')
    prevOverlays.current = overlays
  }, [overlays])

  useEffect(() => {
    const onPop = () => {
      const modal = document.querySelector('.pre-modal') as HTMLElement | null
      if (modal) { (modal.querySelector('.x') as HTMLElement)?.click(); return }
      if (tourOn) { markTourSeen(); setTourOn(null); setTvMode(false); setMenuOpen(false); return }
      if (menuOpen) { setMenuOpen(false); return }
      if (lyraOpen) { setLyraOpen(false); return }
      if (tvMode) { setTvMode(false); return }
      if (screen !== 'accueil') { setScreen('accueil') }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [tourOn, menuOpen, lyraOpen, tvMode, screen])

  if (!ready) return <Setup onDone={() => setReady(true)} />
  if (introOn) {
    const done = () => { setIntroOn(false); if (!tourSeen()) setTourOn('main') }
    return intro.kind === 'welcome'
      ? <WelcomeBack awayMs={intro.awayMs} onDone={done} />
      : <BootSplash onDone={done} />
  }

  const Screen = SCREENS[screen]
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <NavContext.Provider value={nav}>
    {tourOn && (
      <Tour
        tour={tourOn}
        onScreen={(s) => setScreen(s)}
        onTv={(on) => setTvMode(on)}
        onMenu={(open) => setMenuOpen(open)}
        onSwitch={(t) => setTourOn(t)}
        onDone={() => { markTourSeen(); setTourOn(null) }}
      />
    )}
    <div className="app">
      {menuOpen && <div className="drawer-bg" onClick={() => setMenuOpen(false)} />}
      <nav className={`rail ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src="/app/logo.svg" width={34} height={34} alt="" />
          <div>
            <div className="wm">neutroncore<i>.app</i></div>
            <div className="sub">amineutron</div>
          </div>
        </div>
        <div className="nav">
          {NAV.map((g) => (
            <div className="nav-group" key={g.group}>
              <div className="nav-cap">{g.group}</div>
              {g.items.map((it) => (
                <a key={it.id} className={screen === it.id ? 'on' : ''} onClick={() => nav(it.id)}>
                  <span className="nv">::</span> {it.label}
                  {it.id === 'lanceur' && waitingCount > 0 && <span className="nbadge wait" title={`${waitingCount} session(s) attendent ta réponse`}>{waitingCount}</span>}
                  {it.id === 'lanceur' && waitingCount === 0 && activeCount > 0 && <span className="nbadge" title={`${activeCount} session(s) claude code active(s)`}>{activeCount}</span>}
                </a>
              ))}
            </div>
          ))}
          <div className="nav-cap" style={{ marginTop: 14, opacity: 0.6 }}>build {BUILD_ID}</div>
        </div>
      </nav>

      <LyraPanel
        hidden={!lyraOpen}
        floating
        onClose={() => setLyraOpen(false)}
        onUnread={() => { if (!lyraOpen) setLyraUnread((n) => n + 1) }}
      />
      <button
        className={`lyra-fab ${lyraUnread > 0 && !lyraOpen && ['shake', 'ring'].includes(getSettings().lyraAnim) ? `anim-${getSettings().lyraAnim}` : ''}`}
        aria-label="Chat Lyra"
        onClick={() => setLyraOpen((v) => !v)}
      >
        <span className="core" />
        {lyraUnread > 0 && !lyraOpen && <span className="lyra-badge">{lyraUnread}</span>}
      </button>
      {lyraUnread > 0 && !lyraOpen && getSettings().lyraScreenFx && <div className="screen-fx" />}
      {lyraUnread > 0 && !lyraOpen && getSettings().lyraAnim === 'toast' && (
        <div className="lyra-toast" onClick={() => setLyraOpen(true)}>
          <b>lyra</b>
          {lyraUnread} nouveau{lyraUnread > 1 ? 'x' : ''} message{lyraUnread > 1 ? 's' : ''} — toucher pour ouvrir
        </div>
      )}

      <div className="main">
        <div className="topbar">
          {!tvMode && (
            <button className="menu-btn" aria-label="Menu de navigation" onClick={() => setMenuOpen(true)}>
              <i /><i /><i />
            </button>
          )}
          <span className="crumb">neutroncore / <b>{NAV.flatMap((g) => g.items).find((i) => i.id === screen)?.label}</b></span>
          <span className="grow" />
          {updateReady && (
            <button className="btn sm solid" onClick={() => location.reload()}>
              nouvelle version — recharger
            </button>
          )}
          <button data-tour="tv" className={`btn sm ${tvMode ? 'solid' : ''}`} onClick={() => setTvMode((v) => !v)}>
            {tvMode ? 'quitter télé' : 'télé'}
          </button>
          <span className="clock"><b>{clock}</b> · {date}</span>
        </div>
        <section className="content on">
          {tvMode ? <TvDashboard /> : <Screen />}
        </section>
      </div>

    </div>
    </NavContext.Provider>
  )
}
