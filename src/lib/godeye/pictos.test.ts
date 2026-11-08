import { describe, expect, it } from 'vitest'
import { CATEGORIES_EVENEMENT, COUCHES, GROUPES_SAT, THEMES, type CoucheId } from './modele'
import { niveauDetail, pictoDe, PICTOS, tailleDemi } from './pictos'

describe('pictoDe', () => {
  it.each([
    ['avions', 'militaire', 'avion-mil'], ['avions', 'helico', 'helico'], ['avions', 'civil', 'avion'], ['avions', undefined, 'avion'],
    ['navires', undefined, 'navire'], ['satellites', 'stations', 'station'], ['satellites', 'galileo', 'sat-nav'], ['satellites', 'starlink', 'satellite'],
    ['seismes', undefined, 'seisme'], ['cyber', undefined, 'cyber'], ['infos', 'guerre', 'guerre'], ['infos', 'inconnu', 'monde'],
    ['evenements', 'wildfires', 'incendie'], ['evenements', 'autre', 'alerte'],
  ] as [CoucheId, string | undefined, string][])('%s / %s -> %s', (couche, sorte, attendu) => {
    expect(pictoDe({ couche, sorte })).toBe(attendu)
  })

  it('couvre tous les thèmes, catégories et groupes connus avec un tracé existant', () => {
    for (const t of THEMES) expect(PICTOS[pictoDe({ couche: 'infos', sorte: t.id })].d).not.toBe('')
    for (const c of CATEGORIES_EVENEMENT) expect(pictoDe({ couche: 'evenements', sorte: c.id })).not.toBe('alerte')
    for (const g of GROUPES_SAT) expect(PICTOS[pictoDe({ couche: 'satellites', sorte: g.id })]).toBeDefined()
    for (const c of COUCHES) expect(PICTOS[pictoDe({ couche: c.id, sorte: undefined })]).toBeDefined()
  })
})

describe('niveauDetail et tailleDemi', () => {
  it('passe en formes simples quand la foule grossit', () => {
    expect([0, 160, 161, 700, 701, 3000].map(niveauDetail)).toEqual([2, 2, 1, 1, 0, 0])
  })
  it('borne la taille du pictogramme', () => {
    expect(tailleDemi({ rayon: 1, couche: 'avions' }, 2)).toBe(9)
    expect(tailleDemi({ rayon: 1, couche: 'avions' }, 1)).toBe(7)
    expect(tailleDemi({ rayon: 100, couche: 'infos' }, 2)).toBe(14)
  })
})
