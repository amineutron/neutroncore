import { useEffect, useLayoutEffect, useState } from 'react'
import { getSettings, saveSettings } from '../lib/settings'
import { Mascot, MASCOTS } from './Mascot'
import type { MascotState } from '../lib/mascotBus'

// Tours guidés : un tour d'accueil (4 pages) et un tour des paramètres,
// proposé à la fin du premier. Chaque page a SA mascotte narratrice.
// La zone éclairée est nette : le voile flouté est percé par un masque
// radial centré sur la cible (le flou revient progressivement autour).

export type TourName = 'main' | 'settings'

export type TourStep = {
  target: string | null        // sélecteur CSS de l'élément à éclairer
  targetMobile?: string        // cible de remplacement sous 980px
  title: string
  lines: string[]
  linesMobile?: string[]       // texte adapté au téléphone
  mascot: string               // narratrice de la page (mascotte rapide)
  screen?: 'accueil' | 'parametres'
  tv?: boolean                 // basculer le mode télé pendant l'étape
  menu?: boolean               // ouvrir le tiroir (téléphone uniquement)
  offer?: TourName             // fin de tour : proposer le tour suivant
  picker?: boolean             // étape finale : choix de la mascotte
  hintHelp?: boolean           // met en évidence les boutons ? de la page
  pointer?: boolean            // curseur animé qui va cliquer la cible
}

const isPhone = () => window.innerWidth <= 980

const MAIN: TourStep[] = [
  {
    target: null, mascot: 'spark', hintHelp: true,
    title: 'bienvenue',
    lines: [
      'neutroncore rassemble ton homelab en une seule interface.',
      "Lyra en est le chef d'orchestre : tu lui parles en français, elle choisit le bon modèle, "
      + 'traduit ta phrase en commande, la fait confirmer, puis l\'exécute sur la bonne machine.',
      "Quelques pages pour l'essentiel, et tu pourras revenir ici quand tu veux.",
      'Sur chaque écran, le bouton ? qui clignote à côté du titre explique la page en détail.',
    ],
  },
  {
    target: '.reactor', screen: 'accueil', mascot: 'atom',
    title: "l'accueil",
    lines: [
      "Le réacteur compte les alertes en cours : calme, il n'y a rien à faire.",
      'En dessous, ce qui demande une action et les tuiles qui mènent aux pages.',
      'Le bouton ? en haut détaille tout ça écran par écran.',
    ],
  },
  {
    target: '[data-tour="tv"]', mascot: 'satellite', tv: true, pointer: true,
    title: 'le mode télé',
    lines: [
      'Un affichage dense pensé pour être lu de loin, le matin.',
      'Les sources affichées et leur taille se choisissent dans le panneau latéral.',
      'Ce bouton « télé », en haut à droite, active ce mode — et le même bouton, '
      + 'devenu « quitter télé », te ramène à l\'affichage normal.',
    ],
  },
  {
    target: '.rail .nav a.on', targetMobile: '.rail.open .nav a.on',
    menu: true, screen: 'parametres', mascot: 'fan',
    title: 'les paramètres',
    lines: [
      'Sept thèmes, densité, mascottes, audio : tout est gardé sur cet appareil.',
      "C'est aussi là que se règlent l'animation de lancement et ce tutoriel.",
      'On y fait un tour ensemble ?',
    ],
    linesMobile: [
      'Le bouton en haut à gauche ouvre ce menu : toutes les pages y sont.',
      'Les paramètres gardent thèmes, mascottes et audio sur cet appareil.',
      'On y fait un tour ensemble ?',
    ],
    offer: 'settings',
  },
]

const SETTINGS: TourStep[] = [
  {
    target: '.swatches', screen: 'parametres', mascot: 'pinwheel',
    title: 'les thèmes',
    lines: [
      'Sept ambiances : quatre sombres, trois claires.',
      "Le choix s'applique tout de suite, sans rechargement.",
      'Iron man et matrix changent aussi la couleur des accents.',
    ],
  },
  {
    target: '[data-tour="affichage"]', mascot: 'radar',
    title: "l'affichage",
    lines: [
      "Densité compacte pour voir plus d'informations d'un coup d'oeil.",
      'Écran de démarrage : la page ouverte au lancement.',
      'Juste à côté, le comportement : notifications et rafraîchissement éco.',
    ],
  },
  {
    target: '[data-tour="mascottes"]', mascot: 'firefly',
    title: 'les mascottes',
    lines: [
      'Là, c\'est nous : moi et Ephaistos. Oui, on habite dans ton tableau de bord.',
      'Moi je suis la petite : je bavarde, je comprends tes phrases, je réponds vite. '
      + 'Ephaistos est le grand : il réfléchit plus lentement, mais c\'est lui qui analyse '
      + 'les outils et prépare le travail sérieux.',
      "On ne fait pas semblant : nos humeurs suivent l'activité réelle des deux modèles.",
    ],
  },
  {
    target: '[data-tour="demarrage"]', mascot: 'rocket',
    title: 'démarrage & aide',
    lines: [
      "L'animation de lancement peut rejouer à chaque ouverture, ou pas du tout.",
      'Et ce tutoriel se relance ici quand tu veux.',
      'Dernière chose, et pas la moins amusante...',
    ],
  },
  {
    target: null, mascot: 'dice', picker: true,
    title: 'choisis ta mascotte',
    lines: [
      'Touche une mascotte pour la voir bouger, puis essaie ses humeurs.',
      "Celle que tu adoptes accompagnera Lyra partout dans l'app.",
    ],
  },
]

export const TOURS: Record<TourName, TourStep[]> = { main: MAIN, settings: SETTINGS }

const KEY = 'neutroncore_tour_v1'
export function tourSeen(): boolean { return localStorage.getItem(KEY) === '1' }
export function markTourSeen(): void { localStorage.setItem(KEY, '1') }

type Box = { top: number; left: number; width: number; height: number } | null

const STATES: { s: MascotState; label: string }[] = [
  { s: 'idle', label: 'veille' }, { s: 'busy', label: 'occupée' },
  { s: 'work', label: 'travail' }, { s: 'ok', label: 'réussi' }, { s: 'err', label: 'erreur' },
]

/** Étape finale : galerie des mascottes avec aperçu animé des humeurs. */
function MascotPicker() {
  const [name, setName] = useState(() => getSettings().mascotFast)
  const [state, setState] = useState<MascotState>('busy')
  const [adopted, setAdopted] = useState(false)
  return (
    <div className="tour-picker">
      <div className="mascot-grid">
        {MASCOTS.fast.map((m) => (
          <button
            key={m.name}
            className={`mascot-pick ${m.name === name ? 'on' : ''}`}
            title={m.role}
            onClick={() => { setName(m.name); setAdopted(false) }}
          >
            <Mascot kind="fast" name={m.name} state={m.name === name ? state : 'idle'} size={7} />
            <span>{m.name}</span>
          </button>
        ))}
      </div>
      <div className="mascot-states">
        {STATES.map((st) => (
          <span key={st.s} className={`chip ${st.s === state ? 'gold' : ''}`}
            style={{ cursor: 'pointer' }} onClick={() => setState(st.s)}>
            {st.label}
          </span>
        ))}
        <span className="grow" />
        <button className="btn sm solid"
          onClick={() => { saveSettings({ mascotFast: name }); setAdopted(true) }}>
          {adopted ? 'adoptée' : 'adopter'}
        </button>
      </div>
    </div>
  )
}

export function Tour({ tour, onScreen, onTv, onMenu, onSwitch, onDone }: {
  tour: TourName
  onScreen: (s: 'accueil' | 'parametres') => void
  onTv: (on: boolean) => void
  onMenu: (open: boolean) => void
  onSwitch: (t: TourName) => void
  onDone: () => void
}) {
  const steps = TOURS[tour]
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box>(null)
  const [dir, setDir] = useState<1 | -1>(1)      // sens de navigation (animation)
  const [cursor, setCursor] = useState<'off' | 'start' | 'moving' | 'clicked'>('off')
  const [clickPulse, setClickPulse] = useState(0)   // rejoue l'animation de clic
  const [relayout, setRelayout] = useState(0)       // recalcule le halo apres bascule
  const step = steps[i]
  const last = i === steps.length - 1

  useEffect(() => { setI(0) }, [tour])

  useEffect(() => {
    if (step.screen) onScreen(step.screen)
    // le mode télé n'est PAS active a l'arrivee sur l'etape : c'est le clic
    // du curseur qui l'allume, pour qu'on voie la cause avant l'effet
    if (!step.tv) onTv(false)
    onMenu(Boolean(step.menu) && isPhone())
    document.documentElement.classList.toggle('tour-hint-help', Boolean(step.hintHelp))
    return () => document.documentElement.classList.remove('tour-hint-help')
  }, [i, tour]) // eslint-disable-line react-hooks/exhaustive-deps

  // curseur animé, volontairement lent pour être suivi a l'oeil :
  // il apparait au centre (on le repere), glisse 1.6s vers la cible,
  // puis marque le clic. Total ~3.3s avant l'etat stable.
  useEffect(() => {
    setCursor('off')
    if (!step.pointer) return
    const t1 = setTimeout(() => setCursor('start'), 250)     // apparition
    const t2 = setTimeout(() => setCursor('moving'), 1250)   // depart du trajet
    const t3 = setTimeout(() => {
      setCursor('clicked')
      if (step.tv) {
        onTv(true)                                   // l'ecran bascule au clic
        setTimeout(() => setRelayout((n) => n + 1), 320)  // le bouton a bouge
      }
    }, 2950)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [i, tour]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const place = () => {
      const sel = (isPhone() && step.targetMobile) ? step.targetMobile : step.target
      if (!sel) { setBox(null); return }
      const el = document.querySelector(sel)
      if (!el) { setBox(null); return }
      const r = el.getBoundingClientRect()
      // le mode télé applique un zoom au document : les coordonnées visuelles
      // seraient re-multipliées en les reposant dans le calque, lui aussi zoomé
      const z = parseFloat(getComputedStyle(document.documentElement).zoom || '1') || 1
      const pad = 8
      setBox({
        top: r.top / z - pad, left: r.left / z - pad,
        width: r.width / z + pad * 2, height: r.height / z + pad * 2,
      })
    }
    // amener la cible dans l'écran si elle est plus bas dans la page
    // (cartes des paramètres sur téléphone), puis mesurer
    const bring = () => {
      const sel = (isPhone() && step.targetMobile) ? step.targetMobile : step.target
      const el = sel ? document.querySelector(sel) : null
      if (el) {
        const r = el.getBoundingClientRect()
        // cible haute : la caler en haut pour que la carte (en bas sur
        // téléphone) ne la recouvre pas ; sinon la centrer
        const tall = r.height > window.innerHeight * 0.45
        if (tall || r.top < 70 || r.bottom > window.innerHeight - 70) {
          el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'smooth' })
        }
      }
      place()
    }
    const t = setTimeout(bring, 420)      // laisse l'écran (et le tiroir) s'ouvrir
    const t2 = setTimeout(place, 1100)    // après le défilement doux
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      clearTimeout(t)
      clearTimeout(t2)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [i, tour, relayout]) // eslint-disable-line react-hooks/exhaustive-deps

  const quit = () => { markTourSeen(); onTv(false); onMenu(false); onDone() }

  /** Quitte une etape a bascule en rejouant le clic (sortie du mode), puis agit. */
  const leave = (after: () => void) => {
    if (!(step.tv && step.pointer)) { after(); return }
    setClickPulse((n) => n + 1)                        // le curseur re-clique
    window.setTimeout(() => onTv(false), 400)          // l'affichage revient
    window.setTimeout(after, 1150)                     // puis on change d'etape
  }
  const go = (d: 1 | -1) => leave(() => { setDir(d); setI((n) => n + d) })
  const next = () => (last ? leave(quit) : go(1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave(quit)
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      if (e.key === 'ArrowLeft' && i > 0) go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, last, tour]) // eslint-disable-line react-hooks/exhaustive-deps

  // masque du voile : trou net centré sur la cible, flou progressif autour
  const veilStyle = box ? ({
    '--mx': `${box.left + box.width / 2}px`,
    '--my': `${box.top + box.height / 2}px`,
    '--mw': `${box.width / 2 + 46}px`,
    '--mh': `${box.height / 2 + 46}px`,
  } as React.CSSProperties) : undefined

  const bar = steps.map((_, n) => (n <= i ? '#' : '-')).join('')
  const lines = (isPhone() && step.linesMobile) ? step.linesMobile : step.lines

  return (
    <div className="tour">
      <div className={`tour-veil ${box ? 'masked' : ''}`} style={veilStyle} onClick={quit} />
      {box && (
        <div className="tour-halo" style={{
          top: box.top, left: box.left, width: box.width, height: box.height,
        }} />
      )}
      {step.pointer && box && cursor !== 'off' && (
        <div
          key={clickPulse}
          className={`tour-cursor ${cursor}`}
          style={cursor === 'start'
            ? { top: window.innerHeight / 2, left: window.innerWidth / 2 }
            : { top: box.top + box.height / 2, left: box.left + box.width / 2 }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2l14 9-6 1.5L15 20l-3 1-2.5-7L5 17z" /></svg>
          <span className="ring" />
        </div>
      )}
      <div
        className={`tour-card ${box ? 'anchored' : 'center'}`
          + (box && isPhone() && box.top > window.innerHeight * 0.5 ? ' at-top' : '')
          + (step.picker ? ' wide' : '')}
        style={box ? { top: Math.min(box.top + box.height + 14, window.innerHeight - 240) } : undefined}
      >
        <div key={`${tour}-${i}`} className={`tour-body ${dir > 0 ? 'fwd' : 'back'}`}>
          <div className="tour-head">
            <Mascot kind="fast" name={step.mascot} state={last ? 'ok' : 'busy'} size={7} />
            <b>{step.title}</b>
            <span className="grow" />
            <span className="tour-bar">[{bar}] {i + 1}/{steps.length}</span>
          </div>
          {lines.map((l, n) => (
            <p key={n} className="tour-line" style={{ animationDelay: `${90 + n * 110}ms` }}>{l}</p>
          ))}
          {step.picker && <MascotPicker />}
        </div>
        <div className="tour-actions">
          <button className="btn sm" onClick={() => leave(quit)}>{last ? 'terminer' : 'passer'}</button>
          <span className="grow" />
          {i > 0 && <button className="btn sm" onClick={() => go(-1)}>retour</button>}
          {step.offer ? (
            <button className="btn sm solid" onClick={() => onSwitch(step.offer!)}>voir les paramètres</button>
          ) : (
            <button className="btn sm solid" onClick={next}>{last ? "c'est parti" : 'suivant'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
