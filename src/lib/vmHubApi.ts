import { apiGet, apiPost, apiPut, withConfirm } from './api'
import { usePoll } from './poll'
import { consoleConfirm } from './vmsConsole'
import type { EditResult, HardwarePayload } from './vmHardware'
import type { Overview, VmMeta } from './vmHub'
import type { LibEntry } from './vmLibrary'
import type { TaskJob } from './vmTasks'

// Acces reseau du hub des VMs : lectures (overview, bibliotheque, travaux) et ecritures
// (modele, metadonnees). Toute ecriture destructive passe par le jeton X-Confirm existant.

export type LibraryRes = { success: boolean; entries: LibEntry[]; dists: string[]; images_dir_present: boolean }

export const useOverview = () => usePoll<Overview>(() => apiGet('/vms-console/overview'), 15000)
export const useLibrary = () => usePoll<LibraryRes>(() => apiGet('/vms-console/library'), 120000)
export const useJobs = () => usePoll<{ jobs: TaskJob[] }>(() => apiGet('/vms-console/jobs'), 3000)

export async function setTemplate(vm: string, template: boolean): Promise<void> {
  const h = await consoleConfirm('template', vm)
  await apiPost(`/vms-console/${encodeURIComponent(vm)}/template`, { template }, h)
}

export async function saveMeta(vm: string, patch: Partial<Pick<VmMeta, 'profile' | 'notes'>>): Promise<void> {
  await apiPut(`/vms-console/meta/${encodeURIComponent(vm)}`, patch)
}

export type Power = 'start' | 'stop' | 'force_stop' | 'pause' | 'resume' | 'reboot'
export const POWER_LABEL: Record<Power, { verb: string; toast: string }> = {
  start: { verb: 'démarrer', toast: 'démarrage de' }, stop: { verb: 'arrêter', toast: 'arrêt de' }, force_stop: { verb: 'forcer l\'arrêt', toast: 'arrêt forcé de' },
  pause: { verb: 'mettre en pause', toast: 'mise en pause de' }, resume: { verb: 'reprendre', toast: 'reprise de' }, reboot: { verb: 'redémarrer', toast: 'redémarrage de' },
}

/** Alimentation d'une VM : start, stop, force_stop, pause, resume, reboot (meme route et meme jeton que l'ecran des services). */
export async function powerVm(name: string, action: Power): Promise<void> {
  const res = await apiPost<{ success: boolean; error: string | null }>(
    `/services/vms/${encodeURIComponent(name)}/${action}`, undefined, await withConfirm(`vm_${action}_${name}`))
  if (!res.success) throw new Error(res.error ?? 'échec')
}

const enc = encodeURIComponent

/** Edition materielle etendue ; jeton `vm_edit_<vm>`, seuls les champs modifies dans le corps. */
export async function editHardware(vm: string, payload: HardwarePayload): Promise<EditResult> {
  const res = await apiPost<EditResult>(`/vms-console/${enc(vm)}/edit`, payload, await consoleConfirm('edit', vm))
  if (res && res.success === false) throw new Error(res.error ?? 'échec')
  return res
}

/** Clone lie ou copie integrale ; jeton `vm_clone_<source>` (meme route que useVmOp). */
export async function cloneVm(source: string, body: { new_name: string; linked: boolean; network: string; autostart: boolean }): Promise<void> {
  await apiPost(`/vms-console/${enc(source)}/clone`, body, await consoleConfirm('clone', source))
}

/** Import d'une archive ; jeton `vm_import_<nouveau nom>`. */
export async function importArchive(archive: string, newName: string): Promise<void> {
  await apiPost('/vms-console/import', { archive, new_name: newName, dry_run: false }, await consoleConfirm('import', newName))
}

export type DeployBody = { image: string; name: string; vcpus: number; ram_mb: number; disk_gb: number; network: string; profile: 'normal' | 'examen'; env: unknown }

/** Deploiement depuis la bibliotheque ; jeton `vm_deploy_<nom>` (route a creer avec l'outil MCP de creation). */
export async function deployImage(body: DeployBody): Promise<void> {
  await apiPost('/vms-console/deploy', body, await consoleConfirm('deploy', body.name))
}
