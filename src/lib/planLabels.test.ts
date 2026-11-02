import { describe, expect, it } from 'vitest'
import { labelBox, overlaps, placeLabels } from './planLabels'

describe('placeLabels', () => {
  it('garde la position haute quand rien ne gêne', () => {
    const r = placeLabels([{ id: 'a', x: 0, y: 100, text: 'back' }], 5)
    expect(r.a).toBe(100 - 4.4 * 5)
  })
  it('décale des lampes superposées pour que leurs étiquettes ne se chevauchent pas', () => {
    const unit = 5
    const ls = [
      { id: 'a', x: 100, y: 100, text: 'hue' },
      { id: 'b', x: 105, y: 102, text: 'hue 2' },
      { id: 'c', x: 102, y: 101, text: 'back' },
    ]
    const r = placeLabels(ls, unit)
    const boxes = ls.map((l) => labelBox(l.x, r[l.id], l.text, unit))
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false)
  })
  it('évite les boîtes déjà prises', () => {
    const taken = [labelBox(0, 100 - 4.4 * 5, 'tv', 5)]
    const r = placeLabels([{ id: 'a', x: 0, y: 100, text: 'tv' }], 5, taken)
    expect(r.a).not.toBe(100 - 4.4 * 5)
  })
})
