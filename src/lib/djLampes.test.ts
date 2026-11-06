import { describe, expect, it } from 'vitest'
import { COMMUN_DEFAUT, evaluer, paramsDeScene, rangs, type Scene } from './spatialFx'
import { couleursCanaux, decoderTrame, encoderTrame, lireCanaux } from './djLampes'

const DIMS = { w: 400, h: 400, d: 250 }
const SCENE: Scene = { id: 's', nom: 'vague', effets: ['onde'], palette: 'neon', axe: 'x', source: { x: 50, y: 50, z: 50 }, intensite: 100 }
const CANAUX = lireCanaux({ 0: [-150, 0, 100], 1: [0, 0, 100], 2: [150, 0, 100] })

describe('canaux', () => {
  it('range par numéro et écarte ce qui est inutilisable', () => {
    const c = lireCanaux({ 6: [1, 2, 3], 0: [4, 5, 6], x: [0, 0, 0], 300: [0, 0, 0], 2: [1, 2], 3: [1, Number.NaN, 3] })
    expect(c.map((k) => k.id)).toEqual([0, 6])
    expect(lireCanaux(null)).toEqual([])
  })
})

describe('trame', () => {
  it('encode canal + 3 composantes en 16 bits, grand-boutiste, comme huebeat l’attend', () => {
    const t = encoderTrame([{ id: 3, rgb: [1, 0.5, 0] }])
    expect([...t]).toEqual([3, 0xff, 0xff, 0x80, 0x00, 0x00, 0x00])
  })
  it('ramène les valeurs hors bornes ou invalides dans 0..1', () => {
    const [c] = decoderTrame(encoderTrame([{ id: 1, rgb: [-3, 2, Number.NaN] }]))
    expect(c.rgb).toEqual([0, 1, 0])
  })
  it('aller-retour fidèle à 1/65535 près', () => {
    const src = [{ id: 0, rgb: [0.1, 0.25, 0.9] as [number, number, number] }, { id: 5, rgb: [0, 1, 0.333] as [number, number, number] }]
    const rel = decoderTrame(encoderTrame(src))
    rel.forEach((c, i) => { expect(c.id).toBe(src[i].id); c.rgb.forEach((v, k) => expect(Math.abs(v - src[i].rgb[k])).toBeLessThan(1 / 65535)) })
  })
  it('une trame de 7 canaux fait 49 octets, sous la limite de l’API', () => {
    expect(encoderTrame(lireCanaux({ 0: [0, 0, 0], 1: [0, 0, 0], 2: [0, 0, 0], 3: [0, 0, 0], 4: [0, 0, 0], 5: [0, 0, 0], 6: [0, 0, 0] }).map((c) => ({ id: c.id, rgb: [0, 0, 0] as [number, number, number] }))).length).toBe(49)
  })
})

describe('couleur de chaque canal', () => {
  const params = paramsDeScene(SCENE, DIMS, COMMUN_DEFAUT)
  const beats = Array.from({ length: 40 }, (_, i) => i / 10)
  const somme = (beat: number, p = params) => couleursCanaux(CANAUX, SCENE.effets, p, DIMS, beat, false).reduce((t, c) => t + c.rgb[0] + c.rgb[1] + c.rgb[2], 0)

  it('une couleur par canal, dans 0..1', () => {
    for (const b of beats) {
      const c = couleursCanaux(CANAUX, SCENE.effets, params, DIMS, b, false)
      expect(c.map((k) => k.id)).toEqual([0, 1, 2])
      c.forEach((k) => k.rgb.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) }))
    }
  })
  it('la scène éclaire quelque chose à un moment, et pas tout le temps la même chose', () => {
    const s = beats.map((b) => somme(b))
    expect(Math.max(...s)).toBeGreaterThan(0.1)
    expect(Math.max(...s) - Math.min(...s)).toBeGreaterThan(0.05)
  })
  it('le silence éteint tout', () => {
    for (const b of beats) couleursCanaux(CANAUX, SCENE.effets, params, DIMS, b, true).forEach((k) => expect(k.rgb).toEqual([0, 0, 0]))
  })
  it('l’intensité générale à 0 éteint tout', () => {
    for (const b of beats) expect(somme(b, { ...params, general: 0 })).toBe(0)
  })
  it('3d : gamma perceptuel (carré de couleur x niveau), comme sortie_lampe de huebeat', () => {
    const p3 = { ...params, mode: '3d' as const }
    const rg = rangs(CANAUX.map((c) => c.pos))
    for (const b of beats) {
      couleursCanaux(CANAUX, SCENE.effets, p3, DIMS, b, false).forEach((k, i) => {
        const s = evaluer(SCENE.effets, { id: 'x', kind: 'lampe', pos: CANAUX[i].pos }, DIMS, p3, b, rg[i])
        k.rgb.forEach((v, c) => expect(v).toBeCloseTo((s.rgb[c] * s.niveau) ** 2, 10))
      })
    }
  })
  it('2d : linéaire (le niveau y est déjà une enveloppe au carré)', () => {
    const p2 = { ...params, mode: '2d' as const, groupe: 'tous' as const }
    const rg = rangs(CANAUX.map((c) => c.pos))
    for (const b of beats) {
      couleursCanaux(CANAUX, SCENE.effets, p2, DIMS, b, false).forEach((k, i) => {
        const s = evaluer(SCENE.effets, { id: 'x', kind: 'lampe', pos: CANAUX[i].pos }, DIMS, p2, b, rg[i])
        k.rgb.forEach((v, c) => expect(v).toBeCloseTo(s.rgb[c] * s.niveau, 10))
      })
    }
  })
  it('un canal plus loin du front de l’onde s’allume plus tard (la lumière voyage dans la pièce)', () => {
    const pic = (id: number) => beats.map((b) => ({ b, v: couleursCanaux(CANAUX, SCENE.effets, params, DIMS, b, false).find((k) => k.id === id)!.rgb.reduce((a, x) => a + x, 0) })).sort((x, y) => y.v - x.v)[0].b
    expect(new Set([pic(0), pic(1), pic(2)]).size).toBeGreaterThan(1)
  })
})
