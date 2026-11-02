import { createContext, useEffect, useRef, useState } from 'react'
import { getApiKey, setApiKey, apiGet, DEMO } from './lib/api'
import { applySettings, getSettings } from './lib/settings'
import { LyraPanel } from './components/LyraPanel'
import { Dialogs } from './components/Dialogs'
import OfflineBanner from './components/OfflineBanner'
import { Palette } from './components/Palette'
import { NotifBell, NotifCenter } from './components/NotifCenter'
import { RappelEnCours } from './components/RappelEnCours'
import { CommandsContext, useCommands, type Shell } from './lib/commands'
import { getFavs } from './lib/palette'
import { canLeave } from './lib/navGuard'
import { EVENT_OUVRIR_NOTIFS } from './lib/resume'
import type { Notif, NotifList } from './lib/notifs'
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
import { Agenda } from './screens/Agenda'
import { Plan } from './screens/Plan'
import { Automations } from './screens/Automations'
import { Atelier } from './screens/Atelier'
import { Camera } from './screens/Camera'
import { Lumiere } from './screens/Lumiere'
import { Mises } from './screens/Mises'
import { Sauvegardes } from './screens/Sauvegardes'
import { Ressources } from './screens/Ressources'
import { Vms } from './screens/Vms'
import { Reseau } from './screens/Reseau'
import { Securite } from './screens/Securite'
import { Dv } from './screens/Dv'
import { MediaMenage } from './screens/MediaMenage'
import { CiDeps } from './screens/CiDeps'
import { Qualite } from './screens/Qualite'
import { Historique } from './screens/Historique'
import { ReveilScreen } from './screens/Reveil'
import { Rampes } from './screens/Rampes'
import { ZonesAudio } from './screens/ZonesAudio'
import { EditeurThemes } from './screens/EditeurThemes'
import { LyraMemoire } from './screens/LyraMemoire'
import { Sandbox } from './screens/Sandbox'
import { Resume } from './screens/Resume'
import { Reglages2 } from './screens/Reglages2'
import Worldmonitor from './screens/Worldmonitor'
import { Cyber } from './screens/Cyber'
import { Minuteurs } from './screens/Minuteurs'
import { MinuteursPuce } from './components/minuteurs/MinuteursPuce'
import { LOG_TARGET } from './lib/nav'
import { buildHubs, hubOf, entryScreen, groupHubs, rememberTab, recalledTab } from './lib/navTree'
import { HubTabs } from './components/HubTabs'
import { DiskPanel } from './components/DiskPanel'
import { ouvrirDisque } from './lib/disque'
import { inspecterCi } from './lib/ci'

export type ScreenId = 'accueil' | 'agenda' | 'automatisations' | 'atelier' | 'camera' | 'lumiere' | 'films' | 'demandes' | 'dl' | 'taches' | 'projets' | 'ambiance' | 'plan' | 'lanceur' | 'outils' | 'tests' | 'parametres'
  | 'mises' | 'sauvegardes' | 'ressources' | 'vms' | 'reseau' | 'securite'
  | 'dv' | 'menage' | 'cideps' | 'qualite' | 'historique' | 'reveil' | 'rampes' | 'zonesaudio'
  | 'themes' | 'lyramemoire' | 'sandbox' | 'resume' | 'reglages2' | 'worldmonitor' | 'cyber' | 'minuteurs'

// Permet aux écrans (tuiles de l'accueil...) de naviguer vers un autre onglet
export const NavContext = createContext<(s: ScreenId) => void>(() => {})

// 11 entrées de menu, chacune avec ses sous-onglets (lib/navTree.ts)
const HUBS = buildHubs<ScreenId>()

const LAST_VISIT = 'neutroncore_last_visit'
const FORCE_INTRO = 'neutroncore_force_intro'   // rejeu demande depuis les reglages
const ABSENCE_LONGUE = 4 * 3600 * 1000          // au-dela : sequence complete

type Intro = { kind: 'boot' | 'welcome' | null; awayMs: number }

/** Quelle intro jouer a cette ouverture ? Marque la visite au passage. */
// Fenêtre ouverte sur la télé par l'API (« afficher neutroncore sur la télé ») : `?tele=1` force le mode télé
// pour CETTE fenêtre seulement, sans toucher au réglage de l'app, et sans animation d'entrée.
const FENETRE_TELE = (() => { try { return new URLSearchParams(window.location.search).get('tele') === '1' } catch { return false } })()

function pickIntro(): Intro {
  if (FENETRE_TELE) return { kind: null, awayMs: 0 }
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
  (document.querySelector(`script[src*="${import.meta.env.BASE_URL}assets/"]`) as HTMLScriptElement | null)
    ?.src.match(/index-([\w-]+)\.js/)?.[1] ?? 'dev'

const SCREENS: Record<ScreenId, () => React.JSX.Element> = {
  accueil: Accueil, agenda: Agenda, automatisations: Automations, atelier: Atelier, camera: Camera, lumiere: Lumiere, films: Media, demandes: Demandes, dl: Downloads, taches: Taches,
  projets: Projets, ambiance: Ambiance, plan: Plan, lanceur: Lanceur, outils: Outils, tests: Tests, parametres: Parametres,
  mises: Mises, sauvegardes: Sauvegardes, ressources: Ressources, vms: Vms, reseau: Reseau, securite: Securite,
  dv: Dv, menage: MediaMenage, cideps: CiDeps, qualite: Qualite, historique: Historique,
  reveil: ReveilScreen, rampes: Rampes, zonesaudio: ZonesAudio,
  themes: EditeurThemes, lyramemoire: LyraMemoire, sandbox: Sandbox, resume: Resume, reglages2: Reglages2,
  worldmonitor: Worldmonitor, cyber: Cyber, minuteurs: Minuteurs,
}

// liste à plat des écrans pour la palette (référence stable)
const SCREEN_LIST = HUBS.flatMap((h) => h.tabs.map((tb) => ({ ...tb, group: h.label })))

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
        <img src={`${import.meta.env.BASE_URL}logo.svg`} width={40} height={40} alt="" />
        <div>
          <div className="wm">neutroncore</div>
          <div className="sub">amineutron</div>
        </div>
      </div>
      <div className="card">
        <h3>première connexion</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Colle la clé API de lyra-control-api pour relier l'app au PC.
        </p>
        <form className="lyra-input" style={{ margin: 0 }} onSubmit={(e) => { e.preventDefault(); void test() }}>
          <input
            type="password" placeholder="clé API" value={key} aria-label="Clé API" autoComplete="off"
            onChange={(e) => setKey(e.target.value)}
          />
        </form>
        {err && <p style={{ color: 'var(--crit)', fontSize: 12, marginTop: 10 }}>{err}</p>}
        <div style={{ marginTop: 14 }}>
          <button className="btn solid" onClick={test}>connecter</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  // en démo, pas de backend donc pas de clé à saisir
  const [ready, setReady] = useState(() => DEMO || Boolean(getApiKey()))
  const [screen, setScreen] = useState<ScreenId>(() => {
    const params = new URLSearchParams(window.location.search)
    // lien profond vers un journal (bouton « journal » d'un échec dans la barre Quickshell)
    const log = params.get('log')
    if (log) sessionStorage.setItem(LOG_TARGET, log)
    const q = params.get('screen') as ScreenId | null
    return q && hubOf(HUBS, q) ? q : ((getSettings().startScreen as ScreenId) || 'accueil')
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
  const sessionsBadge = usePoll<{ sessions: { state?: string; atelier?: string }[]; waiting: number }>(() => apiGet('/launcher/sessions'), 10000)
  const waitingCount = sessionsBadge.data?.waiting ?? 0
  const activeCount = (sessionsBadge.data?.sessions ?? []).filter((s) => s.state !== 'parked' && !s.atelier).length
  const [clock, setClock] = useState('')
  const [tvMode, setTvMode] = useState(() => FENETRE_TELE || localStorage.getItem('neutroncore_tv') === '1')
  const [menuOpen, setMenuOpen] = useState(false)
  // intro (reglable) puis tour de premier lancement
  const [intro] = useState<Intro>(pickIntro)
  const [introOn, setIntroOn] = useState(() => intro.kind !== null)
  const [tourOn, setTourOn] = useState<TourName | null>(
    () => (intro.kind === null && !tourSeen()) ? 'main' : null)

  // un écran avec un brouillon non enregistré peut refuser le départ (lib/navGuard)
  const nav = (s: ScreenId) => { void canLeave().then((ok) => { if (ok) { setScreen(s); setMenuOpen(false) } }) }

  // palette de commandes (Ctrl+K) et centre de notifications
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifs = usePoll<NotifList>(() => apiGet('/notifications?limit=80'), 30000, ready)
  const shell: Shell = {
    screens: SCREEN_LIST,
    go: nav,
    toggleTv: () => { void canLeave().then((ok) => { if (ok) setTvMode((v) => !v) }) },
    openLyra: () => setLyraOpen(true),
    openNotifs: () => setNotifOpen(true),
    startTour: () => setTourOn('main'),
  }
  // scènes et favoris du lanceur : chargés à l'ouverture, ou d'emblée s'il y a des raccourcis à afficher
  const cmds = useCommands(shell, ready && (paletteOpen || getFavs().length > 0), paletteOpen)
  useEffect(() => {
    // pas pendant la saisie de la clé ni l'intro (la palette surgirait après), ni sous un dialogue de confirmation
    if (!ready || introOn) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'k') return
      if (document.querySelector('.pre-modal.nc-dialog')) return
      e.preventDefault()
      setPaletteOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, introOn])
  // le résumé du matin (et d'autres écrans) demandent l'ouverture du centre de notifications par événement
  useEffect(() => {
    const open = () => setNotifOpen(true)
    window.addEventListener(EVENT_OUVRIR_NOTIFS, open)
    return () => window.removeEventListener(EVENT_OUVRIR_NOTIFS, open)
  }, [])
  const openEntry = (n: Notif) => {
    // la session à déplier n'a de sens que si le clic mène au lanceur
    if (n.ref && n.action === 'lanceur') { try { sessionStorage.setItem('deepLinkTarget', n.ref) } catch { /* stockage indisponible */ } }
    setNotifOpen(false)
    if (n.action === 'disque') { ouvrirDisque(n.ref); return }
    if (n.action === 'ci') { void inspecterCi(n); return }
    if (SCREEN_LIST.some((x) => x.id === n.action)) nav(n.action as ScreenId)
  }

  useEffect(() => {
    if (tvMode) document.documentElement.dataset.tv = '1'
    else delete document.documentElement.dataset.tv
    if (!FENETRE_TELE) localStorage.setItem('neutroncore_tv', tvMode ? '1' : '0')
  }, [tvMode])

  // la detection d'un nouveau build vit maintenant dans <OfflineBanner> (comparaison avec l'index frais, sans cache)

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

  // le dernier sous-onglet vu de chaque entrée du menu est rouvert au prochain passage
  useEffect(() => { const h = hubOf(HUBS, screen); if (h) rememberTab(h.id, screen) }, [screen])

  useEffect(() => {
    if (lyraOpen) setLyraUnread(0)
  }, [lyraOpen])

  // Bouton retour Android (et geste retour du navigateur) : on empile une
  // entrée d'historique par surcouche ouverte, et on la ferme au retour plutôt
  // que de quitter l'application. La coque native délègue à cet historique.
  const overlays = (tourOn ? 1 : 0) + (menuOpen ? 1 : 0) + (lyraOpen ? 1 : 0) + (notifOpen ? 1 : 0)
    + (paletteOpen ? 1 : 0)
    + (tvMode ? 1 : 0) + (screen !== 'accueil' ? 1 : 0)
  const prevOverlays = useRef(0)
  useEffect(() => {
    if (overlays > prevOverlays.current) history.pushState({ nc: overlays }, '')
    prevOverlays.current = overlays
  }, [overlays])

  useEffect(() => {
    const onPop = () => {
      // le dialogue de confirmation est au-dessus des autres modales : il se ferme en premier
      const dialog = document.querySelector('.pre-modal.nc-dialog')
      // la palette a sa propre entrée d'historique (comptée dans overlays) : retour = la fermer
      if (!dialog && paletteOpen) { setPaletteOpen(false); return }
      const modal = (dialog ?? document.querySelector('.pre-modal')) as HTMLElement | null
      if (modal) {
        (modal.querySelector('.x') as HTMLElement)?.click()
        // une modale n'a pas d'entrée d'historique à elle : on rend celle que ce
        // retour vient de consommer, sinon la surcouche du dessous perd la sienne
        history.pushState({ nc: 'modal' }, '')
        return
      }
      if (tourOn) { markTourSeen(); setTourOn(null); setTvMode(false); setMenuOpen(false); return }
      if (notifOpen) { setNotifOpen(false); return }
      if (menuOpen) { setMenuOpen(false); return }
      if (lyraOpen) { setLyraOpen(false); return }
      if (tvMode) { setTvMode(false); return }
      if (screen !== 'accueil') {
        // refus de quitter : on rend l'entrée d'historique que ce retour a consommée
        void canLeave().then((ok) => { if (ok) setScreen('accueil'); else history.pushState({ nc: 'guard' }, '') })
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [tourOn, menuOpen, lyraOpen, tvMode, screen, notifOpen, paletteOpen])

  if (!ready) return <Setup onDone={() => setReady(true)} />
  if (introOn) {
    const done = () => { setIntroOn(false); if (!tourSeen()) setTourOn('main') }
    return intro.kind === 'welcome'
      ? <WelcomeBack awayMs={intro.awayMs} onDone={done} />
      : <BootSplash onDone={done} />
  }

  const Screen = SCREENS[screen]
  const hub = hubOf(HUBS, screen)
  const tabLabel = hub?.tabs.find((tb) => tb.id === screen)?.label
  const crumbLabel = hub && hub.tabs.length > 1 && tabLabel !== hub.label ? `${hub.label} / ${tabLabel}` : hub?.label
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <NavContext.Provider value={nav}>
    <CommandsContext.Provider value={{ commands: cmds.commands, run: cmds.run, open: () => setPaletteOpen(true) }}>
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
    {DEMO && (
      <div className="demo-banner" role="status">
        démo · données fictives<span className="demo-long">, aucune action n'est exécutée · le backend lyra-control-api n'est pas encore publié</span> ·{' '}
        <a href="https://github.com/amineutron/neutroncore" target="_blank" rel="noreferrer">code source</a>
      </div>
    )}
    <div className={`app${DEMO ? ' is-demo' : ''}`}>
      {menuOpen && <div className="drawer-bg" onClick={() => setMenuOpen(false)} />}
      <nav className={`rail ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} width={34} height={34} alt="" />
          <div>
            <div className="wm">neutroncore</div>
            <div className="sub">amineutron</div>
          </div>
        </div>
        <div className="nav">
          {groupHubs(HUBS).map((g) => (
            <div className="nav-group" key={g.group}>
              <div className="nav-cap">{g.group}</div>
              {g.hubs.map((h) => (
                <a key={h.id} className={hubOf(HUBS, screen)?.id === h.id ? 'on' : ''} onClick={() => nav(entryScreen(h, recalledTab(h.id)))}>
                  <span className="nv">::</span> {h.label}
                  {h.id === 'dev' && waitingCount > 0 && <span className="nbadge wait" title={`${waitingCount} session(s) attendent ta réponse`}>{waitingCount}</span>}
                  {h.id === 'dev' && waitingCount === 0 && activeCount > 0 && <span className="nbadge" title={`${activeCount} session(s) claude code active(s)`}>{activeCount}</span>}
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
          <span className="crumb">neutroncore / <b>{crumbLabel}</b></span>
          <span className="grow" />
          <button className="pl-open" aria-label="Palette de commandes" onClick={() => setPaletteOpen(true)}>chercher <kbd>ctrl k</kbd></button>
          <MinuteursPuce onOpen={() => nav('minuteurs')} />
          <NotifBell data={notifs.data} open={notifOpen} onToggle={() => setNotifOpen((v) => !v)} />
          <button data-tour="tv" className={`btn sm ${tvMode ? 'solid' : ''}`} onClick={shell.toggleTv}>
            {tvMode ? 'quitter télé' : 'télé'}
          </button>
          <span className="clock"><b>{clock}</b> · {date}</span>
        </div>
        <section className="content on">
          {tvMode ? <TvDashboard /> : (
            <>
              {hub && <HubTabs tabs={hub.tabs} current={screen} onPick={nav} />}
              <Screen />
            </>
          )}
        </section>
      </div>

    </div>
      {notifOpen && <NotifCenter data={notifs.data} onClose={() => setNotifOpen(false)} onOpenEntry={openEntry} onChanged={notifs.refresh} />}
      {paletteOpen && <Palette commands={cmds.commands} loading={cmds.loading} onRun={cmds.run} onClose={() => setPaletteOpen(false)} openNotifs={() => setNotifOpen(true)} />}
      {screen !== 'accueil' && screen !== 'agenda' && <RappelEnCours enabled={ready} />}
      <DiskPanel />
      <OfflineBanner buildId={BUILD_ID} />
      <Dialogs />
    </CommandsContext.Provider>
    </NavContext.Provider>
  )
}
