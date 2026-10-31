import { afterEach, describe, expect, it, vi } from 'vitest'
import { SORTIES_KEY, applySortiesFilter, loadSortiesOn, saveSortiesOn, timeLabel } from './sorties'

const occs = [{ category: 'perso', id: 'a' }, { category: 'sorties', id: 'b' }, { category: 'systeme', id: 'c' }]

describe('applySortiesFilter', () => {
  it('coupé : retire seulement les sorties', () => {
    expect(applySortiesFilter(occs, false).map((o) => o.id)).toEqual(['a', 'c'])
  })
  it('allumé : tout reste', () => { expect(applySortiesFilter(occs, true)).toHaveLength(3) })
})

describe('timeLabel', () => {
  it('pas d\'heure pour une sortie sans heure', () => {
    expect(timeLabel({ start: '2026-10-21T00:00', all_day: true })).toBe('')
    expect(timeLabel({ start: '2026-10-22T20:30' })).toBe('20:30')
  })
})

describe('filtre mémorisé', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('éteint par défaut, puis retient le choix', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } })
    expect(loadSortiesOn()).toBe(false)
    saveSortiesOn(true)
    expect(store[SORTIES_KEY]).toBe('1')
    expect(loadSortiesOn()).toBe(true)
    saveSortiesOn(false)
    expect(loadSortiesOn()).toBe(false)
  })
  it('stockage indisponible : éteint, sans exception', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } })
    expect(loadSortiesOn()).toBe(false)
    expect(() => saveSortiesOn(true)).not.toThrow()
  })
})
