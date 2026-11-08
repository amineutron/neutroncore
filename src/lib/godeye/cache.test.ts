import { describe, expect, it } from 'vitest'
import { avecRepli, CLE_CACHE, ecrireCache, fusionnerCache, lireCache, restaures, TTL_CACHE_MS } from './cache'
import { DONNEES_VIDES, type CoucheId } from './modele'

const T = 1_700_000_000_000
const stock = (v: string | null) => ({ getItem: () => v, setItem: () => {}, removeItem: () => {} })
const majs = (o: Partial<Record<CoucheId, number | null>> = {}) => ({ seismes: null, avions: null, satellites: null, navires: null, evenements: null, infos: null, cyber: null, ...o }) as Record<CoucheId, number | null>
const actives = (o: Partial<Record<CoucheId, boolean>> = {}) => ({ seismes: true, avions: true, satellites: false, navires: true, evenements: true, infos: true, cyber: false, ...o }) as Record<CoucheId, boolean>

describe('lireCache', () => {
  it('stockage absent, vide ou cassé : cache vide, sans exception', () => {
    expect(lireCache(null, T).d).toEqual({})
    expect(lireCache(stock(null), T).d).toEqual({})
    expect(lireCache(stock('{pas du json'), T).d).toEqual({})
    expect(lireCache({ getItem: () => { throw new Error('bloqué') }, setItem: () => {}, removeItem: () => {} }, T).d).toEqual({})
  })
  it('ignore une couche trop vieille ou mal formée, garde les autres', () => {
    const brut = JSON.stringify({ t: { seismes: T - 1000, infos: T - TTL_CACHE_MS - 1, avions: T - 5 }, d: { seismes: [{ id: 'a' }], infos: [{ id: 'b' }], avions: 'oups' } })
    const c = lireCache(stock(brut), T)
    expect(Object.keys(c.d)).toEqual(['seismes'])
  })
})

describe('fusionnerCache / ecrireCache', () => {
  it('fusionne sans toucher à l\'ancien', () => {
    const ancien = { t: { seismes: 1 }, d: { seismes: [1] } } as never
    const n = fusionnerCache(ancien, { infos: { t: 5, liste: [{ id: 'x' }] } })
    expect(n.t).toEqual({ seismes: 1, infos: 5 })
    expect((ancien as { t: object }).t).toEqual({ seismes: 1 })
  })
  it('borne la taille : abandonne les avions en premier', () => {
    const gros = Array.from({ length: 500 }, (_, i) => ({ id: `a${i}`, x: 'y'.repeat(1500) }))
    const n = fusionnerCache({ t: {}, d: {} }, { avions: { t: 1, liste: gros }, seismes: { t: 1, liste: [{ id: 's' }] } })
    expect(n.d.avions).toBeUndefined()
    expect(n.d.seismes).toHaveLength(1)
  })
  it('écrit et relit ; échec de stockage : false', () => {
    let v = ''
    const s = { getItem: () => v, setItem: (_k: string, x: string) => { v = x }, removeItem: () => {} }
    expect(ecrireCache(s, { t: { seismes: T }, d: { seismes: [{ id: 'q' }] } } as never)).toBe(true)
    expect(lireCache(s, T).d.seismes).toEqual([{ id: 'q' }])
    expect(ecrireCache({ ...s, setItem: () => { throw new Error('quota') } }, { t: {}, d: {} })).toBe(false)
    expect(CLE_CACHE).toContain('godeye')
  })
})

describe('avecRepli / restaures', () => {
  const cache = { t: { seismes: T - 1000, avions: T - 2000 }, d: { seismes: [{ id: 's1' }], avions: [{ id: 'v1' }] } } as never
  it('remplit les couches jamais chargées et vides, actives seulement', () => {
    const d = avecRepli(DONNEES_VIDES, cache, majs(), actives({ avions: false }))
    expect(d.seismes).toEqual([{ id: 's1' }])
    expect(d.avions).toEqual([])
  })
  it('ne remplace pas une couche chargée, même vide', () => {
    const d = avecRepli(DONNEES_VIDES, cache, majs({ seismes: T }), actives())
    expect(d.seismes).toEqual([])
  })
  it('restaures : heures des copies utilisées', () => {
    expect(restaures(cache, majs({ avions: T }), actives())).toEqual({ seismes: T - 1000 })
  })
})
