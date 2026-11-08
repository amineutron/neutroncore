import { describe, expect, it } from 'vitest'
import { ancetre, latDeRangee, niveauPourEchelle, nombreBandes, rangeeDeLat, TUILES_MAX, tuilesVisibles, urlTuile } from './tuiles'

describe('tuiles satellite', () => {
  it('url : z, y puis x', () => {
    expect(urlTuile({ z: 3, x: 2, y: 4 }, 'a/{z}/{y}/{x}')).toBe('a/3/4/2')
  })
  it('mercator : aller-retour latitude <-> rangée', () => {
    for (const lat of [-80, -45, 0, 10, 48.8, 70]) expect(latDeRangee(rangeeDeLat(lat, 6), 6)).toBeCloseTo(lat, 6)
    expect(latDeRangee(0, 0)).toBeCloseTo(85.0511, 3)
    expect(latDeRangee(1, 0)).toBeCloseTo(-85.0511, 3)
  })
  it('le niveau monte avec le zoom et reste borné', () => {
    expect(niveauPourEchelle(20, 1)).toBeGreaterThan(niveauPourEchelle(1, 1))
    expect(niveauPourEchelle(1e6, 3)).toBe(13)
    expect(niveauPourEchelle(1e-9, 1)).toBe(0)
  })
  it('monde entier : tuiles plafonnées ; vue serrée : niveau plus fin et tuile du centre en tête', () => {
    const monde = tuilesVisibles({ cx: 0, cy: 0, zoom: 1 }, 1280, 640, 2)
    expect(monde.tuiles.length).toBeLessThanOrEqual(TUILES_MAX)
    const ville = tuilesVisibles({ cx: 2.35, cy: 48.85, zoom: 120 }, 390, 700, 3)
    expect(ville.z).toBeGreaterThan(monde.z)
    expect(ville.tuiles.length).toBeLessThanOrEqual(TUILES_MAX)
    expect(ville.tuiles.length).toBeGreaterThan(0)
    expect(ville.tuiles[0].x).toBe(Math.floor(((2.35 + 180) / 360) * 2 ** ville.z))
  })
  it('tuile parente : part couverte', () => {
    const a = ancetre({ z: 5, x: 13, y: 6 }, 2)!
    expect(a.tuile).toEqual({ z: 3, x: 3, y: 1 })
    expect(a.sl).toBe(0.25)
    expect(a.sx).toBeCloseTo(0.25)
    expect(a.sy).toBeCloseTo(0.5)
    expect(ancetre({ z: 1, x: 0, y: 0 }, 2)).toBeNull()
  })
  it('bandes : bornées', () => {
    expect(nombreBandes(1)).toBe(2)
    expect(nombreBandes(1e5)).toBe(24)
  })
})
