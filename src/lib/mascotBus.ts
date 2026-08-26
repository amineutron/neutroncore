// Bus d'activité des mascottes — reflète en direct ce que font les modèles.
// fast = LYRA (llama, dialogue) · slow = EPHAISTOS/HESTIA (qwen coder, outils)
//
// Les états "err" et "attente de réponse" sont COLLANTS : ils restent affichés
// tant qu'ils ne sont pas résolus (nouvelle activité réussie, réponse donnée,
// ou clic sur la mascotte pour acquitter) — l'accueil devient un vrai panneau
// d'information, pas juste une décoration.

export type MascotState = 'idle' | 'busy' | 'work' | 'ok' | 'err' | 'sleep'
export type MascotKind = 'fast' | 'slow'

type Entry = { state: MascotState; reason: string }
type Listener = (kind: MascotKind, state: MascotState) => void

const state: Record<MascotKind, Entry> = {
  fast: { state: 'sleep', reason: '' },
  slow: { state: 'sleep', reason: '' },
}
const listeners = new Set<Listener>()
const timers: Partial<Record<MascotKind, ReturnType<typeof setTimeout>>> = {}
let sleepTimer: ReturnType<typeof setTimeout> | null = null

function emit(kind: MascotKind, s: MascotState, reason = '') {
  state[kind] = { state: s, reason }
  listeners.forEach((l) => l(kind, s))
}

function armSleep() {
  if (sleepTimer) clearTimeout(sleepTimer)
  sleepTimer = setTimeout(() => {
    (['fast', 'slow'] as MascotKind[]).forEach((k) => {
      // ne jamais endormir une erreur ou une attente : l'info doit rester visible
      if (state[k].state === 'idle') emit(k, 'sleep')
    })
  }, 90000)
}

/** Change l'état ; holdMs > 0 = transitoire puis retour à idle (sauf si un
 *  état collant a été posé entre-temps). */
export function setActivity(kind: MascotKind, s: MascotState, holdMs = 0, reason = ''): void {
  if (timers[kind]) clearTimeout(timers[kind])
  emit(kind, s, reason)
  if (holdMs > 0) {
    timers[kind] = setTimeout(() => {
      if (state[kind].state === s) emit(kind, 'idle')
    }, holdMs)
  }
  armSleep()
}

export function getActivity(kind: MascotKind): MascotState {
  return state[kind].state
}

export function getReason(kind: MascotKind): string {
  return state[kind].reason
}

/** Acquitte une erreur ou une attente (clic sur la mascotte). */
export function acknowledge(kind: MascotKind): void {
  if (state[kind].state === 'err' || state[kind].reason) emit(kind, 'idle')
}

export function subscribe(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Mappe un événement du pont Lyra vers les mascottes. */
export function onLyraEvent(ev: Record<string, unknown>): void {
  const type = ev.type as string
  if (type === 'user_text') {
    setActivity('fast', 'busy')
  } else if (type === 'progress') {
    setActivity('slow', 'work')
  } else if (type === 'output') {
    const kind = ev.kind as string
    if (kind === 'tool_call') setActivity('slow', 'work')
    else if (kind === 'tool_result') {
      if (ev.success === false) setActivity('slow', 'err', 0, 'erreur outil — clic pour acquitter')
      else setActivity('slow', 'ok', 4000)
    } else if (kind === 'lyra' || kind === 'lyra_tag') setActivity('fast', 'ok', 4000)
    else if (kind === 'error') setActivity('fast', 'err', 0, 'erreur — clic pour acquitter')
  } else if (type === 'ask') {
    // collant : Lyra attend ta confirmation, l'accueil doit le montrer
    setActivity('fast', 'busy', 0, 'attend ta réponse')
  } else if (type === 'answer_sent') {
    setActivity('fast', 'work')
  } else if (type === 'result') {
    // ne pas écraser une erreur : elle reste visible jusqu'à l'acquittement
    ;(['fast', 'slow'] as MascotKind[]).forEach((k) => {
      if (state[k].state !== 'err') emit(k, 'idle')
    })
    armSleep()
  } else if (type === 'error' || type === 'busy') {
    setActivity('fast', 'err', 0, 'daemon injoignable — clic pour acquitter')
  }
}
