// Lancements Claude Code en cours : entre le clic « lancer claude » / « reprendre »
// et l'apparition de la session dans le registre, l'app n'a aucun signal.
// Ce petit store partagé (Lanceur -> Sessions) permet d'afficher « en route »
// puis une arrivée animée quand la session correspondante apparaît.

export type Launch = {
  id: string          // clé locale
  at: number          // Date.now() du clic
  cwd: string         // dossier lancé
  repo: string        // nom affiché
  sessionId?: string  // reprise : on attend précisément cette session
}

export const LAUNCH_TIMEOUT_MS = 60_000
export const ARRIVAL_MS = 4_500

let pending: Launch[] = []
const subs = new Set<() => void>()

function emit() { subs.forEach((f) => f()) }

export function subscribeLaunches(fn: () => void): () => void {
  subs.add(fn)
  return () => { subs.delete(fn) }
}

export function getLaunches(): Launch[] { return pending }

export function addLaunch(l: Omit<Launch, 'id' | 'at'>): Launch {
  const launch: Launch = { ...l, id: `${l.cwd}:${Date.now()}`, at: Date.now() }
  pending = [...pending, launch]
  emit()
  return launch
}

export function removeLaunch(id: string) {
  if (!pending.some((l) => l.id === id)) return
  pending = pending.filter((l) => l.id !== id)
  emit()
}

/** Une session vivante correspond-elle à un lancement en attente ?
 *  Reprise : même sessionId. Lancement : même dossier et démarrée après le clic
 *  (tolérance 5 s : l'horloge du registre est celle du PC). */
export function matchLaunch(session: { sessionId: string; cwd: string; startedAt: number }, launches: Launch[]): Launch | undefined {
  return launches.find((l) =>
    l.sessionId ? l.sessionId === session.sessionId : (l.cwd === session.cwd && session.startedAt >= l.at - 5000))
}

export function launchExpired(l: Launch, now = Date.now()): boolean {
  return now - l.at > LAUNCH_TIMEOUT_MS
}
