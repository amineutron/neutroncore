// Hub des VMs de demonstration : overview, bibliotheque, travaux avec etapes et journal,
// modeles, clones lies, provenance. Tout vit en memoire jusqu'au rechargement ; aucune donnee reelle
// (adresses en 192.168.122.x seulement, voir scripts/check-demo-bundle.mjs).
import type { MockHandler } from '../router'
import type { HubVm, LineageEntry, VmMeta } from '../../lib/vmHub'
import type { LibEntry } from '../../lib/vmLibrary'

const NOW = () => Date.now() / 1000
const META: VmMeta = { profile: 'normal', template: false, origin: 'own', base: null, from: null, lineage: [], notes: '' }
const vm = (name: string, o: Omit<Partial<HubVm>, 'meta'> & { meta?: Partial<VmMeta> } = {}): HubVm => ({
  name, state: 'stopped', status: 'down', vcpus: 2, ram_mb: 4096, disk_used_gb: 10, disk_total_gb: 40, ip: null, snapshot_count: 0,
  ...o, meta: { ...META, ...(o.meta ?? {}) },
})
const L = (id: string, rel: LineageEntry['rel'], ext = false): LineageEntry => ({ id, rel, ...(ext ? { ext: true } : {}) })
const run = (cpu: number, mem: number) => ({ state: 'running' as const, status: 'up', cpu_pct: cpu, mem_pct: mem })

let vms: HubVm[] = [
  vm('fedora-exam-reseaux', { disk_used_gb: 14.2, snapshot_count: 10, meta: { profile: 'examen', origin: 'copy', from: 'tpl-fedora-43-base', lineage: [L('tpl-fedora-43-base', 'copy')], notes: 'VM du TP réseau. Réseau isolé pendant les épreuves.' } }),
  vm('exam-etudiant-01', { ram_mb: 4096, disk_used_gb: 0.6, meta: { profile: 'examen', base: 'fedora-exam-reseaux', from: 'fedora-exam-reseaux', lineage: [L('tpl-fedora-43-base', 'copy'), L('fedora-exam-reseaux', 'cow')] } }),
  vm('ubuntu-preprod', { ...run(22, 48), vcpus: 4, ram_mb: 8192, disk_used_gb: 31, disk_total_gb: 80, ip: '192.168.122.41', snapshot_count: 3 }),
  vm('debian-sandbox', { ram_mb: 2048, disk_used_gb: 6.3, disk_total_gb: 20, snapshot_count: 1 }),
  vm('kali-pentest', { state: 'paused', status: 'starting', vcpus: 4, ram_mb: 8192, disk_used_gb: 22, disk_total_gb: 60, ip: '192.168.122.77', cpu_pct: 1, mem_pct: 41 }),
  vm('tpl-fedora-43-base', { disk_used_gb: 5.1, disk_total_gb: 30, meta: { template: true, notes: 'Modèle de base : Fedora 43 à jour, outils de dev.' } }),
  vm('tp-linux-01', { ...run(9, 37), disk_used_gb: 0.4, disk_total_gb: 30, ip: '192.168.122.88', meta: { base: 'tpl-fedora-43-base', from: 'tpl-fedora-43-base', lineage: [L('tpl-fedora-43-base', 'cow')] } }),
  vm('tp-linux-02', { disk_used_gb: 0.9, disk_total_gb: 30, meta: { base: 'tpl-fedora-43-base', from: 'tpl-fedora-43-base', lineage: [L('tpl-fedora-43-base', 'cow')] } }),
  vm('fedora-host-clone', { vcpus: 8, ram_mb: 16384, disk_used_gb: 96, disk_total_gb: 200, meta: { origin: 'copy', from: 'système hôte', lineage: [L('système hôte', 'copy', true)], notes: 'Clone du système hôte.' } }),
]
let archives = [
  { name: 'fedora-exam-reseaux-export-20261024-091500-exam.tar.gz', size: 4_100_000_000, mtime: NOW() - 15 * 86400 },
  { name: 'ubuntu-preprod-export-20261012-174200-classic.tar.gz', size: 2_800_000_000, mtime: NOW() - 27 * 86400 },
]

// ----------------------------------------------------------- travaux
type Plan = { n: string; log?: string[] }[]
type DemoJob = {
  id: string; action: string; vm: string; message: string; title: string; kind: string; plan: Plan; startMs: number; durMs: number
}
let jobs: DemoJob[] = []
const KIND: Record<string, string> = { snapshot_create: 'snapshot', snapshot_restore: 'snapshot', snapshot_delete: 'snapshot', clone: 'clone', export: 'export', import: 'import', edit: 'edit', destroy: 'destroy', exec: 'exec', deploy: 'clone', template: 'edit' }
const PLANS: Record<string, Plan> = {
  export: [{ n: 'test pré-export : intégrité du disque et espace libre', log: ['qemu-img check : aucune erreur', 'espace libre suffisant'] }, { n: 'assainissement du disque (virt-sysprep)', log: ['machine-id réinitialisé', 'clés ssh d\'hôte supprimées', 'journaux vidés'] }, { n: 'archivage tar.gz', log: ['tar czf …'] }, { n: 'test post-export : archive valide', log: ['archive lisible'] }],
  import: [{ n: 'pré-test : archive et disque qcow2' }, { n: 'extraction vers le dossier des disques' }, { n: 'définition libvirt, nouvel uuid et mac' }, { n: 'post-test : machine définie, disque ok' }],
  clone: [{ n: 'préparation' }, { n: 'création du disque', log: ['qemu-img create -b …'] }, { n: 'nouvelle identité : uuid, mac, machine-id' }],
  snapshot_restore: [{ n: 'arrêt du domaine' }, { n: 'retour des disques à l\'état du snapshot' }, { n: 'domaine prêt' }],
}
const DUR: Record<string, number> = { export: 9000, import: 8000, clone: 5000, snapshot_restore: 4000 }

export function jobTitle(action: string, vmName: string, extra?: string): string {
  switch (action) {
    case 'export': return `Export de ${vmName} · mode ${extra ?? 'normal'}`
    case 'import': return `Import de ${extra ?? 'une archive'} en ${vmName}`
    case 'clone': return `${extra === 'lié' ? 'Clone lié' : 'Copie intégrale'} de ${extra === 'lié' ? '' : ''}${vmName}`.replace('  ', ' ')
    case 'snapshot_create': return `Snapshot de ${vmName}`
    case 'snapshot_restore': return `Restauration d'un snapshot sur ${vmName}`
    case 'snapshot_delete': return `Suppression d'un snapshot de ${vmName}`
    case 'edit': return `Modification de ${vmName}`
    case 'destroy': return `Suppression de ${vmName}`
    case 'deploy': return `Déploiement de ${extra ?? 'une image'} en ${vmName}`
    default: return `${action} : ${vmName}`
  }
}

export function addJob(action: string, vmName: string, message: string, title?: string, durMs?: number): { success: true; job: string } {
  const id = Math.random().toString(16).slice(2, 14)
  const plan = PLANS[action] ?? []
  jobs = [{ id, action, vm: vmName, message, title: title ?? jobTitle(action, vmName), kind: KIND[action] ?? action, plan, startMs: Date.now() - (plan.length ? 0 : 3000), durMs: durMs ?? DUR[action] ?? (plan.length ? 4000 : 1) }, ...jobs].slice(0, 30)
  return { success: true, job: id }
}

export function jobsView() {
  const now = Date.now()
  return jobs.map((j) => {
    const f = Math.min(1, (now - j.startMs) / Math.max(1, j.durMs))
    const done = f >= 1
    const idx = Math.min(j.plan.length - 1, Math.floor(f * j.plan.length))
    const steps = j.plan.map((p, i) => ({ n: p.n, st: done || i < idx ? 'done' : i === idx ? 'run' : 'wait' }))
    const log = j.plan.flatMap((p, i) => (done || i <= idx ? [`[${i + 1}/${j.plan.length}] ${p.n}`, ...(p.log ?? [])] : []))
    return {
      id: j.id, action: j.action, vm: j.vm, status: done ? 'ok' : 'running', message: done ? j.message : null, error: null,
      started: j.startMs / 1000, ended: done ? (j.startMs + j.durMs) / 1000 : null, title: j.title, kind: j.kind, steps, log: done && !log.length ? [j.message] : log,
    }
  })
}

// ----------------------------------------------------------- bibliotheque
const e = (id: string, dist: string, nom: string, ver: string, fmt: LibEntry['fmt'], mb: number, ram: number, disk: number, tags: string[], ui: LibEntry['ui'], pk: string, os: string, src: string, desc: string, pour: string): LibEntry =>
  ({ id, dist, nom, ver, fmt, mb, ram, disk, tags, ui, pk, os, src, desc, pour, cached: false, deployable: true, reason: '' })
const CACHE = new Set(['cirros', 'alpine', 'debian-cloud'])
const CATALOGUE: LibEntry[] = [
  e('cirros', 'cirros', 'CirrOS', '0.6', 'cloud', 21, 256, 2, ['léger'], 'aucune', 'minimal', 'CirrOS 0.6', 'download.cirros-cloud.net', 'Image de test minuscule, utilisée par OpenStack. Parfaite pour essayer snapshots, clones et réseau sans attendre.', 'tester cette interface'),
  e('tinycore', 'tinycore', 'Tiny Core Linux', '15 Core', 'iso', 17, 256, 2, ['léger'], 'aucune', 'minimal', 'Tiny Core Linux 15', 'tinycorelinux.net', 'Un système de 17 Mo qui tourne entièrement en mémoire. Utile pour des tests très légers.', 'démonstrations, tests très légers'),
  e('alpine', 'alpine', 'Alpine Linux 3.22', 'virt (pour VM)', 'iso', 65, 512, 4, ['léger', 'serveur'], 'aucune', 'minimal', 'Alpine Linux 3.22', 'alpinelinux.org', 'Distribution minimale (busybox, musl). L\'édition virt est faite pour les VM et démarre en quelques secondes.', 'services simples, routeur ou pare-feu de TP'),
  e('alpine-std', 'alpine', 'Alpine Linux 3.22', 'standard', 'iso', 220, 512, 4, ['léger', 'serveur'], 'aucune', 'serveur', 'Alpine Linux 3.22', 'alpinelinux.org', 'Édition générale avec plus de pilotes et d\'outils que virt.', 'installation sur matériel ou VM variée'),
  e('debian-cloud', 'debian', 'Debian 12', 'genericcloud', 'cloud', 340, 1024, 10, ['léger', 'serveur'], 'aucune', 'minimal', 'Debian 12', 'cloud.debian.org', 'Disque déjà installé, configuré au premier démarrage par cloud-init (utilisateur, clé ssh). Se déploie en 30 secondes.', 'serveurs de TP, base de modèle'),
  e('vb-debian', 'debian', 'Debian 12', 'virt-builder', 'vb', 250, 1024, 10, ['léger', 'serveur'], 'aucune', 'minimal', 'Debian 12', 'libguestfs.org', 'virt-builder assemble l\'image à la demande et y injecte mot de passe root, clé ssh et nom d\'hôte avant le premier démarrage.', 'machines jetables et reproductibles'),
  e('debian-netinst', 'debian', 'Debian 12', 'netinst (au choix)', 'iso', 650, 2048, 20, ['serveur'], 'aucune', 'au choix', 'Debian 12', 'debian.org', 'Petit installateur qui télécharge le reste : tu choisis toi-même les paquets et l\'environnement de bureau.', 'installation sur mesure'),
  e('debian-gnome', 'debian', 'Debian 12', 'Live GNOME', 'iso', 3000, 4096, 25, ['bureau'], 'GNOME', 'bureau complet', 'Debian 12 (GNOME)', 'debian.org', 'Bureau GNOME complet avec navigateur, bureautique et installateur graphique.', 'poste de travail prêt à l\'emploi'),
  e('debian-kde', 'debian', 'Debian 12', 'Live KDE Plasma', 'iso', 3100, 4096, 25, ['bureau'], 'KDE Plasma', 'bureau complet', 'Debian 12 (KDE)', 'debian.org', 'Bureau KDE Plasma, très personnalisable.', 'poste de travail configurable'),
  e('debian-xfce', 'debian', 'Debian 12', 'Live Xfce', 'iso', 2800, 2048, 20, ['bureau', 'léger'], 'Xfce', 'bureau complet', 'Debian 12 (Xfce)', 'debian.org', 'Bureau Xfce, plus léger en mémoire que GNOME et KDE.', 'bureau fluide sur peu de ressources'),
  e('fedora-cloud', 'fedora', 'Fedora 43', 'Cloud Base', 'cloud', 480, 2048, 15, ['serveur'], 'aucune', 'minimal', 'Fedora Cloud 43', 'download.fedoraproject.org', 'Fedora minimale pré-installée, prête pour cloud-init. Même famille que ton système hôte.', 'tester des paquets et configurations Fedora'),
  e('vb-fedora', 'fedora', 'Fedora 43', 'virt-builder', 'vb', 300, 2048, 15, ['serveur'], 'aucune', 'minimal', 'Fedora 43', 'libguestfs.org', 'Image Fedora assemblée à la demande par virt-builder, avec injection de la clé ssh.', 'base de modèle Fedora'),
  e('fedora-server', 'fedora', 'Fedora 43', 'Server (netinst)', 'iso', 900, 2048, 20, ['serveur'], 'aucune', 'serveur', 'Fedora Server 43', 'fedoraproject.org', 'Installateur réseau de Fedora Server, avec console web Cockpit.', 'serveur Fedora configuré à la main'),
  e('fedora-ws', 'fedora', 'Fedora 43', 'Workstation (GNOME)', 'iso', 2300, 4096, 30, ['bureau'], 'GNOME', 'bureau complet', 'Fedora Workstation 43', 'fedoraproject.org', 'Bureau GNOME complet avec installateur. Lourd, mais idéal pour tester une interface graphique.', 'poste de travail de test'),
  e('fedora-kde', 'fedora', 'Fedora 43', 'KDE Plasma', 'iso', 2400, 4096, 30, ['bureau'], 'KDE Plasma', 'bureau complet', 'Fedora KDE 43', 'fedoraproject.org', 'Fedora avec le bureau KDE Plasma.', 'bureau KDE à jour'),
  e('fedora-xfce', 'fedora', 'Fedora 43', 'Xfce', 'iso', 2000, 2048, 25, ['bureau', 'léger'], 'Xfce', 'bureau complet', 'Fedora Xfce 43', 'fedoraproject.org', 'Fedora avec le bureau Xfce, plus léger.', 'bureau fluide'),
  e('fedora-sway', 'fedora', 'Fedora 43', 'Sway (tuilage)', 'iso', 2000, 2048, 25, ['bureau', 'léger'], 'Sway', 'bureau complet', 'Fedora Sway 43', 'fedoraproject.org', 'Gestionnaire de fenêtres en tuilage Wayland, proche de Hyprland dans l\'esprit : bon point de départ pour retrouver ton environnement.', 'retrouver un bureau en tuilage'),
  e('ubuntu-cloud', 'ubuntu', 'Ubuntu 24.04 LTS', 'cloud image', 'cloud', 600, 2048, 15, ['serveur'], 'aucune', 'minimal', 'Ubuntu Server 24.04', 'cloud-images.ubuntu.com', 'Image officielle Ubuntu LTS pré-installée, configurée par cloud-init.', 'serveurs de pré-production'),
  e('ubuntu-iso', 'ubuntu', 'Ubuntu 24.04 LTS', 'Server (live)', 'iso', 2800, 2048, 20, ['serveur'], 'aucune', 'serveur', 'Ubuntu Server 24.04', 'ubuntu.com', 'Installateur complet d\'Ubuntu Server.', 'installation classique'),
  e('ubuntu-desktop', 'ubuntu', 'Ubuntu 24.04 LTS', 'Desktop (GNOME)', 'iso', 6000, 4096, 30, ['bureau'], 'GNOME', 'bureau complet', 'Ubuntu Desktop 24.04', 'ubuntu.com', 'Bureau GNOME d\'Ubuntu avec ses applications.', 'poste de travail Ubuntu'),
  e('xubuntu', 'ubuntu', 'Ubuntu 24.04 LTS', 'Xubuntu (Xfce)', 'iso', 3900, 2048, 25, ['bureau', 'léger'], 'Xfce', 'bureau complet', 'Xubuntu 24.04', 'xubuntu.org', 'Ubuntu avec le bureau Xfce.', 'bureau léger'),
  e('arch-cloud', 'arch', 'Arch Linux', 'cloud image (basic)', 'cloud', 520, 1024, 10, ['léger'], 'aucune', 'minimal', 'Arch Linux', 'geo.mirror.pkgbuild.com', 'Image Arch minimale prête pour cloud-init. Les paquets (hyprland, quickshell…) viennent directement des dépôts.', 'retrouver ton environnement rapidement'),
  e('arch-iso', 'arch', 'Arch Linux', 'ISO (installation manuelle)', 'iso', 1300, 2048, 20, ['léger'], 'aucune', 'minimal', 'Arch Linux', 'archlinux.org', 'ISO d\'installation avec archinstall. Rien d\'installé par défaut.', 'installation maîtrisée'),
  e('rocky', 'rocky', 'Rocky Linux 9', 'minimal', 'iso', 1700, 2048, 20, ['serveur'], 'aucune', 'minimal', 'Rocky Linux 9', 'rockylinux.org', 'Compatible Red Hat Enterprise Linux, pour s\'entraîner sur cet écosystème.', 'TP de type entreprise'),
  e('kali', 'kali', 'Kali Linux 2026.3', 'installer (Xfce)', 'iso', 4200, 4096, 40, ['bureau', 'sécurité'], 'Xfce', 'bureau complet', 'Kali Linux 2026.3', 'kali.org', 'Outils de test d\'intrusion préinstallés. À isoler du réseau.', 'exercices de sécurité'),
]

// ----------------------------------------------------------- routes
const dependentsOf = (name: string) => vms.filter((v) => v.meta.base === name)
const patch = (name: string, f: (v: HubVm) => HubVm) => { vms = vms.map((v) => (v.name === name ? f(v) : v)) }
const jitter = (x: number | null | undefined, lo: number, hi: number) => Math.max(lo, Math.min(hi, (x ?? 20) + (Math.random() * 8 - 4)))
const fail = (msg: string): never => { throw new Error(msg) }

/** Lecture d'une machine du hub par la console de demo (vms.ts) : memes vcpus, memoire, etat. */
export const hubVm = (name: string): HubVm | undefined => vms.find((v) => v.name === name)
/** Retouche d'une machine du hub par la console de demo (edition des parametres). */
export const patchHubVm = (name: string, p: Partial<Pick<HubVm, 'vcpus' | 'ram_mb' | 'disk_total_gb'>>): void => patch(name, (v) => ({ ...v, ...p }))

// ----------------------------------------------------------- alimentation
const STATUS: Record<HubVm['state'], string> = { running: 'up', stopped: 'down', paused: 'paused', starting: 'starting', unknown: 'unknown' }
const TRANSITION_MS = 2500
const setState = (name: string, state: HubVm['state']) => patch(name, (v) => ({
  ...v, state, status: STATUS[state],
  ip: state === 'stopped' ? null : v.ip ?? `192.168.122.${100 + (name.length * 7) % 100}`,
  ...(state === 'running' ? { cpu_pct: v.cpu_pct ?? 12, mem_pct: v.mem_pct ?? 35 } : {}),
}))
/** Transition visible (etat `starting`) puis etat final : la rangee montre « en cours » comme en vrai. */
const transition = (name: string, to: HubVm['state']) => { setState(name, 'starting'); setTimeout(() => setState(name, to), TRANSITION_MS) }

export function powerDemo(name: string, action: string): { success: boolean; error: string | null } {
  const v = hubVm(name) ?? fail('machine inconnue')
  if (v.meta.template) fail('un modèle ne démarre pas : clone-le ou redeviens machine')
  switch (action) {
    case 'start': if (v.state !== 'stopped') fail('la machine n\'est pas arrêtée'); transition(name, 'running'); break
    case 'stop': if (v.state === 'stopped') fail('déjà arrêtée'); transition(name, 'stopped'); break
    case 'force_stop': if (v.state === 'stopped') fail('déjà arrêtée'); setState(name, 'stopped'); break
    case 'pause': if (v.state !== 'running') fail('seule une machine en marche se met en pause'); setState(name, 'paused'); break
    case 'resume': if (v.state !== 'paused') fail('la machine n\'est pas en pause'); setState(name, 'running'); break
    case 'reboot': if (v.state !== 'running') fail('seule une machine en marche se redémarre'); transition(name, 'running'); break
    default: fail(`action inconnue : ${action}`)
  }
  return { success: true, error: null }
}

export const vmHub: [string, string, MockHandler][] = [
  ['POST', '/services/vms/:vm/:action', ({ params }) => powerDemo(params.vm, params.action)],
  ['GET', '/vms-console/overview', () => {
    vms = vms.map((v) => (v.state === 'running' ? { ...v, cpu_pct: jitter(v.cpu_pct, 2, 85), mem_pct: jitter(v.mem_pct, 15, 88) } : v))
    return { success: true, error: null, stale: false, host: { cpu: 16, ram_mb: 32768, pool_gb: 930, pool_used_gb: vms.reduce((s, v) => s + (v.disk_used_gb ?? 0), 0) + archives.reduce((s, a) => s + a.size / 1e9, 0) }, vms, archives }
  }],
  ['GET', '/vms-console/library', () => ({ success: true, entries: CATALOGUE.map((x) => ({ ...x, cached: CACHE.has(x.id) })), dists: [...new Set(CATALOGUE.map((x) => x.dist))], images_dir_present: true })],
  ['PUT', '/vms-console/meta/:vm', ({ params, body }) => {
    const b = body as Partial<VmMeta>
    patch(params.vm, (v) => ({ ...v, meta: { ...v.meta, ...(b.profile ? { profile: b.profile } : {}), ...(typeof b.notes === 'string' ? { notes: b.notes } : {}) } }))
    return { success: true }
  }],
  ['POST', '/vms-console/:vm/template', ({ params, body }) => {
    const flag = (body as { template: boolean }).template
    const v = vms.find((x) => x.name === params.vm) ?? fail('machine inconnue')
    if (flag && v.state !== 'stopped') fail('arrête la machine avant d\'en faire un modèle')
    if (!flag && dependentsOf(v.name).length) fail(`clones liés : ${dependentsOf(v.name).map((d) => d.name).join(', ')}`)
    patch(v.name, (x) => ({ ...x, meta: { ...x.meta, template: flag } }))
    return { success: true, error: null }
  }],
  ['POST', '/vms-console/:vm/clone', ({ params, body }) => {
    const b = body as { new_name: string; linked: boolean }
    const src = vms.find((x) => x.name === params.vm) ?? fail('machine inconnue')
    if (vms.some((x) => x.name === b.new_name)) fail('ce nom est déjà pris')
    const rel: LineageEntry['rel'] = b.linked ? 'cow' : 'copy'
    vms = [...vms, vm(b.new_name, {
      vcpus: src.vcpus, ram_mb: src.ram_mb, disk_total_gb: src.disk_total_gb, disk_used_gb: b.linked ? 0.2 : src.disk_used_gb,
      meta: { profile: src.meta.profile, origin: b.linked ? 'cow' : 'copy', base: b.linked ? src.name : null, from: src.name, lineage: [...src.meta.lineage, { id: src.name, rel }] },
    })]
    return addJob('clone', src.name, 'clone créé', b.linked ? `Clone lié de ${src.name} en ${b.new_name}` : `Copie intégrale de ${src.name} en ${b.new_name}`)
  }],
  ['POST', '/vms-console/deploy', ({ body }) => {
    const b = body as { image: string; name: string; vcpus: number; ram_mb: number; disk_gb: number; profile: 'normal' | 'examen' }
    const img = CATALOGUE.find((x) => x.id === b.image) ?? fail('image inconnue')
    if (vms.some((x) => x.name === b.name)) fail('ce nom est déjà pris')
    CACHE.add(img.id)
    vms = [...vms, vm(b.name, { vcpus: b.vcpus, ram_mb: b.ram_mb, disk_total_gb: b.disk_gb, disk_used_gb: img.fmt === 'iso' ? 0.1 : Math.round(img.mb * 2.5) / 1000, meta: { profile: b.profile, lineage: [{ id: `${img.nom} ${img.ver}`, rel: 'image', ext: true }] } })]
    return addJob('deploy', b.name, 'machine déployée', `Déploiement de ${img.nom} (${img.ver}) en ${b.name}`, img.cached ? 4000 : 7000)
  }],
  ['POST', '/vms-console/import', ({ body }) => {
    const b = body as { archive: string; new_name: string }
    if (vms.some((x) => x.name === b.new_name)) fail('ce nom est déjà pris')
    const srcName = b.archive.replace(/-export-.*$/, '')
    const src = vms.find((x) => x.name === srcName)
    vms = [...vms, vm(b.new_name, { vcpus: src?.vcpus ?? 2, ram_mb: src?.ram_mb ?? 2048, disk_used_gb: src?.disk_used_gb ?? 5, disk_total_gb: src?.disk_total_gb ?? 20, meta: { origin: 'copy', from: srcName, lineage: [...(src?.meta.lineage ?? []), { id: srcName, rel: 'import' }] } })]
    return addJob('import', b.new_name, 'machine importée', `Import de ${b.archive} en ${b.new_name}`)
  }],
  ['POST', '/vms-console/:vm/export', ({ params, body }) => {
    const mode = String((body as { mode?: string }).mode ?? 'classic')
    const src = vms.find((x) => x.name === params.vm) ?? fail('machine inconnue')
    const d = new Date(), p = (n: number) => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
    archives = [{ name: `${src.name}-export-${stamp}-${mode}.tar.gz`, size: Math.max(3e8, (src.disk_used_gb ?? 1) * 0.55e9), mtime: NOW() }, ...archives]
    return addJob('export', src.name, 'archive créée', `Export de ${src.name} · mode ${mode === 'exam' ? 'examen' : mode === 'classic' ? 'normal' : mode}`)
  }],
  ['POST', '/vms-console/:vm/destroy', ({ params }) => {
    const dep = dependentsOf(params.vm)
    if (dep.length) fail(`${dep.length} clone(s) lié(s) en dépendent : ${dep.map((d) => d.name).join(', ')}`)
    vms = vms.filter((v) => v.name !== params.vm)
    return addJob('destroy', params.vm, 'vm supprimée')
  }],
]
