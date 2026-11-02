import { describe, expect, it } from 'vitest'
import { buildHubs, entryScreen, groupHubs, hubOf } from './navTree'

const hubs = buildHubs<string>()

describe('arbre de navigation', () => {
  it('compte 11 entrées de menu', () => {
    expect(hubs).toHaveLength(11)
  })

  it('range chaque écran dans une seule entrée', () => {
    const ids = hubs.flatMap((x) => x.tabs.map((tb) => tb.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(39)
  })

  it('retrouve l entrée d un écran', () => {
    expect(hubOf(hubs, 'mises')?.id).toBe('systeme')
    expect(hubOf(hubs, 'cyber')?.id).toBe('veille')
    expect(hubOf(hubs, 'worldmonitor')?.id).toBe('veille')
    expect(hubOf(hubs, 'inconnu')).toBeUndefined()
  })

  it('rouvre le dernier sous-onglet vu, sinon le premier', () => {
    const sys = hubs.find((x) => x.id === 'systeme')!
    expect(entryScreen(sys, 'mises')).toBe('mises')
    expect(entryScreen(sys, 'supprime')).toBe('ressources')
    expect(entryScreen(sys, null)).toBe('ressources')
  })

  it('regroupe les entrées par rubrique', () => {
    const g = groupHubs(hubs)
    expect(g.map((x) => x.group)).toEqual(['pilotage', 'dev', 'maison', 'système'])
    expect(g.reduce((n, x) => n + x.hubs.length, 0)).toBe(11)
  })
})
