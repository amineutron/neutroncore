import { afterAll, describe, expect, it } from 'vitest'
import { alertsOf, buildFamilies, chainOf, cowSavings, EMPTY_META, resourceRows, type HubVm, type Host } from './vmHub'
import { highlight, search, type LibEntry } from './vmLibrary'
import { layout, treeOf, type SnapIn } from './vmSnapTree'

// Benchmarks par budget : chaque cas mesure son temps et echoue au-dela d'un plafond large (jamais flaky),
// le tableau final montre les vrais temps de cette machine. Lancer seul : npx vitest run src/lib/vmHubBench.test.ts
const HOST: Host = { cpu: 16, ram_mb: 32768, pool_gb: 930, pool_used_gb: 100 }
const rows: { cas: string; ms: number; budget: number }[] = []

function bench(cas: string, budget: number, fn: () => void, runs = 5): void {
  fn() // chauffe
  const t: number[] = []
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); fn(); t.push(performance.now() - t0) }
  t.sort((a, b) => a - b)
  const median = t[Math.floor(t.length / 2)]
  rows.push({ cas, ms: Math.round(median * 100) / 100, budget })
  expect(median, `${cas} : ${median.toFixed(2)} ms pour un budget de ${budget} ms`).toBeLessThan(budget)
}

const mkVm = (i: number, meta: Partial<HubVm['meta']> = {}): HubVm => ({
  name: `vm-${i}`, state: i % 3 === 0 ? 'running' : 'stopped', status: 'up', vcpus: 2, ram_mb: 4096, disk_used_gb: 10, disk_total_gb: 40, ip: null,
  snapshot_count: i % 5, cpu_pct: 20, mem_pct: 40, meta: { ...EMPTY_META, ...meta },
})

function fleet(n: number): HubVm[] {
  // un modele sur dix, des clones lies dessous, des copies, des machines seules
  const list: HubVm[] = []
  for (let i = 0; i < n; i++) {
    if (i % 10 === 0) list.push(mkVm(i, { template: true }))
    else if (i % 10 < 6) list.push(mkVm(i, { base: `vm-${i - (i % 10)}`, from: `vm-${i - (i % 10)}`, lineage: [{ id: `vm-${i - (i % 10)}`, rel: 'cow' }] }))
    else if (i % 10 < 8) list.push(mkVm(i, { origin: 'copy', from: `vm-${i - (i % 10)}`, lineage: [{ id: `vm-${i - (i % 10)}`, rel: 'copy' }] }))
    else list.push(mkVm(i))
  }
  return list
}

const catalogue = (n: number): LibEntry[] => Array.from({ length: n }, (_, i) => ({
  id: `e${i}`, dist: `d${i % 200}`, nom: `Distribution ${i % 200}`, ver: i % 3 ? 'Live KDE Plasma' : 'cloud image', fmt: (['iso', 'cloud', 'vb'] as const)[i % 3], mb: 100 + i, ram: 512, disk: 5,
  tags: i % 2 ? ['léger', 'serveur'] : ['bureau'], ui: i % 4 ? 'aucune' : 'KDE Plasma', pk: 'minimal', os: 'X', src: 'exemple.org',
  desc: `Une description assez longue pour l'entrée numéro ${i}, avec des mots comme léger, bureau, tuilage et serveur.`, pour: 'un usage', cached: false, deployable: true, reason: '',
}))

describe('benchmarks du hub des VMs', () => {
  it('familles : 2000 machines', () => {
    const vms = fleet(2000)
    bench('buildFamilies, 2000 machines', 250, () => buildFamilies(vms))
  })
  it('ressources : 2000 machines, 4 metriques', () => {
    const vms = fleet(2000)
    bench('resourceRows x4, 2000 machines', 120, () => { for (const m of ['ram', 'vcpu', 'disk', 'load'] as const) resourceRows(vms, m, HOST) })
    bench('cowSavings + alertsOf, 2000 machines', 60, () => { cowSavings(vms); alertsOf(vms, HOST) })
  })
  it('provenance : chaine de 200 machines', () => {
    const chain: HubVm[] = Array.from({ length: 200 }, (_, i) => mkVm(i, { base: i ? `vm-${i - 1}` : null, lineage: Array.from({ length: i }, (_, k) => ({ id: `vm-${k}`, rel: 'cow' as const })) }))
    bench('chainOf sur la derniere, chaine de 200', 20, () => chainOf(chain[199], chain))
    bench('buildFamilies sur une chaine de 200', 60, () => buildFamilies(chain))
  })
  it('arbre de snapshots : 20000 en chaine, 5000 ramifies', () => {
    const chain: SnapIn[] = Array.from({ length: 20000 }, (_, i) => ({ name: `n${i}`, depth: i }))
    bench('treeOf + layout, chaine de 20000', 400, () => layout(treeOf(chain), 'n19999'), 3)
    const wide: SnapIn[] = [{ name: 'racine', depth: 0 }]
    for (let b = 0; b < 500; b++) for (let k = 1; k <= 10; k++) wide.push({ name: `b${b}-${k}`, depth: k })
    bench('treeOf + layout, 500 branches de 10', 250, () => layout(treeOf(wide), 'b499-10'), 3)
  })
  it('bibliotheque : une frappe sur 5000 editions', () => {
    const cat = catalogue(5000)
    // chaque frappe d'une phrase : le temps qui compte est celui d'UNE frappe, a froid puis a chaud
    const phrase = 'debian live kde'
    bench('search, 5000 editions, a froid (index construit)', 350, () => search(catalogue(5000), 'kde', 'tout'), 3)
    search(cat, '', 'tout')
    bench('search, 5000 editions, a chaud, requete vide', 60, () => search(cat, '', 'tout'))
    bench('search, 5000 editions, a chaud, 3 mots', 60, () => search(cat, 'léger bureau kde', 'tout'))
    bench(`search, ${phrase.length} frappes de suite`, 600, () => { for (let i = 1; i <= phrase.length; i++) search(cat, phrase.slice(0, i), 'tout') }, 3)
    bench('highlight, 1000 textes', 40, () => { for (let i = 0; i < 1000; i++) highlight(cat[i].desc, 'léger tuilage') })
  })

  afterAll(() => {
    const w = Math.max(...rows.map((r) => r.cas.length))
    const lines = rows.map((r) => `  ${r.cas.padEnd(w)}  ${String(r.ms).padStart(8)} ms  (budget ${r.budget} ms)`)
    console.info(`\nbenchmarks du hub des VMs\n${lines.join('\n')}\n`)
  })
})
