// Reglages persistants (localStorage) — theme, affichage, notifications...

export type Settings = {
  theme: 'neutron' | 'ironman' | 'matrix' | 'midnight' | 'dawn' | 'paper' | 'sky'
  posters: boolean        // afficher les posters dans la recherche de demandes
  notifications: boolean  // notifications navigateur pour Lyra
  compact: boolean        // densite compacte
  ecoPoll: boolean        // rafraichissement ralenti (x3)
  startScreen: string     // ecran affiche au demarrage
  mascots: boolean        // afficher les mascottes (global)
  mascotFastOn: boolean   // mascotte du petit modele (lyra)
  mascotSlowOn: boolean   // mascotte du grand modele (ephaistos/hestia)
  mascotFast: string      // nom de la mascotte rapide
  mascotSlow: string      // nom de la mascotte lente
  lyraAnim: 'pulse' | 'shake' | 'toast' | 'ring'  // animation de notif lyra
  lyraScreenFx: boolean   // en plus : effet sur toute la fenetre (plus voyant)
  mascotSpeed: number     // vitesse d'animation des mascottes (x0.5 a x3)
  audioInput: string      // deviceId micro ('' = defaut systeme)
  audioOutput: string     // deviceId sortie ('' = defaut systeme)
  bootAnim: boolean       // sequence complete (1re ouverture / longue absence)
  welcomeAnim: boolean    // salut court quand on revient peu apres
  sessionBrowserNotif: boolean // notif navigateur quand une session claude attend (capsule bureau sinon)
  homeSessions: boolean   // glyphes des sessions claude code sur l'accueil (mascottes animees selon l'etat)
}

export const THEMES: { id: Settings['theme']; label: string; dark: boolean; sw: [string, string, string] }[] = [
  { id: 'neutron', label: 'neutron', dark: true, sw: ['#0e0a10', '#f6c177', '#eb6f92'] },
  { id: 'ironman', label: 'iron man', dark: true, sw: ['#0d0d0d', '#e04a4a', '#f0a35c'] },
  { id: 'matrix', label: 'matrix', dark: true, sw: ['#050a06', '#4ade80', '#a3e635'] },
  { id: 'midnight', label: 'midnight', dark: true, sw: ['#070b16', '#6ea8fe', '#9d7bf5'] },
  { id: 'dawn', label: 'dawn', dark: false, sw: ['#faf4ed', '#c8851f', '#d4567e'] },
  { id: 'paper', label: 'paper', dark: false, sw: ['#f6f6f4', '#a06a10', '#c04a70'] },
  { id: 'sky', label: 'sky', dark: false, sw: ['#eef4fa', '#1f6fc0', '#7c5cd6'] },
]

const KEY = 'neutroncore_settings'
const DEFAULTS: Settings = {
  theme: 'neutron', posters: true, notifications: true,
  compact: false, ecoPoll: false, startScreen: 'accueil',
  mascots: true, mascotFastOn: true, mascotSlowOn: true,
  mascotFast: 'spark', mascotSlow: 'blob',
  lyraAnim: 'pulse', lyraScreenFx: false,
  mascotSpeed: 1,
  audioInput: '', audioOutput: '',
  bootAnim: true, welcomeAnim: true,
  sessionBrowserNotif: true,
  homeSessions: true,
}

export function getSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(KEY, JSON.stringify(next))
  applySettings(next)
  return next
}

export function applySettings(s: Settings = getSettings()): void {
  const root = document.documentElement
  if (s.theme === 'neutron') delete root.dataset.theme
  else root.dataset.theme = s.theme
  if (s.compact) root.dataset.density = 'compact'
  else delete root.dataset.density
}

export function pollMultiplier(): number {
  return getSettings().ecoPoll ? 3 : 1
}
