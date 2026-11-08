import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/vmhub.backend.json'
import { alertsOf, buildFamilies, canDestroy, chainOf, cowSavings, kindOf, normHost, resourceRows, type Overview } from './vmHub'
import { search, type LibEntry } from './vmLibrary'
import { layout, treeOf } from './vmSnapTree'

// Contrat avec lyra-control-api : `__fixtures__/vmhub.backend.json` est une reponse REELLE du backend
// (worktree vms-hub, demon simule). Si un champ change cote API, ce test casse avant l'ecran.
const ov = fixture.overview as unknown as Overview
const lib = fixture.library.entries as unknown as LibEntry[]

describe('contrat overview', () => {
  it('forme attendue par le hub', () => {
    expect(ov.success).toBe(true)
    expect(Object.keys(ov.host).sort()).toEqual(['cpu', 'pool_gb', 'pool_used_gb', 'ram_mb'])
    for (const v of ov.vms) {
      expect(typeof v.name).toBe('string')
      expect(['running', 'stopped', 'paused', 'starting', 'unknown']).toContain(v.state)
      expect(Object.keys(v.meta).sort()).toEqual(['base', 'from', 'lineage', 'notes', 'origin', 'profile', 'template'])
      for (const l of v.meta.lineage) expect(['cow', 'copy', 'image', 'import']).toContain(l.rel)
    }
  })
  it('types de machines reconnus depuis les fiches reelles', () => {
    const k = Object.fromEntries(ov.vms.map((v) => [v.name, kindOf(v)]))
    expect(k).toMatchObject({ tpl: 'tpl', clone: 'cow', copie: 'copy', seule: 'own' })
  })
  it('familles et provenance a partir des vraies donnees', () => {
    const f = buildFamilies(ov.vms)
    expect(f.templates[0].cow.map((n) => n.vm.name)).toEqual(['clone'])
    expect(f.templates[0].copies.map((n) => n.vm.name)).toEqual(['copie'])
    expect(f.loose.map((n) => n.vm.name)).toEqual(['seule'])
    const clone = ov.vms.find((v) => v.name === 'clone')!
    expect(chainOf(clone, ov.vms).map((n) => n.id)).toEqual(['tpl', 'clone'])
  })
  it('ressources, economies, alertes et regles de suppression sur les vraies donnees', () => {
    expect(resourceRows(ov.vms, 'ram', normHost(ov.host)).rows.length).toBe(3)   // le modele n'est pas compte
    expect(cowSavings(ov.vms)).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(alertsOf(ov.vms, normHost(ov.host)))).toBe(true)
    expect(canDestroy(ov.vms, 'tpl').ok).toBe(false)
    expect(canDestroy(ov.vms, 'clone').ok).toBe(true)
  })
})

describe('hote incomplet', () => {
  it('une mesure absente vaut zero, jamais NaN ni plantage', () => {
    const h = normHost({ cpu: null, ram_mb: null, pool_gb: null, pool_used_gb: null })
    expect(h).toEqual({ cpu: 0, ram_mb: 0, pool_gb: 0, pool_used_gb: 0 })
    expect(resourceRows(ov.vms, 'ram', h).rows.every((r) => Number.isFinite(r.share))).toBe(true)
    expect(alertsOf(ov.vms, h).some((a) => a.kind === 'pool')).toBe(false)
  })
})

describe('contrat bibliotheque', () => {
  it('25 editions, champs complets', () => {
    expect(lib).toHaveLength(25)
    for (const e of lib) {
      for (const k of ['id', 'dist', 'nom', 'ver', 'fmt', 'mb', 'ram', 'disk', 'tags', 'ui', 'pk', 'os', 'src', 'desc', 'pour', 'cached', 'deployable', 'reason'] as const) expect(e[k], `${e.id}.${k}`).not.toBeUndefined()
      expect(['iso', 'cloud', 'vb']).toContain(e.fmt)
    }
  })
  it('la recherche cote client marche sur le vrai catalogue', () => {
    const ids = (q: string) => search(lib, q, 'tout').flatMap((g) => g.vars.map((v) => v.id))
    expect(ids('sway')).toContain('fedora-sway')
    expect(ids('leger').length).toBeGreaterThan(5)
    expect(ids('debian live').sort()).toEqual(['debian-gnome', 'debian-kde', 'debian-xfce'])
    expect(search(lib, '', 'sans interface').every((g) => g.vars.every((v) => v.ui === 'aucune'))).toBe(true)
  })
  it('le cache est reflete (fichier present dans le dossier d\'images)', () => {
    expect(lib.find((e) => e.id === 'debian-cloud')?.cached).toBe(true)
    expect(lib.find((e) => e.id === 'kali')?.cached).toBe(false)
  })
})

describe('contrat snapshots', () => {
  it('l\'arbre explicite du backend et sa disposition', () => {
    const nodes = treeOf(fixture.snapshots.tree)
    expect(nodes.map((n) => [n.name, n.parent])).toEqual([['base', null], ['a', 'base'], ['a1', 'a'], ['b', 'base']])
    expect(layout(nodes, 'b').lanes).toBe(2)
  })
})
