import { describe, expect, it } from 'vitest'
import { avecAlpha, couleurObjet, COULEURS_THEME, COULEUR_MILITAIRE, COULEUR_URGENCE } from './couleurs'
import {
  boiteDeGlobe, destination, DIST_MAX, DIST_MIN, distanceDepuisZoom, placerEtiquettes, pointSphere, positionSoleil, produit, rayonVisible,
  visible, zoomDepuisDistance,
} from './globe'

describe('sphère', () => {
  it('points de repère : (0,0) sur +x, pôle nord sur +y, 90 E vers -z', () => {
    const [x, y, z] = pointSphere(0, 0)
    expect([x, y, z]).toEqual([1, 0, -0])
    expect(pointSphere(90, 0)[1]).toBeCloseTo(1, 10)
    expect(pointSphere(0, 90)[2]).toBeCloseTo(-1, 10)
    expect(pointSphere(0, -90)[2]).toBeCloseTo(1, 10)
  })
  it('tous les points sont sur la sphère unité', () => {
    for (const [la, lo] of [[48, 2], [-33, 151], [70, -150], [0, 180]]) {
      const p = pointSphere(la, lo)
      expect(produit(p, p)).toBeCloseTo(1, 10)
    }
  })
  it("la face cachée n'est pas visible, le centre l'est, l'horizon dépend de la distance", () => {
    const cam = pointSphere(0, 0).map((v) => v * 3) as [number, number, number]
    expect(visible(pointSphere(0, 0), cam)).toBe(true)
    expect(visible(pointSphere(0, 180), cam)).toBe(false)
    expect(visible(pointSphere(0, 71), cam)).toBe(false)     // horizon à acos(1/3) ~ 70,5 degrés
    expect(visible(pointSphere(0, 70), cam)).toBe(true)
    expect(visible(pointSphere(0, 60), cam)).toBe(true)
  })
})

describe('destination', () => {
  it('un degré vers le nord = un degré de latitude ; vers l\'est à l\'équateur = un degré de longitude', () => {
    const [la, lo] = destination(10, 20, 0, 1)
    expect(la).toBeCloseTo(11, 6)
    expect(lo).toBeCloseTo(20, 6)
    expect(destination(0, 0, 90, 1)[1]).toBeCloseTo(1, 6)
  })
  it("franchit l'antiméridien", () => {
    expect(destination(0, 179.5, 90, 1)[1]).toBeCloseTo(-179.5, 6)
  })
})

describe('soleil', () => {
  it('à midi UTC aux équinoxes : longitude 0, déclinaison proche de 0', () => {
    const s = positionSoleil(new Date('2027-03-21T12:00:00Z'))
    expect(Math.abs(s.lon)).toBeLessThan(0.01)
    expect(Math.abs(s.lat)).toBeLessThan(1)
  })
  it('à 18 h UTC le soleil est à 90 degrés ouest ; au solstice de juin il est au nord', () => {
    expect(positionSoleil(new Date('2027-06-21T18:00:00Z')).lon).toBeCloseTo(-90, 3)
    expect(positionSoleil(new Date('2027-06-21T12:00:00Z')).lat).toBeGreaterThan(23)
    expect(positionSoleil(new Date('2027-12-21T12:00:00Z')).lat).toBeLessThan(-23)
  })
})

describe('zoom et zone vue', () => {
  it('zoom 1 = loin, zoom 40 = près, et la conversion fait l\'aller-retour', () => {
    expect(distanceDepuisZoom(1)).toBeCloseTo(DIST_MAX, 6)
    expect(distanceDepuisZoom(40)).toBeCloseTo(DIST_MIN, 6)
    for (const z of [1, 2, 5, 12, 40]) expect(zoomDepuisDistance(distanceDepuisZoom(z))).toBeCloseTo(z, 5)
    expect(distanceDepuisZoom(Number.NaN)).toBeCloseTo(DIST_MAX, 6)
    expect(distanceDepuisZoom(1000)).toBeCloseTo(DIST_MIN, 6)
  })
  it("le rayon visible est borné par l'horizon et diminue quand on s'approche", () => {
    const horizon = (Math.acos(1 / DIST_MAX) * 180) / Math.PI
    expect(rayonVisible(DIST_MAX, 60)).toBeCloseTo(horizon, 5)
    expect(rayonVisible(DIST_MIN, 17.5)).toBeLessThan(rayonVisible(3.5, 17.5))
    expect(rayonVisible(DIST_MIN, 17.5)).toBeGreaterThan(1)
  })
  it('zoomé sur l\'Europe, la zone reste autour du centre et bornée', () => {
    const b = boiteDeGlobe(48, 10, 1.7)
    expect(b.sud).toBeLessThan(48)
    expect(b.nord).toBeGreaterThan(48)
    expect(b.ouest).toBeLessThan(10)
    expect(b.est).toBeGreaterThan(10)
    expect(b.nord - b.sud).toBeLessThan(90)
  })
  it('près d\'un pôle ou en vue lointaine : toutes les longitudes', () => {
    expect(boiteDeGlobe(88, 0, 2)).toMatchObject({ ouest: -180, est: 180 })
    const loin = boiteDeGlobe(0, 0, DIST_MAX)
    expect(loin.est - loin.ouest).toBeGreaterThanOrEqual(120)
  })
})

describe('étiquettes', () => {
  const c = (id: string, x: number, y: number, poids: number, w = 120, h = 40) => ({ id, x, y, w, h, poids })
  it('place chaque étiquette à droite du point quand il y a de la place', () => {
    const [p] = placerEtiquettes([c('a', 100, 100, 1)], 800, 500, 5)
    expect(p).toMatchObject({ id: 'a', cote: 'd', x: 112, y: 80, ancre: [100, 100] })
  })
  it('bascule à gauche au bord droit, en bas au bord haut', () => {
    expect(placerEtiquettes([c('a', 760, 200, 1)], 800, 500, 5)[0].cote).toBe('g')
    expect(placerEtiquettes([c('a', 400, 10, 1)], 800, 500, 5)[0].cote).toBe('b')
  })
  it('ne superpose jamais deux étiquettes et omet celle qui n\'a plus de place', () => {
    const cand = [c('a', 100, 100, 3), c('b', 105, 105, 2), c('c', 110, 98, 1)]
    const places = placerEtiquettes(cand, 800, 500, 10)
    for (let i = 0; i < places.length; i++) for (let j = i + 1; j < places.length; j++) {
      const a = places[i], b = places[j]
      expect(a.x < b.x + 120 && a.x + 120 > b.x && a.y < b.y + 40 && a.y + 40 > b.y).toBe(false)
    }
    expect(places[0].id).toBe('a')                                  // la plus importante est servie d'abord
  })
  it('respecte le maximum, les zones bloquées et les cadres trop petits', () => {
    const cand = Array.from({ length: 8 }, (_, i) => c(`e${i}`, 60 + i * 90, 200, 8 - i))
    expect(placerEtiquettes(cand, 900, 500, 3)).toHaveLength(3)
    const bloque = { x: 0, y: 0, w: 800, h: 500 }
    expect(placerEtiquettes([c('a', 100, 100, 1)], 800, 500, 5, [bloque])).toEqual([])
    expect(placerEtiquettes([c('a', 10, 10, 1, 500, 300)], 200, 100, 5)).toEqual([])
  })
  it('ne modifie pas la liste des candidats', () => {
    const cand = [c('b', 10, 10, 1), c('a', 300, 300, 5)]
    placerEtiquettes(cand, 800, 500, 5)
    expect(cand.map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('couleurs', () => {
  it('une couleur par thème, la catégorie pour un événement, la gravité pour un séisme', () => {
    expect(couleurObjet({ couche: 'infos', ton: 'crit', sorte: 'guerre' })).toBe(COULEURS_THEME.guerre)
    expect(couleurObjet({ couche: 'infos', ton: 'info', sorte: 'inconnu' })).toBe(COULEURS_THEME.monde)
    expect(couleurObjet({ couche: 'evenements', ton: 'crit', sorte: 'wildfires' })).not.toBe(couleurObjet({ couche: 'evenements', ton: 'crit', sorte: 'floods' }))
    expect(couleurObjet({ couche: 'seismes', ton: 'crit' })).not.toBe(couleurObjet({ couche: 'seismes', ton: 'ok' }))
    expect(couleurObjet({ couche: 'avions', ton: 'warn', sorte: 'militaire' })).toBe(COULEUR_MILITAIRE)
    expect(couleurObjet({ couche: 'avions', ton: 'crit', sorte: 'civil' })).toBe(COULEUR_URGENCE)
  })
  it('les couleurs de thèmes sont toutes différentes', () => {
    const v = Object.values(COULEURS_THEME)
    expect(new Set(v).size).toBe(v.length)
  })
  it('avecAlpha borne l\'opacité et laisse passer une couleur inconnue', () => {
    expect(avecAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)')
    expect(avecAlpha('#ff0000', 4)).toBe('rgba(255, 0, 0, 1)')
    expect(avecAlpha('rouge', 0.5)).toBe('rouge')
  })
})
