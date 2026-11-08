import { describe, expect, it } from 'vitest'
import { bruitRelief, lignesGrille, lireReglagesCarte, palette, pasGrille, REGLAGES_CARTE_DEFAUT } from './apparence'

describe('lireReglagesCarte', () => {
  it('défauts si rien ou illisible', () => {
    expect(lireReglagesCarte(null)).toEqual(REGLAGES_CARTE_DEFAUT)
    expect(lireReglagesCarte('{pas du json')).toEqual(REGLAGES_CARTE_DEFAUT)
    expect(lireReglagesCarte('{"grille":7}')).toEqual(REGLAGES_CARTE_DEFAUT)
  })
  it('relit un réglage valide', () => {
    expect(lireReglagesCarte('{"grille":10,"equateur":true,"tropiques":true}')).toEqual({ grille: 10, equateur: true, tropiques: true })
  })
})

describe('pasGrille', () => {
  it('auto : plus fin en zoomant', () => {
    expect([1, 3, 8].map((z) => pasGrille('auto', z))).toEqual([30, 15, 10])
  })
  it('auto figé (globe) : 15 ; un choix l\'emporte', () => {
    expect(pasGrille('auto', 8, true)).toBe(15)
    expect(pasGrille(30, 8)).toBe(30)
  })
})

describe('lignesGrille', () => {
  it('méridiens de -180 à 180', () => {
    const g = lignesGrille(30, { equateur: false, tropiques: false })
    expect(g.meridiens[0]).toBe(-180)
    expect(g.meridiens.at(-1)).toBe(180)
    expect(g.paralleles).toContain(0)
    expect(g.speciales).toEqual([])
  })
  it('équateur à part sans doublon, tropiques ajoutés', () => {
    const g = lignesGrille(15, { equateur: true, tropiques: true })
    expect(g.paralleles).not.toContain(0)
    expect(g.speciales.map((s) => s.nom)).toEqual(['équateur', 'tropique du Cancer', 'tropique du Capricorne'])
    expect(Math.max(...g.paralleles)).toBeLessThanOrEqual(75)
  })
})

describe('palette', () => {
  it('texture décochée : fond uni sans terres remplies', () => {
    const p = palette(false, true)
    expect(p.remplir).toBe(false)
    expect(new Set(p.mer).size).toBe(1)
  })
  it('satellite : relief, plus sombre que la normale', () => {
    expect(palette(true, true).relief).toBe(true)
    expect(palette(true, false).relief).toBe(false)
    expect(palette(true, true).mer[1]).not.toBe(palette(true, false).mer[1])
  })
})

describe('bruitRelief', () => {
  it('déterministe et dans 0..1', () => {
    const a = bruitRelief(32), b = bruitRelief(32)
    expect(Array.from(a)).toEqual(Array.from(b))
    expect(a.every((v) => v >= 0 && v <= 1)).toBe(true)
    expect(new Set(Array.from(a).map((v) => v.toFixed(2))).size).toBeGreaterThan(10)
  })
})
