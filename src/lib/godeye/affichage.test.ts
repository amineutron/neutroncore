import { describe, expect, it } from 'vitest'
import { candidatsEtiquettes, lireAffichage, maxEtiquettes, rotationEffective } from './affichage'
import type { Objet } from './modele'

const o = (id: string, couche: Objet['couche'], ton: Objet['ton'], rayon = 6, sorte?: string): Objet => ({ id, couche, ton, rayon, lon: 0, lat: 0, titre: id, detail: '', sorte })

describe('réglages d\'affichage', () => {
  it('défauts : globe, rotation, jour et nuit, panneau fermé', () => {
    expect(lireAffichage(null)).toEqual({ mode: 'globe', rotation: true, jourNuit: true, tiroir: null })
  })
  it('préférence « animations réduites » : pas de rotation sauf choix explicite', () => {
    expect(lireAffichage(null, true).rotation).toBe(false)
    expect(lireAffichage(JSON.stringify({ rotation: true }), true).rotation).toBe(true)
  })
  it('relit un réglage valide et ignore le reste', () => {
    expect(lireAffichage(JSON.stringify({ mode: 'plat', rotation: false, jourNuit: false, tiroir: 'vues' }))).toEqual({ mode: 'plat', rotation: false, jourNuit: false, tiroir: 'vues' })
    expect(lireAffichage(JSON.stringify({ mode: 'cube', tiroir: 'secret' }))).toEqual({ mode: 'globe', rotation: true, jourNuit: true, tiroir: null })
    for (const brut of ['{pas du json', '3', '"x"', 'null']) expect(lireAffichage(brut).mode).toBe('globe')
  })
})

describe('étiquettes flottantes', () => {
  it('écarte avions civils, navires, satellites ordinaires et cyber ; garde le reste', () => {
    const liste = [
      o('civil', 'avions', 'info'), o('mil', 'avions', 'warn', 5, 'militaire'), o('nav', 'navires', 'ok'), o('iss', 'satellites', 'ok', 6, 'stations'),
      o('gps', 'satellites', 'ok', 3.5, 'gps-ops'), o('cy', 'cyber', 'crit'), o('sei', 'seismes', 'crit', 18), o('inf', 'infos', 'crit', 8, 'guerre'),
    ]
    expect(candidatsEtiquettes(liste, null).map((x) => x.id).sort()).toEqual(['iss', 'inf', 'mil', 'sei'].sort())
  })
  it('l\'objet choisi est toujours proposé, même ordinaire', () => {
    expect(candidatsEtiquettes([o('civil', 'avions', 'info')], 'civil').map((x) => x.id)).toEqual(['civil'])
  })
  it('trie par intérêt, borne la liste et ne modifie pas l\'entrée', () => {
    const liste = [o('a', 'seismes', 'ok', 3), o('b', 'infos', 'crit', 8, 'guerre'), o('c', 'seismes', 'warn', 9)]
    const copie = [...liste]
    expect(candidatsEtiquettes(liste, null).map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(candidatsEtiquettes(liste, null, 2)).toHaveLength(2)
    expect(liste).toEqual(copie)
  })
  it('le nombre d\'étiquettes croît avec le zoom, plafonné selon la largeur', () => {
    expect(maxEtiquettes(1, 1400)).toBeLessThan(maxEtiquettes(10, 1400))
    expect(maxEtiquettes(40, 1400)).toBe(18)
    expect(maxEtiquettes(40, 800)).toBe(10)
    expect(maxEtiquettes(40, 380)).toBe(5)
    expect(maxEtiquettes(Number.NaN, 1400)).toBeGreaterThanOrEqual(3)
  })
  it('la rotation fait une pause quand un élément est sélectionné', () => {
    expect(rotationEffective(true, null)).toBe(true)
    expect(rotationEffective(true, 'x')).toBe(false)
    expect(rotationEffective(false, null)).toBe(false)
  })
})
