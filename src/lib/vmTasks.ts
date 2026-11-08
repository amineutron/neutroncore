// Taches des VMs : les travaux de GET /vms-console/jobs, vus comme des taches bien nommees,
// avec etapes et journal. Pur (vmTasks.test.ts). Le titre vient de l'API (job_title) ;
// `fallbackTitle` couvre une API plus ancienne qui ne l'envoie pas encore.

/** `n` : libelle de l'etape, ou son numero quand le backend ne la nomme pas. */
export type JobStep = { n: string | number; st: 'done' | 'run' | 'wait' }
export const stepLabel = (n: string | number): string => (typeof n === 'number' ? `étape ${n}` : n)
export type TaskJob = {
  id: string; action: string; vm: string; status: 'running' | 'ok' | 'fail'
  message: string | null; error: string | null; started: number; ended: number | null
  title?: string; kind?: string; log?: string[]; steps?: JobStep[]
  /** resultat de l'outil une fois le travail fini (edition : needs_restart, hot, changes, skipped) */
  result?: Record<string, unknown>
}
export type TaskState = 'run' | 'ok' | 'error'
export type TaskFilter = 'toutes' | 'en cours' | 'terminées' | 'échouées'
export const TASK_FILTERS: TaskFilter[] = ['toutes', 'en cours', 'terminées', 'échouées']

export const KIND_LABEL: Record<string, string> = {
  export: 'export', import: 'import', clone: 'clonage', snapshot: 'snapshot', edit: 'modification', destroy: 'suppression', exec: 'commande', deploy: 'déploiement',
}

const ACTION_KIND: Record<string, string> = {
  snapshot_create: 'snapshot', snapshot_restore: 'snapshot', snapshot_delete: 'snapshot',
  clone: 'clone', export: 'export', import: 'import', edit: 'edit', destroy: 'destroy', exec: 'exec', deploy: 'deploy',
}

export const kindOfJob = (j: Pick<TaskJob, 'action' | 'kind'>): string => j.kind ?? ACTION_KIND[j.action] ?? j.action

export function fallbackTitle(j: Pick<TaskJob, 'action' | 'vm'>): string {
  const v = j.vm
  switch (j.action) {
    case 'snapshot_create': return `Snapshot de ${v}`
    case 'snapshot_restore': return `Restauration d'un snapshot sur ${v}`
    case 'snapshot_delete': return `Suppression d'un snapshot de ${v}`
    case 'clone': return `Clonage de ${v}`
    case 'export': return `Export de ${v}`
    case 'import': return `Import de ${v}`
    case 'edit': return `Modification de ${v}`
    case 'destroy': return `Suppression de ${v}`
    case 'exec': return `Commande sur ${v}`
    case 'deploy': return `Déploiement de ${v}`
    default: return `${j.action} : ${v}`
  }
}

export const titleOf = (j: TaskJob): string => (j.title && j.title.trim()) || fallbackTitle(j)

export const stateOf = (j: Pick<TaskJob, 'status'>): TaskState => (j.status === 'running' ? 'run' : j.status === 'ok' ? 'ok' : 'error')

/** Avancement 0..100 : etapes terminees / total quand elles sont connues, sinon null (indetermine). */
export function progressOf(j: Pick<TaskJob, 'status' | 'steps'>): number | null {
  if (j.status !== 'running') return 100
  const s = j.steps ?? []
  if (!s.length) return null
  const done = s.filter((x) => x.st === 'done').length
  const run = s.some((x) => x.st === 'run') ? 0.5 : 0
  return Math.min(99, Math.round(((done + run) / s.length) * 100))
}

export function durationText(j: Pick<TaskJob, 'started' | 'ended'>, now = Date.now() / 1000): string {
  const s = Math.max(0, Math.round((j.ended ?? now) - j.started))
  return s < 1 ? '< 1 s' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}

export function filterTasks(jobs: TaskJob[], f: TaskFilter): TaskJob[] {
  return jobs.filter((j) => f === 'toutes' || (f === 'en cours' && j.status === 'running') || (f === 'terminées' && j.status === 'ok') || (f === 'échouées' && j.status === 'fail'))
}

/** Recentes d'abord ; les taches en cours passent devant. */
export function sortTasks(jobs: TaskJob[]): TaskJob[] {
  return [...jobs].sort((a, b) => (a.status === 'running' ? 0 : 1) - (b.status === 'running' ? 0 : 1) || b.started - a.started)
}

/** Une machine est-elle occupee par une tache en cours ? Renvoie cette tache. */
export const runningFor = (jobs: TaskJob[], vm: string): TaskJob | undefined => jobs.find((j) => j.vm === vm && j.status === 'running')
