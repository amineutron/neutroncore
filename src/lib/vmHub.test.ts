import { describe, expect, it } from 'vitest'
import {
  alertsOf, buildFamilies, canDestroy, canMakeTemplate, canUntemplate, chainOf, cowSavings, EMPTY_META,
  fmtGb, kindOf, resourceRows, type HubVm, type Host, type VmMeta,
} from './vmHub'

const HOST: Host = { cpu: 16, ram_mb: 32768, pool_gb: 930, pool_used_gb: 100 }
const vm = (name: string, o: Omit<Partial<HubVm>, 'meta'> & { meta?: Partial<VmMeta> } = {}): HubVm => ({
  name, state: 'stopped', status: 'down', vcpus: 2, ram_mb: 4096, disk_used_gb: 10, disk_total_gb: 40, ip: null, snapshot_count: 1,
  ...o, meta: { ...EMPTY_META, ...(o.meta ?? {}) },
})

describe('type de machine', () => {
  it.each([
    [{ template: true }, 'tpl'],
    [{ base: 'x' }, 'cow'],
    [{ origin: 'copy' as const }, 'copy'],
    [{}, 'own'],
    [{ template: true, base: 'x' }, 'tpl'],   // le modele prime
    [{ base: 'x', origin: 'copy' as const }, 'cow'],   // clone lie prime sur copie
  ])('%j -> %s', (meta, kind) => { expect(kindOf(vm('a', { meta }))).toBe(kind) })
})

describe('provenance', () => {
  const tpl = vm('tpl', { meta: { template: true } })
  const exam = vm('exam', { meta: { origin: 'copy', from: 'tpl', lineage: [{ id: 'tpl', rel: 'copy' }] } })
  const stu = vm('stu', { meta: { base: 'exam', from: 'exam', lineage: [{ id: 'tpl', rel: 'copy' }, { id: 'exam', rel: 'cow' }] } })

  it('trois niveaux : de la source la plus ancienne a la machine', () => {
    const c = chainOf(stu, [tpl, exam, stu])
    expect(c.map((n) => n.id)).toEqual(['tpl', 'exam', 'stu'])
    expect(c.map((n) => n.rel)).toEqual(['copy', 'cow', null])
    expect(c.map((n) => n.kind)).toEqual(['tpl', 'copy', 'cow'])
    expect(c[2].self).toBe(true)
  })
  it('un ancetre supprime reste dans la chaine, marque inexistant', () => {
    const c = chainOf(stu, [exam, stu])
    expect(c[0]).toMatchObject({ id: 'tpl', exists: false, kind: null })
    expect(c[1].exists).toBe(true)
  })
  it('une source externe (image, hote) est marquee ext et jamais cherchee dans les machines', () => {
    const v = vm('d', { meta: { lineage: [{ id: 'tpl', rel: 'image', ext: true }] } })
    const c = chainOf(v, [tpl, v])
    expect(c[0]).toMatchObject({ ext: true, exists: false })
  })
  it('sans parent : la chaine ne contient que la machine', () => {
    expect(chainOf(tpl, [tpl]).map((n) => n.id)).toEqual(['tpl'])
  })
})

describe('familles', () => {
  const tpl = vm('tpl', { meta: { template: true } })
  const c1 = vm('c1', { meta: { base: 'tpl', from: 'tpl' } })
  const c2 = vm('c2', { meta: { base: 'tpl', from: 'tpl' } })
  const cp = vm('cp', { meta: { origin: 'copy', from: 'tpl' } })
  const gc = vm('gc', { meta: { base: 'cp', from: 'cp' } })
  const solo = vm('solo')
  const ext = vm('host-clone', { meta: { origin: 'copy', from: 'système hôte' } })

  it('un modele porte ses clones lies et ses copies, recursivement', () => {
    const f = buildFamilies([tpl, c1, c2, cp, gc, solo, ext])
    expect(f.templates).toHaveLength(1)
    const t = f.templates[0]
    expect(t.cow.map((n) => n.vm.name)).toEqual(['c1', 'c2'])
    expect(t.copies.map((n) => n.vm.name)).toEqual(['cp'])
    expect(t.copies[0].cow.map((n) => n.vm.name)).toEqual(['gc'])
  })
  it('une machine seule ou issue d\'une source externe est une racine', () => {
    const f = buildFamilies([tpl, c1, solo, ext])
    expect(f.loose.map((n) => n.vm.name).sort()).toEqual(['host-clone', 'solo'])
  })
  it('une source supprimee fait de la machine une racine', () => {
    const f = buildFamilies([cp])
    expect(f.loose.map((n) => n.vm.name)).toEqual(['cp'])
  })
  it('un cycle dans des donnees abimees ne boucle pas et ne perd aucune machine', () => {
    const a = vm('a', { meta: { base: 'b' } })
    const b = vm('b', { meta: { base: 'a' } })
    const f = buildFamilies([a, b])
    const names = [...f.loose, ...f.templates].flatMap(function walk(n): string[] { return [n.vm.name, ...n.cow.flatMap(walk), ...n.copies.flatMap(walk)] })
    expect(names.sort()).toEqual(['a', 'b'])
  })
  it('une machine ne peut pas etre sa propre source', () => {
    const a = vm('a', { meta: { base: 'a' } })
    expect(buildFamilies([a]).loose[0].cow).toHaveLength(0)
  })
})

describe('ressources par machine', () => {
  const run = (n: string, o: Omit<Partial<HubVm>, 'meta'> = {}) => vm(n, { state: 'running', ...o })
  const list = [
    run('big', { ram_mb: 16384, vcpus: 8, cpu_pct: 50, disk_used_gb: 96 }),
    run('small', { ram_mb: 2048, vcpus: 2, cpu_pct: 10, disk_used_gb: 6 }),
    vm('off', { ram_mb: 8192, vcpus: 4, disk_used_gb: 22 }),
    vm('tpl', { meta: { template: true }, disk_used_gb: 5 }),
  ]
  it('memoire : seules les machines allumees comptent, tri decroissant, part de la capacite', () => {
    const r = resourceRows(list, 'ram', HOST)
    expect(r.rows.map((x) => x.vm.name)).toEqual(['big', 'small', 'off'])
    expect(r.total).toBe(18432)
    expect(r.rows[0].share).toBeCloseTo(0.5)
    expect(r.rows[2].value).toBe(0)
  })
  it('vcpu : un modele n\'est jamais compte', () => {
    expect(resourceRows(list, 'vcpu', HOST).rows.some((x) => x.vm.name === 'tpl')).toBe(false)
  })
  it('disque : tout compte, modeles compris', () => {
    const r = resourceRows(list, 'disk', HOST)
    expect(r.total).toBe(129)
    expect(r.rows.map((x) => x.vm.name)).toEqual(['big', 'off', 'small', 'tpl'])
  })
  it('charge : coeurs occupes = vcpu x charge', () => {
    const r = resourceRows(list, 'load', HOST)
    expect(r.total).toBeCloseTo(8 * 0.5 + 2 * 0.1)
  })
  it('des valeurs absentes ou invalides valent zero, jamais NaN', () => {
    const r = resourceRows([run('x', { ram_mb: null, vcpus: Number.NaN, cpu_pct: undefined })], 'load', HOST)
    expect(r.total).toBe(0)
    expect(r.rows[0].share).toBe(0)
  })
  it('une capacite nulle ne divise pas par zero', () => {
    const r = resourceRows(list, 'ram', { ...HOST, ram_mb: 0 })
    expect(Number.isFinite(r.rows[0].share)).toBe(true)
  })
  it('egalite : ordre alphabetique stable', () => {
    const r = resourceRows([run('b'), run('a')], 'ram', HOST)
    expect(r.rows.map((x) => x.vm.name)).toEqual(['a', 'b'])
  })
})

describe('espace economise par les clones lies', () => {
  it('base moins differences, jamais negatif', () => {
    const tpl = vm('tpl', { disk_used_gb: 5.1, meta: { template: true } })
    const a = vm('a', { disk_used_gb: 0.4, meta: { base: 'tpl' } })
    const b = vm('b', { disk_used_gb: 9, meta: { base: 'tpl' } })   // plus gros que la base : 0
    expect(cowSavings([tpl, a, b])).toBeCloseTo(4.7)
  })
  it('sans clone lie : zero', () => { expect(cowSavings([vm('x')])).toBe(0) })
})

describe('alertes', () => {
  it('machine allumee sans snapshot, stockage presque plein, base introuvable', () => {
    const a = alertsOf([
      vm('r', { state: 'running', snapshot_count: 0 }),
      vm('ok', { state: 'running', snapshot_count: 2 }),
      vm('o', { meta: { base: 'gone' } }),
    ], { ...HOST, pool_used_gb: 800 })
    expect(a.map((x) => x.kind).sort()).toEqual(['nosnap', 'orphan', 'pool'])
  })
  it('un modele n\'alerte jamais', () => {
    expect(alertsOf([vm('t', { state: 'running', snapshot_count: 0, meta: { template: true } })], HOST)).toEqual([])
  })
  it('stockage sous le seuil : rien', () => { expect(alertsOf([], HOST)).toEqual([]) })
})

describe('regles des modeles et de la suppression', () => {
  const tpl = vm('tpl', { meta: { template: true } })
  const c = vm('c', { meta: { base: 'tpl' } })
  it('une machine allumee ne devient pas modele', () => {
    expect(canMakeTemplate(vm('r', { state: 'running' }))).toMatchObject({ ok: false })
    expect(canMakeTemplate(vm('s'))).toEqual({ ok: true })
  })
  it('un modele avec clones lies ne redevient pas machine, et ne se supprime pas', () => {
    expect(canUntemplate([tpl, c], 'tpl')).toMatchObject({ ok: false, reason: expect.stringContaining('c') })
    expect(canDestroy([tpl, c], 'tpl')).toMatchObject({ ok: false })
    expect(canUntemplate([tpl], 'tpl')).toEqual({ ok: true })
    expect(canDestroy([tpl, c], 'c')).toEqual({ ok: true })
  })
})

describe('format', () => {
  it('une decimale, francais', () => { expect(fmtGb(14.24)).toBe('14,2 Go') })
  it('null vaut zero', () => { expect(fmtGb(null)).toBe('0 Go') })
})
