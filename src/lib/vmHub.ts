// Hub des VMs : logique pure (types de machines, provenance, familles, ressources,
// alertes). Aucune dependance React : tout est teste dans vmHub.test.ts.
// Les donnees viennent de GET /vms-console/overview (voir lyra-control-api).

export type Rel = 'cow' | 'copy' | 'image' | 'import'
export type LineageEntry = { id: string; rel: Rel; ext?: boolean }
export type Kind = 'tpl' | 'cow' | 'copy' | 'own'
export type VmState = 'running' | 'stopped' | 'paused' | 'starting' | 'unknown'

export type VmMeta = {
  profile: 'normal' | 'examen'
  template: boolean
  origin: 'own' | 'copy' | 'cow'
  base: string | null
  from: string | null
  lineage: LineageEntry[]
  notes: string
  /** « mon environnement » choisi au deploiement : enregistre dans la fiche, pas encore applique dans la machine */
  env?: unknown
}
export type HubVm = {
  name: string
  state: VmState
  status: string
  vcpus: number | null
  ram_mb: number | null
  disk_used_gb: number | null
  disk_total_gb: number | null
  ip: string | null
  snapshot_count: number | null
  meta: VmMeta
  /** charge instantanee 0..100, fournie par le releve de ressources quand il existe */
  cpu_pct?: number | null
  mem_pct?: number | null
}
export type Host = { cpu: number; ram_mb: number; pool_gb: number; pool_used_gb: number }
/** Ce que l'API renvoie : chaque mesure peut manquer (lecture impossible). */
export type HostRaw = { [K in keyof Host]: Host[K] | null }
export const normHost = (h: HostRaw): Host => ({ cpu: h.cpu ?? 0, ram_mb: h.ram_mb ?? 0, pool_gb: h.pool_gb ?? 0, pool_used_gb: h.pool_used_gb ?? 0 })
export type Archive = { name: string; size: number; mtime: number }
export type Overview = {
  success: boolean; error: string | null; stale: boolean
  host: HostRaw; vms: HubVm[]; archives: Archive[]
}

export const KIND_LABEL: Record<Kind, string> = {
  tpl: 'modèle', cow: 'clone lié (COW)', copy: 'copie intégrale', own: 'autonome',
}
export const REL_LABEL: Record<Rel, string> = {
  cow: 'clone lié', copy: 'copie intégrale', image: 'image déployée', import: 'archive importée',
}

export const EMPTY_META: VmMeta = { profile: 'normal', template: false, origin: 'own', base: null, from: null, lineage: [], notes: '' }

export function kindOf(v: Pick<HubVm, 'meta'>): Kind {
  const m = v.meta
  if (m.template) return 'tpl'
  if (m.base) return 'cow'
  return m.origin === 'copy' ? 'copy' : 'own'
}

export const isActive = (v: Pick<HubVm, 'state'>): boolean =>
  v.state === 'running' || v.state === 'paused' || v.state === 'starting'

export const byName = (vms: HubVm[]): Map<string, HubVm> => new Map(vms.map((v) => [v.name, v]))

// ---------------------------------------------------------------- provenance

export type ChainNode = { id: string; kind: Kind | null; exists: boolean; ext: boolean; rel: Rel | null; self: boolean }

/** Chaine de la plus ancienne source a la machine. `rel` = lien vers le noeud SUIVANT.
 *  Un ancetre supprime reste dans la chaine (exists=false) : on ne perd jamais l'historique. */
export function chainOf(v: HubVm, vms: HubVm[]): ChainNode[] {
  const idx = byName(vms)
  const nodes: ChainNode[] = v.meta.lineage.map((a) => {
    const x = a.ext ? undefined : idx.get(a.id)
    return { id: a.id, kind: x ? kindOf(x) : null, exists: !!x, ext: !!a.ext, rel: a.rel, self: false }
  })
  nodes.push({ id: v.name, kind: kindOf(v), exists: true, ext: false, rel: null, self: true })
  return nodes
}

/** Parent immediat (clone lie prioritaire sur copie) quand il existe encore. */
export function parentOf(v: HubVm, idx: Map<string, HubVm>): HubVm | null {
  const pid = v.meta.base ?? v.meta.from
  return pid ? idx.get(pid) ?? null : null
}

export const dependents = (vms: HubVm[], name: string): HubVm[] => vms.filter((v) => v.meta.base === name)

// ------------------------------------------------------------------- familles

export type FamNode = { vm: HubVm; cow: FamNode[]; copies: FamNode[] }
export type Families = { templates: FamNode[]; loose: FamNode[] }

/** Arbre des familles : un modele (ou une machine) porte ses clones lies (trait plein)
 *  et ses copies integrales (pointille). Une source disparue ou externe fait de la machine une racine. */
export function buildFamilies(vms: HubVm[]): Families {
  const idx = byName(vms)
  const parent = (v: HubVm): string | null => {
    const p = parentOf(v, idx)
    return p && p.name !== v.name ? p.name : null
  }
  const kids = new Map<string, HubVm[]>()
  for (const v of vms) {
    const p = parent(v)
    if (p) kids.set(p, [...(kids.get(p) ?? []), v])
  }
  const node = (v: HubVm, seen: Set<string>): FamNode => {
    const next = new Set(seen).add(v.name)
    const ch = (kids.get(v.name) ?? []).filter((c) => !next.has(c.name))
    return {
      vm: v,
      cow: ch.filter((c) => c.meta.base === v.name).map((c) => node(c, next)),
      copies: ch.filter((c) => c.meta.base !== v.name).map((c) => node(c, next)),
    }
  }
  const roots = vms.filter((v) => parent(v) === null)
  // un cycle (donnees abimees) n'a pas de racine : on ajoute ses membres pour ne rien perdre
  const reached = new Set<string>()
  const walk = (n: FamNode) => { reached.add(n.vm.name); n.cow.forEach(walk); n.copies.forEach(walk) }
  const all = roots.map((r) => node(r, new Set()))
  all.forEach(walk)
  const orphans: FamNode[] = []
  for (const v of vms) {
    if (reached.has(v.name)) continue
    const n = node(v, new Set())
    walk(n)
    orphans.push(n)
  }
  const nodes = [...all, ...orphans]
  return {
    templates: nodes.filter((n) => n.vm.meta.template),
    loose: nodes.filter((n) => !n.vm.meta.template),
  }
}

// ------------------------------------------------------------------ ressources

export type Metric = 'ram' | 'vcpu' | 'disk' | 'load'
export type ResRow = { vm: HubVm; value: number; share: number; active: boolean }
export type Resources = { metric: Metric; cap: number; total: number; rows: ResRow[] }

const num = (x: number | null | undefined): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0)

/** Qui consomme quoi. RAM et vcpu : machines allumees seulement ; disque : tout, un clone lie ne compte
 *  que ses differences ; charge : coeurs reellement occupes (vcpu x charge). */
export function resourceRows(vms: HubVm[], metric: Metric, host: Host): Resources {
  const cap = Math.max(1, { ram: host.ram_mb, vcpu: host.cpu, disk: host.pool_gb, load: host.cpu }[metric])
  const pool = metric === 'disk' ? vms : vms.filter((v) => !v.meta.template)
  const rows = pool.map((vm): ResRow => {
    const active = isActive(vm)
    const value = metric === 'ram' ? (active ? num(vm.ram_mb) : 0)
      : metric === 'vcpu' ? (active ? num(vm.vcpus) : 0)
      : metric === 'disk' ? num(vm.disk_used_gb)
      : (active ? (num(vm.vcpus) * num(vm.cpu_pct)) / 100 : 0)
    return { vm, value, share: value / cap, active }
  }).sort((a, b) => b.value - a.value || a.vm.name.localeCompare(b.vm.name))
  return { metric, cap, total: rows.reduce((s, r) => s + r.value, 0), rows }
}

/** Espace que des copies integrales auraient pris en plus des clones lies. */
export function cowSavings(vms: HubVm[]): number {
  const idx = byName(vms)
  return vms.reduce((s, v) => {
    const base = v.meta.base ? idx.get(v.meta.base) : undefined
    return base ? s + Math.max(0, num(base.disk_used_gb) - num(v.disk_used_gb)) : s
  }, 0)
}

// --------------------------------------------------------------------- alertes

export type Alert = { kind: 'nosnap' | 'pool' | 'orphan' | 'stopped-dep'; vm?: string; text: string }

export function alertsOf(vms: HubVm[], host: Host): Alert[] {
  const out: Alert[] = []
  const idx = byName(vms)
  for (const v of vms) {
    if (v.meta.template) continue
    if (v.state === 'running' && v.snapshot_count === 0) out.push({ kind: 'nosnap', vm: v.name, text: `${v.name} tourne sans aucun snapshot` })
    if (v.meta.base && !idx.has(v.meta.base)) out.push({ kind: 'orphan', vm: v.name, text: `${v.name} dépend de ${v.meta.base}, introuvable` })
  }
  const pct = host.pool_gb > 0 ? host.pool_used_gb / host.pool_gb : 0
  if (pct > 0.8) out.push({ kind: 'pool', text: `stockage à ${Math.round(pct * 100)} %` })
  return out
}

// -------------------------------------------------------------------- modeles

export type Verdict = { ok: true } | { ok: false; reason: string }

export function canMakeTemplate(v: HubVm): Verdict {
  if (v.meta.template) return { ok: false, reason: 'déjà un modèle' }
  if (v.state !== 'stopped') return { ok: false, reason: 'arrête la machine avant d\'en faire un modèle' }
  return { ok: true }
}

export function canUntemplate(vms: HubVm[], name: string): Verdict {
  const dep = dependents(vms, name)
  if (dep.length) return { ok: false, reason: `${dep.length} clone(s) lié(s) en dépendent : ${dep.map((d) => d.name).join(', ')}` }
  return { ok: true }
}

export function canDestroy(vms: HubVm[], name: string): Verdict {
  const dep = dependents(vms, name)
  if (dep.length) return { ok: false, reason: `${dep.length} clone(s) lié(s) en dépendent : ${dep.map((d) => d.name).join(', ')}. Rends-les indépendants ou supprime-les d'abord.` }
  return { ok: true }
}

export const fmtGb = (x: number | null | undefined): string => {
  const n = num(x)
  return `${(Math.round(n * 10) / 10).toLocaleString('fr-FR')} Go`
}
export const fmtMb = (mb: number): string => (mb >= 1000 ? fmtGb(mb / 1000) : `${mb} Mo`)
