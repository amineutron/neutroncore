import { apiGet, apiPost } from './api'
import type { RunResult } from './routines'

type Status = { running: { id: string } | null; last: (RunResult & { id: string; at: number }) | null }
const POLL_MS = 1500
const MAX_WAIT_MS = 12 * 60_000   // au-delà, on cesse de suivre : l'automatisation continue côté API
const MAX_MISSES = 3              // relevés ratés d'affilée tolérés (coupure réseau passagère)

/** Lance une automatisation à la main et attend sa fin. L'API répond aussitôt et
 * l'exécute en tâche de fond (elle peut durer des minutes) : on suit `running`
 * puis `last`. Lève une erreur lisible si une action échoue ; un 409 remonte tel quel. */
export async function runAutomation(a: { id: string; name: string }): Promise<void> {
  const startedSec = Date.now() / 1000 - 2   // marge : horloges du navigateur et de l'API
  await apiPost(`/automations/${a.id}/run`)
  const started = Date.now()
  let misses = 0
  for (;;) {
    await new Promise((res) => setTimeout(res, POLL_MS))
    let s: Status
    try {
      s = await apiGet<Status>('/automations')
      misses = 0
    } catch {
      if (++misses >= MAX_MISSES) throw new Error('suivi interrompu (API injoignable) — elle continue, voir ses derniers passages')
      continue
    }
    if (s.running?.id === a.id) {
      if (Date.now() - started >= MAX_WAIT_MS) throw new Error('toujours en cours — voir ses derniers passages')
      continue
    }
    // seul un résultat postérieur à ce lancement compte (pas un ancien échec de la même automatisation)
    if (s.last?.id !== a.id || s.last.at < startedSec || s.last.success) return
    const first = s.last.steps.find((x) => !x.ok)
    throw new Error(`${s.last.failed} action(s) en échec${first ? ` — ${first.label} : ${first.error}` : ''}`)
  }
}
