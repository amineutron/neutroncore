import { describe, expect, it } from 'vitest'
import { groupBySeries, isReleased, releaseLabel, type MissingEpisode } from './missing'

const ep = (series_id: number | null, series: string, detail: string): MissingEpisode =>
  ({ series_id, series, detail, title: '', air_date: '' })

describe('groupBySeries', () => {
  it('regroupe par identifiant, la série la plus trouée en premier', () => {
    const g = groupBySeries([ep(1, 'A', 'S01E02'), ep(2, 'B', 'S04E08'), ep(2, 'B', 'S04E07'), ep(2, 'B', 'S04E09')])
    expect(g.map((s) => [s.id, s.title, s.episodes.length, s.range])).toEqual([
      [2, 'B', 3, 'S04E07 → S04E09'], [1, 'A', 1, 'S01E02'],
    ])
  })

  it('sans identifiant, regroupe par titre et nomme la série inconnue', () => {
    const g = groupBySeries([ep(null, '', 'S01E01'), ep(null, '', 'S01E02'), ep(null, 'C', 'S02E01')])
    expect(g.map((s) => [s.id, s.title, s.episodes.length])).toEqual([[null, 'série inconnue', 2], [null, 'C', 1]])
  })

  it('ne confond pas deux séries de même titre', () => {
    expect(groupBySeries([ep(1, 'Dune', 'S01E01'), ep(2, 'Dune', 'S01E01')])).toHaveLength(2)
  })

  it('liste vide', () => expect(groupBySeries([])).toEqual([]))
})

describe('isReleased / releaseLabel', () => {
  it.each([
    ['released', true, 'sorti'], ['announced', false, 'annoncé'], ['inCinemas', false, 'au cinéma'],
    ['tba', false, 'annoncé'], ['', true, 'sorti'],
  ])('%s', (status, released, label) => {
    expect(isReleased({ id: 1, title: 't', year: 2026, status })).toBe(released)
    expect(releaseLabel(status)).toBe(label)
  })
})
