import { apiGet, apiPost } from './api'
import type { RunResult } from './routines'

type Status = { running: { id: string } | null; last: (RunResult & { id: string }) | null }
const POLL_MS = 1500
const MAX_WAIT_MS = 12 * 60_000   // au-delà, on cesse de suivre : la routine continue côté API

/** Lance une routine et attend sa fin. L'API répond aussitôt et l'exécute en
 * tâche de fond (elle peut durer des minutes) : on suit `running` puis `last`.
 * Lève une erreur lisible si une étape échoue ; un 409 remonte tel quel. */
export async function runRoutine(r: { id: string; name: string }): Promise<void> {
  await apiPost(`/routines/${r.id}/run`)
  const started = Date.now()
  for (;;) {
    await new Promise((res) => setTimeout(res, POLL_MS))
    const s = await apiGet<Status>('/routines')
    if (s.running?.id === r.id && Date.now() - started < MAX_WAIT_MS) continue
    if (s.last?.id !== r.id || s.last.success) return
    const first = s.last.steps.find((x) => !x.ok)
    throw new Error(`${s.last.failed} étape(s) en échec${first ? ` — ${first.label} : ${first.error}` : ''}`)
  }
}
