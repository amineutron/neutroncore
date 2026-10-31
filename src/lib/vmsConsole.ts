import { useCallback, useState } from 'react'
import { apiDelete, apiGet, apiPost } from './api'
import { confirmDialog, toast } from './dialog'
import type { EditLimits } from './vmsEdit'
import type { Vm } from './vms'

// Console des VMs : logique pure (filtres, noms, libelles) + petit hook d'action.
// Tout ce qui ecrit demande un jeton X-Confirm vm_<action>_<cible> sur
// /vms-console/token, puis rend un `job` suivi par GET /vms-console/jobs.

export type Job = {
  id: string; action: string; vm: string; status: 'running' | 'ok' | 'fail'
  message: string | null; error: string | null; started: number; ended: number | null
}
export type Detail = {
  state?: string; kind?: string; storage?: string; ip?: string; ssh?: string; uuid?: string
  os_type?: string; vcpus?: number | null; ram?: string; disk_used?: string | null; disk_total?: string | null
  persistent?: string; autostart?: string; snapshot_count?: number
}
export type SettingsInfo = {
  current: Record<string, string | number | boolean | null | undefined>
  editable: boolean; fields: string[]; needs_stop: string[]; not_editable: string
  limits: EditLimits
}
export type Snap = { name: string; depth: number }
export type Catalogue = {
  exec: { id: string; label: string; command: string }[]
  export_modes: string[]; destructive: string[]
  archives: { name: string; size: number; mtime: number }[]
}

export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

export function vmName(vm: Pick<Vm, 'name'>): string { return vm.name.replace(/^vm_/, '') }

/** Erreur de saisie d'un nom (VM, snapshot, reseau) ou null ; `taken` = noms deja pris. */
export function nameError(name: string, taken: string[] = []): string | null {
  if (!name) return 'donne un nom'
  if (!NAME_RE.test(name)) return 'lettres, chiffres, - et _ (64 max, pas de - au debut)'
  if (taken.includes(name)) return 'ce nom est deja pris'
  return null
}

export type Filters = { state: 'all' | 'up' | 'down'; q: string }
export const DEFAULT_FILTERS: Filters = { state: 'all', q: '' }
const FILTER_KEY = 'neutroncore_vms_filters'

export function loadFilters(): Filters {
  try {
    const raw = JSON.parse(localStorage.getItem(FILTER_KEY) ?? 'null') as Partial<Filters> | null
    const state = raw?.state === 'up' || raw?.state === 'down' ? raw.state : 'all'
    return { state, q: typeof raw?.q === 'string' ? raw.q : '' }
  } catch { return DEFAULT_FILTERS }
}
export function saveFilters(f: Filters): void {
  try { localStorage.setItem(FILTER_KEY, JSON.stringify(f)) } catch { /* stockage indisponible */ }
}

export function filterVms(vms: Vm[], f: Filters): Vm[] {
  const q = f.q.trim().toLowerCase()
  return vms.filter((v) => {
    if (f.state === 'up' && v.status !== 'up') return false
    if (f.state === 'down' && v.status === 'up') return false
    return !q || vmName(v).toLowerCase().includes(q)
  })
}

const LABELS: Record<string, string> = {
  snapshot_create: 'snapshot', snapshot_restore: 'restauration', snapshot_delete: 'suppression de snapshot',
  clone: 'clonage', edit: 'modification', export: 'export', import: 'import', exec: 'commande', destroy: 'suppression de vm',
}
export function jobLabel(action: string): string { return LABELS[action] ?? action }

export function jobDuration(j: Pick<Job, 'started' | 'ended'>, now = Date.now() / 1000): string {
  const s = Math.max(0, Math.round((j.ended ?? now) - j.started))
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}

export function fmtSize(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} Go`
  if (n >= 1e6) return `${Math.round(n / 1e6)} Mo`
  return `${Math.max(1, Math.round(n / 1e3))} Ko`
}

/** Jeton X-Confirm lie a l'action et a la cible. */
export async function consoleConfirm(action: string, target: string): Promise<Record<string, string>> {
  const t = await apiGet<{ token: string }>(`/vms-console/token?action=${encodeURIComponent(`vm_${action}_${target}`)}`)
  return { 'X-Confirm': t.token }
}

/** Double confirmation d'une action destructive (deux questions distinctes). */
export async function confirmTwice(what: string, detail: string): Promise<boolean> {
  if (!(await confirmDialog({ title: `${what} ?`, body: detail, ok: 'continuer', danger: true }))) return false
  return confirmDialog({ title: 'dernière confirmation', body: `${what} : ${detail}. Cette action est définitive.`, ok: `oui, ${what}`, danger: true })
}

type Verb = 'POST' | 'DELETE'

/** Hook : lance une action d'ecriture et rend l'erreur eventuelle. */
export function useVmOp(onStarted: () => void) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = useCallback(async (verb: Verb, path: string, action: string, target: string, body?: unknown): Promise<boolean> => {
    setBusy(true)
    setErr('')
    try {
      const h = await consoleConfirm(action, target)
      if (verb === 'DELETE') await apiDelete(path, h)
      else await apiPost(path, body, h)
      toast('lancé : voir les travaux ci-dessous')
      onStarted()
      return true
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setBusy(false)
    }
  }, [onStarted])
  return { run, busy, err }
}
