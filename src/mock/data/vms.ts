// Console des VMs de demonstration : memes noms que le hub (vmHub.ts), qui porte l'etat des machines.
// Snapshots (avec snapshot courant), materiel etendu (14 champs du contrat POST /vms-console/{vm}/edit)
// et reglages vivent en memoire jusqu'au rechargement.
import type { MockHandler } from '../router'
import type { Hardware } from '../../lib/vmHardware'
import { addJob, hubVm, jobsView, patchHubVm } from './vmHub'

type Snap = { name: string; depth: number; parent?: string | null }
const snaps: Record<string, Snap[]> = {
  'fedora-test': [{ name: 'base', depth: 0 }, { name: 'avant-maj', depth: 1 }],
  'debian-lab': [], 'win-sandbox': [],
  'fedora-exam-reseaux': [
    { name: 'install-propre', depth: 0 }, { name: 'paquets-de-base', depth: 1 }, { name: 'reseau-configure', depth: 2 },
    { name: 'avant-exam', depth: 3 }, { name: 'exam-jour-1', depth: 4 }, { name: 'exam-jour-1-fin', depth: 5 },
    { name: 'test-dhcp', depth: 3 }, { name: 'dhcp-casse', depth: 4 }, { name: 'avec-docker', depth: 2 }, { name: 'docker-k3s', depth: 3 }],
  'ubuntu-preprod': [{ name: 'base', depth: 0 }, { name: 'avant-maj', depth: 1 }, { name: 'apres-maj', depth: 2 }],
}
// snapshot courant (virsh snapshot-current) : pas forcement le dernier cree
const current: Record<string, string | null> = { 'fedora-test': 'avant-maj', 'fedora-exam-reseaux': 'exam-jour-1', 'ubuntu-preprod': 'apres-maj' }
const snapOf = (vm: string, name: string | null | undefined) => (snaps[vm] ?? []).find((s) => s.name === name)

// ----------------------------------------------------------- materiel
type Conf = { vcpus: number; memory_mib: number; autostart: boolean; description: string; hw: Hardware }
const conf: Record<string, Conf> = {}
const disk = (vm: string, cap: number | null): Hardware['disks'] => [{ target: 'vda', path: `/var/lib/libvirt/images/${vm}.qcow2`, capacity_gb: cap }]
const HW_BIOS = (vm: string, cap: number | null): Hardware => ({ cpu_model: 'host-passthrough', firmware: 'bios', secure_boot: false, tpm: false, boot_order: ['hd', 'cdrom'], display: 'spice', network: 'default', disks: disk(vm, cap), usb: [] })
const HW_UEFI = (vm: string, cap: number | null): Hardware => ({ ...HW_BIOS(vm, cap), cpu_model: 'host-model', firmware: 'uefi', secure_boot: true, tpm: true })
const SPECIAL: Record<string, (vm: string, cap: number | null) => Hardware> = {
  'ubuntu-preprod': (vm, cap) => ({ ...HW_UEFI(vm, cap), usb: ['046d:c52b'] }),
  'kali-pentest': (vm, cap) => ({ ...HW_UEFI(vm, cap), secure_boot: false, display: 'vnc', network: 'isole' }),
  'fedora-exam-reseaux': (vm, cap) => ({ ...HW_BIOS(vm, cap), network: 'isole', boot_order: ['hd'] }),
}
function confOf(vm: string): Conf {
  if (!conf[vm]) {
    const h = hubVm(vm)
    conf[vm] = { vcpus: h?.vcpus ?? 4, memory_mib: h?.ram_mb ?? 8192, autostart: false, description: '', hw: (SPECIAL[vm] ?? HW_BIOS)(vm, h?.disk_total_gb ?? 40) }
  }
  return conf[vm]
}

const FIELDS = ['vcpus', 'memory_mib', 'autostart', 'description', 'cpu_model', 'firmware', 'tpm', 'secure_boot', 'boot_order', 'usb_attach', 'usb_detach', 'display', 'network', 'disk_grow_gb']
const NEEDS_STOP = ['vcpus', 'memory_mib', 'cpu_model', 'firmware', 'tpm', 'secure_boot', 'disk_grow_gb']
const CHOICES = {
  cpu_models: [
    { id: 'host-passthrough', label: 'host-passthrough', hint: 'le processeur réel de l\'hôte : le plus rapide, lié à ce PC' },
    { id: 'host-model', label: 'host-model', hint: 'modèle nommé le plus proche : rapide et tolérant' },
    { id: 'x86-64-v2', label: 'x86-64-v2', hint: 'générique moderne : portable vers d\'autres PC' },
    { id: 'qemu64', label: 'qemu64', hint: 'très ancien : portable partout, lent' },
  ],
  firmware: [{ id: 'bios', label: 'BIOS', hint: 'héritage, pas de secure boot' }, { id: 'uefi', label: 'UEFI', hint: 'standard actuel, requis pour secure boot et Windows 11' }],
  displays: ['spice', 'vnc'], boot_devices: ['hd', 'cdrom', 'network'],
}

const stateOf = (vm: string) => hubVm(vm)?.state ?? (vm === 'fedora-test' ? 'running' : 'stopped')
const DETAIL = (vm: string) => {
  const c = confOf(vm)
  const h = hubVm(vm)
  const ram = `${Math.floor(c.memory_mib / 1024)}G`
  const autostart = c.autostart ? 'activer' : 'desactiver'
  const total = c.hw.disks[0]?.capacity_gb ?? null
  const running = stateOf(vm) === 'running'
  return {
    success: true, error: null,
    detail: { state: running ? 'actif' : 'ferme', kind: 'VM standard', storage: 'local', ip: h?.ip ?? (running ? '192.168.122.50' : 'Non assignee'),
      ssh: running ? 'OK' : 'N/A', uuid: '752b8686-fbd9-4dfa-9e01-bc1138449b9d', os_type: 'hvm', vcpus: c.vcpus, ram, memory_mib: c.memory_mib,
      disk_used: `${h?.disk_used_gb ?? 52}G`, disk_total: total ? `${total.toFixed(3)} GiB` : null, persistent: 'oui', autostart, autostart_on: c.autostart, snapshot_count: (snaps[vm] ?? []).length },
    settings: {
      current: { vcpus: c.vcpus, ram, memory_mib: c.memory_mib, autostart_on: c.autostart, disk_used: `${h?.disk_used_gb ?? 52}G`, disk_total: total ? `${total} GiB` : '-', storage: 'local', persistent: 'oui', autostart, description: c.description },
      editable: true, fields: FIELDS, needs_stop: NEEDS_STOP,
      limits: { vcpus: [1, 32], memory_mib: [512, 65536], description: 256, disk_grow_gb: [1, 2048] },
      hardware: c.hw, choices: CHOICES,
    },
  }
}

type EditBody = Partial<{ vcpus: number; memory_mib: number; autostart: boolean; description: string; cpu_model: string; firmware: 'bios' | 'uefi'; tpm: boolean; secure_boot: boolean; boot_order: string[]; usb_attach: string; usb_detach: string; display: 'spice' | 'vnc'; network: string; disk_grow_gb: number }>
const BOOT_FR: Record<string, string> = { hd: 'disque', cdrom: 'cdrom', network: 'réseau' }

/** Memes regles que l'API : seuls les champs connus, arret requis pour la definition, secure boot avec uefi. */
function applyEdit(vm: string, b: EditBody) {
  const keys = Object.keys(b).filter((k) => FIELDS.includes(k))
  if (!keys.length) throw new Error('aucun champ à modifier')
  const blocked = keys.filter((k) => NEEDS_STOP.includes(k))
  if (blocked.length && stateOf(vm) !== 'stopped') throw new Error(`arrête la machine avant de changer : ${blocked.join(', ')}`)
  if (b.secure_boot === true && b.firmware !== 'uefi') throw new Error('secure_boot exige firmware uefi dans le même envoi')
  if (b.boot_order && (new Set(b.boot_order).size !== b.boot_order.length || !b.boot_order.length)) throw new Error('ordre de démarrage invalide')
  for (const u of [b.usb_attach, b.usb_detach]) if (u !== undefined && !/^[0-9a-f]{4}:[0-9a-f]{4}$/i.test(u)) throw new Error('identifiant usb invalide')
  const c = confOf(vm)
  const changes: string[] = []
  const hw: Hardware = { ...c.hw }
  if (b.vcpus !== undefined) changes.push(`processeurs : ${c.vcpus} → ${b.vcpus}`)
  if (b.memory_mib !== undefined) changes.push(`mémoire : ${c.memory_mib} → ${b.memory_mib} Mio`)
  if (b.autostart !== undefined) changes.push(`démarrage auto ${b.autostart ? 'activé' : 'désactivé'}`)
  if (b.description !== undefined) changes.push('description mise à jour')
  if (b.cpu_model !== undefined) { changes.push(`processeur : ${hw.cpu_model ?? '?'} → ${b.cpu_model}`); hw.cpu_model = b.cpu_model }
  if (b.firmware !== undefined && b.firmware !== hw.firmware) { changes.push(`firmware : ${hw.firmware} → ${b.firmware}`); hw.firmware = b.firmware }
  if (b.tpm !== undefined) { changes.push(`TPM ${b.tpm ? 'ajouté' : 'retiré'}`); hw.tpm = b.tpm }
  if (b.secure_boot !== undefined) { changes.push(`secure boot ${b.secure_boot ? 'activé' : 'désactivé'}`); hw.secure_boot = b.secure_boot }
  if (b.boot_order !== undefined) { changes.push(`démarrage : ${b.boot_order.map((d) => BOOT_FR[d] ?? d).join(' → ')}`); hw.boot_order = [...b.boot_order] }
  if (b.display !== undefined) { changes.push(`affichage : ${hw.display} → ${b.display}`); hw.display = b.display }
  if (b.network !== undefined) { changes.push(`réseau : ${hw.network ?? '?'} → ${b.network}`); hw.network = b.network }
  if (b.usb_attach !== undefined) { changes.push(`USB ${b.usb_attach} branché`); hw.usb = [...new Set([...hw.usb, b.usb_attach.toLowerCase()])] }
  if (b.usb_detach !== undefined) { changes.push(`USB ${b.usb_detach} débranché`); hw.usb = hw.usb.filter((u) => u !== b.usb_detach!.toLowerCase()) }
  if (b.disk_grow_gb !== undefined) {
    const cap = hw.disks[0]?.capacity_gb ?? 0
    changes.push(`disque : ${cap} → ${cap + b.disk_grow_gb} Go`)
    hw.disks = hw.disks.map((d, i) => (i === 0 ? { ...d, capacity_gb: cap + b.disk_grow_gb! } : d))
    patchHubVm(vm, { disk_total_gb: cap + b.disk_grow_gb })
  }
  conf[vm] = { ...c, vcpus: b.vcpus ?? c.vcpus, memory_mib: b.memory_mib ?? c.memory_mib, autostart: b.autostart ?? c.autostart, description: b.description ?? c.description, hw }
  if (b.vcpus !== undefined || b.memory_mib !== undefined) patchHubVm(vm, { ...(b.vcpus !== undefined ? { vcpus: b.vcpus } : {}), ...(b.memory_mib !== undefined ? { ram_mb: b.memory_mib } : {}) })
  const hot = keys.filter((k) => !NEEDS_STOP.includes(k))
  return { ...addJob('edit', vm, changes.join(' ; ')), error: null, needs_restart: blocked.length > 0, hot, changes }
}

const startJob = (action: string, vm: string, message: string) => addJob(action, vm, message)

export const vmsConsole: [string, string, MockHandler][] = [
  ['GET', '/vms-console/token', ({ query }) => {
    // meme garde que le backend : seules les actions du catalogue ont un jeton
    if (!/^vm_(snapshot_create|snapshot_restore|snapshot_delete|clone|export|import|edit|exec|destroy|template|deploy|start|stop|force_stop|pause|resume|reboot)_[A-Za-z0-9_-]+$/.test(query.get('action') ?? '')) throw new Error('Action inconnue')
    return { token: 'demo' }
  }],
  ['GET', '/vms-console/catalogue', () => ({
    exec: [{ id: 'uptime', label: 'temps de marche', command: 'uptime' }, { id: 'disque', label: 'espace disque', command: 'df -h /' }],
    export_modes: ['classic', 'exam'], destructive: ['snapshot_restore', 'snapshot_delete', 'destroy'],
    archives: [{ name: 'fedora-test-export-20261001-classic.tar.gz', size: 4_200_000_000, mtime: 1_790_000_000 }],
  })],
  ['GET', '/vms-console/jobs', () => ({ jobs: jobsView() })],
  ['GET', '/vms-console/:vm/snapshots', ({ params }) => ({ success: true, error: null, snapshots: snaps[params.vm] ?? [], current: snapOf(params.vm, current[params.vm]) ? current[params.vm] : null })],
  ['POST', '/vms-console/:vm/snapshots', ({ params, body }) => {
    const name = String((body as { name: string }).name)
    const parent = snapOf(params.vm, current[params.vm])   // le nouveau snapshot se rattache au courant
    snaps[params.vm] = [...(snaps[params.vm] ?? []), { name, depth: parent ? parent.depth + 1 : 0, parent: parent?.name ?? null }]
    current[params.vm] = name
    return startJob('snapshot_create', params.vm, 'snapshot cree')
  }],
  ['DELETE', '/vms-console/:vm/snapshots/:snap', ({ params }) => {
    const gone = snapOf(params.vm, params.snap)
    snaps[params.vm] = (snaps[params.vm] ?? []).filter((s) => s.name !== params.snap)
    if (current[params.vm] === params.snap) current[params.vm] = gone?.parent ?? null
    return startJob('snapshot_delete', params.vm, 'snapshot supprime')
  }],
  ['POST', '/vms-console/:vm/snapshots/:snap/restore', ({ params }) => { current[params.vm] = params.snap; return startJob('snapshot_restore', params.vm, 'restaure') }],
  ['POST', '/vms-console/:vm/clone', ({ params }) => startJob('clone', params.vm, 'clone cree')],
  ['POST', '/vms-console/:vm/export', ({ params }) => startJob('export', params.vm, 'archive creee')],
  ['POST', '/vms-console/:vm/exec', ({ params }) => startJob('exec', params.vm, ' 10:32:01 up 2 days,  load average: 0.10')],
  ['POST', '/vms-console/:vm/edit', ({ params, body }) => applyEdit(params.vm, body as EditBody)],
  ['POST', '/vms-console/:vm/verify', () => ({ success: true, error: null, report: 'verification rapide : ok (demonstration)' })],
  ['POST', '/vms-console/:vm/destroy', ({ params }) => startJob('destroy', params.vm, 'vm supprimee')],
  ['GET', '/vms-console/:vm', ({ params }) => DETAIL(params.vm)],
]
