import { createContext, useEffect, useMemo, useState } from 'react'
import type { ScreenId } from '../App'
import { apiGet, apiPost, withConfirm } from './api'
import { toast } from './dialog'
import { addLaunch } from './launches'
import { LINKS } from './links'
import type { Command } from './palette'
import { saveSettings, THEMES } from './settings'
import { runAutomation } from './automationRun'
import { commandesMinuteurs } from './minuteursCmd'
import { ouvrirDisque } from './disque'

// Ce que les commandes pilotent dans App (navigation et surcouches)
export type Shell = {
  screens: { id: ScreenId; label: string; group: string }[]
  go: (s: ScreenId) => void
  toggleTv: () => void
  openLyra: () => void
  openNotifs: () => void
  startTour: () => void
}

export type CommandsApi = { commands: Command[]; run: (c: Command) => Promise<void>; open: () => void }
export const CommandsContext = createContext<CommandsApi>({ commands: [], run: async () => {}, open: () => {} })

type Scene = { id: string; name: string; group: string }
type Fav = { name: string; path: string; exists: boolean }
type RoutineRef = { id: string; name: string }
type Dynamic = { scenes: Scene[]; favorites: Fav[]; routines: RoutineRef[] }

// scènes Hue, favoris du lanceur et routines : relus au plus toutes les 5 minutes
const TTL_MS = 300_000
const HUE_ROOM = '81'
let cache: { at: number; data: Dynamic } | null = null

/** À appeler quand une source change (routine créée, renommée, supprimée) : la palette la relira. */
export function invalidateCommands(): void {
  cache = null
}

async function loadDynamic(): Promise<Dynamic> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data
  const [scenes, launcher, routines] = await Promise.allSettled([
    apiGet<{ scenes: Scene[] }>('/hue/scenes'),
    apiGet<{ favorites: Fav[] }>('/launcher'),
    apiGet<{ automations: (RoutineRef & { trigger: { type: string } })[] }>('/automations'),
  ])
  const data: Dynamic = {
    scenes: scenes.status === 'fulfilled' ? scenes.value.scenes.filter((s) => s.group === HUE_ROOM) : [],
    favorites: launcher.status === 'fulfilled' ? launcher.value.favorites.filter((f) => f.exists) : [],
    // seules les routines (déclencheur manuel) se lancent depuis la palette
    routines: routines.status === 'fulfilled' ? routines.value.automations.filter((a) => a.trigger.type === 'manual').map(({ id, name }) => ({ id, name })) : [],
  }
  // une source en panne n'est pas mise en cache : elle reviendra à la prochaine ouverture
  if (scenes.status === 'fulfilled' && launcher.status === 'fulfilled' && routines.status === 'fulfilled') cache = { at: Date.now(), data }
  return data
}

// une action qui répond { success: false } est un échec, pas un succès silencieux
async function act(p: Promise<unknown>): Promise<void> {
  const r = (await p) as { success?: boolean; error?: string; message?: string } | undefined
  if (r && r.success === false) throw new Error(r.error ?? r.message ?? 'refusé par le service')
}

export function buildCommands(shell: Shell, dyn: Dynamic): Command[] {
  const go: Command[] = shell.screens.map((s) => ({
    id: `go:${s.id}`, label: s.label, group: 'aller', keywords: s.group, nav: true, run: () => shell.go(s.id),
  }))
  const display: Command[] = [
    { id: 'tv:toggle', label: 'mode télé', group: 'affichage', keywords: 'grand ecran dashboard', nav: true, run: shell.toggleTv },
    { id: 'lyra:open', label: 'chat lyra', group: 'affichage', keywords: 'assistant parler', nav: true, run: shell.openLyra },
    { id: 'notifs:open', label: 'notifications', group: 'affichage', keywords: 'cloche alertes historique', nav: true, run: shell.openNotifs },
    { id: 'disque:open', label: 'ce qui remplit le disque', group: 'affichage', keywords: 'espace place stockage plein du', nav: true, run: () => ouvrirDisque() },
    { id: 'tour:start', label: 'revoir le tutoriel', group: 'affichage', keywords: 'aide visite', nav: true, run: shell.startTour },
    ...THEMES.map((t): Command => ({
      id: `theme:${t.id}`, label: `thème : ${t.label}`, group: 'affichage', keywords: t.dark ? 'sombre couleurs' : 'clair couleurs',
      run: () => { saveSettings({ theme: t.id }) },
    })),
  ]
  const home: Command[] = [
    ...dyn.routines.map((r): Command => ({
      id: `routine:${r.id}`, label: `routine : ${r.name}`, group: 'maison', keywords: 'enchainement scenario lancer',
      run: () => { toast(`routine « ${r.name} » lancée…`); return runAutomation(r) },
    })),
    ...dyn.scenes.map((s): Command => ({
      id: `scene:${s.id}`, label: `scène : ${s.name}`, group: 'maison', keywords: 'hue lumiere ambiance',
      run: () => act(apiPost('/hue/scene', { scene_id: s.id })),
    })),
    { id: 'hue:off', label: 'lumières : tout éteindre', group: 'maison', keywords: 'hue noir',
      run: () => act(apiPost('/hue/group', { group_id: HUE_ROOM, on: false, brightness: 0 })) },
    { id: 'tv:on', label: 'tv : allumer', group: 'maison', keywords: 'television philips', run: () => act(apiPost('/tv/power', { on: true })) },
    { id: 'tv:off', label: 'tv : éteindre', group: 'maison', keywords: 'television philips veille', run: () => act(apiPost('/tv/power', { on: false })) },
    ...['plex', 'youtube', 'netflix'].map((app): Command => ({
      id: `tvapp:${app}`, label: `tv : ouvrir ${app}`, group: 'maison', keywords: 'application television',
      run: () => act(apiPost('/tv/app', { app })),
    })),
  ]
  const launcher: Command[] = dyn.favorites.flatMap((f): Command[] => [
    { id: `claude:${f.path}`, label: `claude : ${f.name}`, group: 'lanceur', keywords: 'terminal code session lancer',
      run: async () => {
        await act(apiPost('/launcher/claude', { path: f.path }, await withConfirm('launcher_claude')))
        addLaunch({ cwd: f.path, repo: f.name })
        shell.go('lanceur')
      } },
    { id: `folder:${f.path}`, label: `dossier : ${f.name}`, group: 'lanceur', keywords: 'ouvrir fichiers explorateur',
      run: () => act(apiPost('/launcher/open-folder', { path: f.path })) },
  ])
  const links: Command[] = LINKS.map((l) => ({
    id: `link:${l.name}`, label: `ouvrir ${l.name}`, group: 'liens', keywords: 'interface web onglet', nav: true,
    run: () => { window.open(l.url, '_blank', 'noreferrer') },
  }))
  return [...go, ...display, ...home, ...launcher, ...links, ...commandesMinuteurs((s) => shell.go(s))]
}

/** Commandes de la palette. `wanted` : charge scènes et favoris (palette ouverte ou raccourcis à afficher).
 * `opened` : chaque ouverture de la palette relit les sources (cache de 5 min, source en panne retentée). */
export function useCommands(shell: Shell, wanted: boolean, opened: boolean): CommandsApi & { loading: boolean } {
  const [dyn, setDyn] = useState<Dynamic>(() => cache?.data ?? { scenes: [], favorites: [], routines: [] })
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!wanted) return
    let alive = true
    setLoading(true)
    loadDynamic().then((d) => { if (alive) setDyn(d) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false; setLoading(false) }
  }, [wanted, opened])

  // shell est recréé à chaque rendu de App : on ne recalcule que si la liste bouge.
  // Valable tant que ses fonctions n'utilisent que des setters React (aucune lecture d'état).
  const commands = useMemo(() => buildCommands(shell, dyn), [dyn, shell.screens]) // eslint-disable-line react-hooks/exhaustive-deps
  async function run(c: Command) {
    try {
      await c.run()
      if (!c.nav) toast(`fait : ${c.label}`)
    } catch (e) {
      toast(`échec : ${c.label} — ${(e as Error).message}`, 'crit')
    }
  }
  return { commands, run, open: () => {}, loading }
}
