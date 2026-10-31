// Console des VMs de demonstration : memes noms que /services/vms (system.ts).
// Les snapshots se creent et se suppriment en memoire jusqu'au rechargement.
// A enregistrer : ...vmsConsole dans src/mock/routes.ts (voir INTEGRATION.md).
import type { MockHandler } from '../router'

type Snap = { name: string; depth: number }
const snaps: Record<string, Snap[]> = {
  'fedora-test': [{ name: 'base', depth: 0 }, { name: 'avant-maj', depth: 1 }],
  'debian-lab': [], 'win-sandbox': [],
}
let jobs: Record<string, unknown>[] = []

// Reglages modifiables en memoire (POST /vms-console/:vm/edit) jusqu'au rechargement
const conf: Record<string, { vcpus: number; memory_mib: number; autostart: boolean }> = {}
const confOf = (vm: string) => (conf[vm] ??= { vcpus: 4, memory_mib: 8192, autostart: false })

const DETAIL = (vm: string) => {
  const c = confOf(vm)
  const ram = `${Math.floor(c.memory_mib / 1024)}G`
  const autostart = c.autostart ? 'activer' : 'desactiver'
  return {
    success: true, error: null,
    detail: { state: vm === 'fedora-test' ? 'actif' : 'ferme', kind: 'VM standard', storage: 'local', ip: vm === 'fedora-test' ? '192.168.122.50' : 'Non assignee',
      ssh: vm === 'fedora-test' ? 'OK' : 'N/A', uuid: '752b8686-fbd9-4dfa-9e01-bc1138449b9d', os_type: 'hvm', vcpus: c.vcpus, ram, memory_mib: c.memory_mib,
      disk_used: '52G', disk_total: '80.000 GiB', persistent: 'oui', autostart, autostart_on: c.autostart, snapshot_count: (snaps[vm] ?? []).length },
    settings: { current: { vcpus: c.vcpus, ram, memory_mib: c.memory_mib, autostart_on: c.autostart, disk_used: '52G', disk_total: '80.000 GiB',
        storage: 'local', persistent: 'oui', autostart },
      editable: true, fields: ['vcpus', 'memory_mib', 'autostart', 'description'],
      limits: { vcpus: [1, 32], memory_mib: [512, 65536], description: 256 }, needs_stop: ['vcpus', 'memory_mib'],
      not_editable: 'disque et reseau ne se changent pas ici (le reseau se choisit au clonage)' },
  }
}

const startJob = (action: string, vm: string, message: string) => {
  const id = Math.random().toString(16).slice(2, 14)
  jobs = [{ id, action, vm, status: 'ok', message, error: null, started: Date.now() / 1000 - 3, ended: Date.now() / 1000 }, ...jobs].slice(0, 20)
  return { success: true, job: id }
}

export const vmsConsole: [string, string, MockHandler][] = [
  ['GET', '/vms-console/token', () => ({ token: 'demo' })],
  ['GET', '/vms-console/catalogue', () => ({
    exec: [{ id: 'uptime', label: 'temps de marche', command: 'uptime' }, { id: 'disque', label: 'espace disque', command: 'df -h /' }],
    export_modes: ['classic', 'exam'], destructive: ['snapshot_restore', 'snapshot_delete', 'destroy'],
    archives: [{ name: 'fedora-test-export-20261001-classic.tar.gz', size: 4_200_000_000, mtime: 1_790_000_000 }],
  })],
  ['GET', '/vms-console/jobs', () => ({ jobs })],
  ['GET', '/vms-console/:vm/snapshots', ({ params }) => ({ success: true, error: null, snapshots: snaps[params.vm] ?? [] })],
  ['POST', '/vms-console/:vm/snapshots', ({ params, body }) => {
    snaps[params.vm] = [...(snaps[params.vm] ?? []), { name: String((body as { name: string }).name), depth: 0 }]
    return startJob('snapshot_create', params.vm, 'snapshot cree')
  }],
  ['DELETE', '/vms-console/:vm/snapshots/:snap', ({ params }) => {
    snaps[params.vm] = (snaps[params.vm] ?? []).filter((s) => s.name !== params.snap)
    return startJob('snapshot_delete', params.vm, 'snapshot supprime')
  }],
  ['POST', '/vms-console/:vm/snapshots/:snap/restore', ({ params }) => startJob('snapshot_restore', params.vm, 'restaure')],
  ['POST', '/vms-console/:vm/clone', ({ params }) => startJob('clone', params.vm, 'clone cree')],
  ['POST', '/vms-console/:vm/export', ({ params }) => startJob('export', params.vm, 'archive creee')],
  ['POST', '/vms-console/:vm/exec', ({ params }) => startJob('exec', params.vm, ' 10:32:01 up 2 days,  load average: 0.10')],
  ['POST', '/vms-console/:vm/edit', ({ params, body }) => {
    const b = body as { vcpus?: number; memory_mib?: number; autostart?: boolean }
    if ((b.vcpus !== undefined || b.memory_mib !== undefined) && params.vm === 'fedora-test') {
      throw new Error('arrete la VM avant de changer le CPU ou la memoire')   // la vm de demo tourne
    }
    conf[params.vm] = { ...confOf(params.vm), ...b }
    return startJob('edit', params.vm, 'parametres modifies')
  }],
  ['POST', '/vms-console/:vm/verify', () => ({ success: true, error: null, report: 'verification rapide : ok (demonstration)' })],
  ['POST', '/vms-console/:vm/destroy', ({ params }) => startJob('destroy', params.vm, 'vm supprimee')],
  ['GET', '/vms-console/:vm', ({ params }) => DETAIL(params.vm)],
]
