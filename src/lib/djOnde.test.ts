import { describe, expect, it } from 'vitest'
import { COMMUN_DEFAUT, apport, type Dims, type Fixture, type FxParams, type Scene } from './spatialFx'
import { appliquer, etatInitial, nouvelleCouche, versParams, type Profil } from './djCouches'

const DIMS: Dims = { w: 400, h: 300, d: 250 }
const P: FxParams = { source: [0, 0, 100], axe: 'x', palette: 'neon', intensite: 1 }
const LAMPES: Fixture[] = [[0, 0, 100], [80, 50, 100], [150, 120, 100], [180, 140, 200]].map((pos, i) => ({ id: `l${i}`, kind: 'lampe' as const, pos: pos as [number, number, number] }))

describe('vitesse de l onde', () => {
  it('absente ou à 1, l onde est exactement celle d origine', () => {
    for (const f of LAMPES) for (let b = 0; b < 3; b += 0.07) {
      expect(apport('onde', f, DIMS, { ...P, vitesseOnde: 1 }, b).niveau).toBe(apport('onde', f, DIMS, P, b).niveau)
    }
  })
  it('une vitesse x4 amène le sommet de l onde environ quatre fois plus tôt, puis la laisse au bout', () => {
    const sommet = (f: Fixture, vitesse: number): number => {
      let meilleur = 0, ou = 0
      for (let b = 0; b < 1; b += 0.002) { const n = apport('onde', f, DIMS, { ...P, vitesseOnde: vitesse }, 3 + b).niveau; if (n > meilleur) { meilleur = n; ou = b } }
      return ou
    }
    for (const f of LAMPES.slice(1)) expect(Math.abs(sommet(f, 4) - sommet(f, 1) / 4)).toBeLessThan(0.03)
    // après le quart de pulsation, le front est sorti de la pièce : plus rien ne s allume
    expect(apport('onde', LAMPES[2], DIMS, { ...P, vitesseOnde: 4 }, 3.6).niveau).toBeLessThan(0.1)
  })
  it('un front rapide est plus large (la pièce ne paraît pas terne), sans dépasser 2,2 fois', () => {
    const f = LAMPES[2]
    const largeur = (vitesse: number): number => {
      // à la pulsation où le front est sur la lampe, de combien de temps (en pulsations) la lampe reste-t-elle au-dessus de la moitié de son sommet ?
      const pts: number[] = []
      for (let b = 0; b < 1; b += 0.002) pts.push(apport('onde', f, DIMS, { ...P, vitesseOnde: vitesse }, b).niveau)
      const max = Math.max(...pts)
      return pts.filter((n) => n > max / 2).length * 0.002
    }
    expect(largeur(1) / 1).toBeGreaterThan(0)
    // en temps de traversée : x6 dure moins de 6 fois moins que x1 car le front est plus large
    expect(largeur(6) * 6).toBeGreaterThan(largeur(1) * 1.5)
    expect(largeur(6) * 6).toBeLessThan(largeur(1) * 2.5)
  })
  it('toutes les lampes sont atteintes plus tôt', () => {
    const premier = (vitesse: number, f: Fixture): number => {
      for (let b = 0; b < 1; b += 0.005) if (apport('onde', f, DIMS, { ...P, vitesseOnde: vitesse }, b).niveau > 0.5) return b
      return 1
    }
    for (const f of LAMPES.slice(1)) expect(premier(4, f)).toBeLessThan(premier(1, f))
  })
  it('une vitesse inférieure à 1 est prise pour 1', () => {
    expect(apport('onde', LAMPES[1], DIMS, { ...P, vitesseOnde: 0.2 }, 0.3).niveau).toBe(apport('onde', LAMPES[1], DIMS, P, 0.3).niveau)
  })
})

describe('vitesse de l onde dans les couches', () => {
  const scene: Scene = { id: 'sc000001', nom: 't', effets: ['onde'], palette: 'neon', axe: 'x', source: { x: 50, y: 30, z: 35 }, intensite: 100 }
  const base = [nouvelleCouche('couleurs', { id: 'couleurs0' }), nouvelleCouche('scene', { id: 'scene000' })]
  const profil = (couches: Profil['couches']): Profil => ({ id: 'p', nom: 't', couches })
  const entree = (p: Profil, valeurs: Record<string, number>, ondeBase?: number) => ({ profil: p, valeurs, scene, scenes: [scene], commun: COMMUN_DEFAUT, declenches: {}, ondeBase })

  it('sans réglage, aucune clé dans les paramètres (comportement d origine)', () => {
    expect(versParams(etatInitial(COMMUN_DEFAUT, scene), DIMS, COMMUN_DEFAUT).params.vitesseOnde).toBeUndefined()
  })
  it('la vitesse réglée pour l écran sert de départ', () => {
    const { etat } = appliquer(entree(profil(base), {}, 6))
    expect(versParams(etat, DIMS, COMMUN_DEFAUT).params.vitesseOnde).toBe(6)
  })
  it('une rangée peut la régler avec le son, au-dessus de la scène', () => {
    const r = nouvelleCouche('modulation', { id: 'onde0000', signal: 'volume', cible: 'onde', mode: 'remplace', min: 1, max: 8, lissage: 0 })
    const bas = versParams(appliquer(entree(profil([r, ...base]), { onde0000: 0 }, 6)).etat, DIMS, COMMUN_DEFAUT).params.vitesseOnde
    const haut = versParams(appliquer(entree(profil([r, ...base]), { onde0000: 1 }, 6)).etat, DIMS, COMMUN_DEFAUT).params.vitesseOnde
    expect(bas).toBeUndefined()           // 1 : l onde d origine
    expect(haut).toBe(8)
  })
  it('reste entre 1 et 8 quoi que demande la rangée', () => {
    const r = nouvelleCouche('modulation', { id: 'onde0000', signal: 'volume', cible: 'onde', mode: 'ajoute', min: 0, max: 100, lissage: 0 })
    const v = versParams(appliquer(entree(profil([r, ...base]), { onde0000: 1 }, 6)).etat, DIMS, COMMUN_DEFAUT).params.vitesseOnde
    expect(v).toBe(8)
  })
})
