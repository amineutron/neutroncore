import { describe, expect, it } from 'vitest'
import { CPU_MODELS, HELP, LEVEL, helpOf } from './vmHelp'

describe('aide pedagogique', () => {
  it('chaque entree a un titre et au moins une phrase', () => {
    for (const [k, h] of Object.entries(HELP)) {
      expect(h.t.length, k).toBeGreaterThan(2)
      expect(h.p.length, k).toBeGreaterThan(0)
      expect(h.p.every((x) => x.trim().length > 10), k).toBe(true)
    }
  })
  it('un tableau a des lignes de la largeur de son en-tete', () => {
    for (const [k, h] of Object.entries(HELP)) if (h.table) expect(h.table.rows.every((r) => r.length === h.table!.head.length), k).toBe(true)
  })
  it('les concepts demandes sont tous expliques', () => {
    for (const k of ['kinds', 'cow', 'copy', 'tpl', 'prov', 'cpu-model', 'hw-net', 'hw-fw', 'snap-what', 'snap-ram', 'lib-fmt', 'lib-search', 'env', 'tasks', 'res-panel']) {
      expect(helpOf(k), k).not.toBeNull()
    }
  })
  it('matériel étendu : firmware, tpm, secure boot, démarrage, affichage, usb, agrandissement, pause, arrêt requis', () => {
    for (const k of ['hw-fw', 'hw-tpm', 'hw-sb', 'hw-boot', 'hw-display', 'hw-usb', 'hw-grow', 'pause', 'needs-stop']) {
      const h = helpOf(k)
      expect(h, k).not.toBeNull()
      expect(h!.p.length, `${k} : 2 à 4 phrases ou paragraphes`).toBeGreaterThanOrEqual(2)
      expect(h!.p.length, k).toBeLessThanOrEqual(4)
    }
    expect(HELP['hw-fw'].p.join(' ')).toMatch(/Windows 11.*UEFI.*TPM.*Secure Boot/)
    expect(HELP['hw-usb'].p.join(' ')).toMatch(/l'hôte ne l'a plus/)
    expect(HELP['hw-grow'].p.join(' ')).toMatch(/jamais/)
    expect(HELP['hw-grow'].p.join(' ')).toMatch(/partition/)
    expect(HELP['pause'].p.join(' ')).toMatch(/mémoire reste/)
  })
  it('écran et console série : vnc dans le navigateur, spice vs vnc complété, ttyS0, ctrl+alt+suppr, plein écran et clavier', () => {
    for (const k of ['screen-vnc', 'serial', 'cad', 'fullscreen-kbd']) {
      const h = helpOf(k)
      expect(h, k).not.toBeNull()
      expect(h!.p.length, k).toBeGreaterThanOrEqual(2)
      expect(h!.p.length, k).toBeLessThanOrEqual(4)
    }
    expect(HELP['hw-display'].p.join(' ')).toMatch(/noVNC/)
    expect(HELP['hw-display'].p.join(' ')).toMatch(/machine arrêtée/)
    expect(HELP['screen-vnc'].p.join(' ')).toMatch(/30 secondes/)
    expect(HELP['screen-vnc'].p.join(' ')).toMatch(/exclusive/)
    expect(HELP['serial'].p.join(' ')).toMatch(/ttyS0/)
    expect(HELP['serial'].p.join(' ')).toMatch(/images cloud/)
    expect(HELP['serial'].p.join(' ')).toMatch(/Entrée/)
    expect(HELP['cad'].p.join(' ')).toMatch(/pas à ton ordinateur/)
    expect(HELP['fullscreen-kbd'].p.join(' ')).toMatch(/encoche/)
    expect(HELP['fullscreen-kbd'].p.join(' ')).toMatch(/clavier/)
  })
  it('cle inconnue : null', () => { expect(helpOf('zzz')).toBeNull() })
})

describe('modeles de processeur', () => {
  it('quatre modeles, notes de 1 a 5, un texte chacun', () => {
    expect(CPU_MODELS.map((c) => c.id)).toEqual(['host-passthrough', 'host-model', 'x86-64-v2', 'qemu64'])
    for (const c of CPU_MODELS) {
      for (const n of [c.speed, c.move, c.compat]) expect(n >= 1 && n <= 5).toBe(true)
      expect(LEVEL[c.speed]).toBeTruthy()
      expect(c.text.length).toBeGreaterThan(40)
    }
  })
  it('le plus rapide est le moins deplacable, et inversement', () => {
    const pass = CPU_MODELS[0], generic = CPU_MODELS[3]
    expect(pass.speed).toBeGreaterThan(generic.speed)
    expect(pass.move).toBeLessThan(generic.move)
  })
  it('le tableau d\'aide reprend les memes modeles', () => {
    expect(HELP['cpu-model'].table?.rows.map((r) => r[0])).toEqual(CPU_MODELS.map((c) => c.id))
  })
})
