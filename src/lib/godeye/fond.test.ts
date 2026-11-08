import { describe, expect, it } from 'vitest'
import { contoursTerres, decoderArcs, frontieresEntrePays } from './fond'

// Deux carrés qui se touchent par un côté : arc 0 = côté commun, arc 1 = reste du carré A, arc 2 = reste du carré B.
// Coordonnées quantifiées (échelle 1, origine 0) : le premier point est absolu, les suivants sont des écarts.
const topo = {
  transform: { scale: [1, 1] as [number, number], translate: [0, 0] as [number, number] },
  arcs: [
    [[10, 0], [0, 10]],                       // côté commun : (10,0) -> (10,10)
    [[10, 10], [-10, 0], [0, -10], [10, 0]],  // A : (10,10) -> (0,10) -> (0,0) -> (10,0)
    [[10, 0], [10, 0], [0, 10], [-10, 0]],    // B : (10,0) -> (20,0) -> (20,10) -> (10,10)
  ],
  objects: {
    land: { type: 'GeometryCollection', geometries: [{ type: 'MultiPolygon', arcs: [[[0, 1]], [[~0, 2]]] }] },
    countries: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0, 1]] }, { type: 'Polygon', arcs: [[~0, 2]] }] },
  },
}

describe('fond détaillé', () => {
  it('cumule les écarts puis applique échelle et origine', () => {
    const [a] = decoderArcs({ transform: { scale: [0.5, 2], translate: [-180, 10] }, arcs: [[[10, 1], [2, 3]]] })
    expect(a).toEqual([-175, 12, -174, 18])
  })
  it('sans transformation, les nombres restent tels quels', () => {
    expect(decoderArcs({ arcs: [[[1, 2], [3, 4]]] })[0]).toEqual([1, 2, 4, 6])
  })
  it('recolle les arcs d\'un anneau sans doubler le sommet commun, un arc négatif se lit à l\'envers', () => {
    const [anneauB] = contoursTerres(topo).slice(1)
    expect([...anneauB.pts]).toEqual([10, 10, 10, 0, 20, 0, 20, 10, 10, 10])   // côté commun à l'envers, puis B
  })
  it('donne le rectangle englobant de chaque contour', () => {
    const [a] = contoursTerres(topo)
    expect([a.ouest, a.sud, a.est, a.nord]).toEqual([0, 0, 10, 10])
  })
  it('ne garde comme frontière que l\'arc partagé par deux pays', () => {
    const f = frontieresEntrePays(topo)
    expect(f).toHaveLength(1)
    expect([...f[0].pts]).toEqual([10, 0, 10, 10])
  })
  it('une topologie vide ou abîmée ne plante pas', () => {
    expect(contoursTerres({ arcs: [], objects: {} })).toEqual([])
    expect(frontieresEntrePays({ arcs: [], objects: {} })).toEqual([])
    expect(contoursTerres({ arcs: [[[1, 1]]], objects: { land: { type: 'Polygon', arcs: [[5]] } } })).toEqual([])
  })
})
