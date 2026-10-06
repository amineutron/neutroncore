import { describe, expect, it } from 'vitest'
import { fromSvg, heightFromFloor, isDirty, moveLight, resizeRoom, setHeight, toPayload, toSvg, zFromHeight, type Plan } from './plan'

const dims = { w: 500, h: 600, d: 270 }
const plan = (): Plan => ({
  roomDims: dims,
  configs: { 1: { pos: { x: -61.1, y: 224.9, z: -80 }, name: 'Hue', haloId: 'l3' }, l1: { pos: { x: -124.5, y: -270, z: -25 }, name: 'Play' } },
  tv: { pos: { x: 114.5, y: -282, z: 116 } },
})

describe('repères', () => {
  it('le centre de la pièce tombe au milieu du dessin, et retour', () => {
    expect(toSvg({ x: 0, y: 0 }, dims)).toEqual({ x: 250, y: 300 })
    expect(fromSvg(toSvg({ x: -61.1, y: 224.9 }, dims), dims)).toEqual({ x: -61.1, y: 224.9 })
  })
  it('un point hors des murs est ramené dans la pièce', () => {
    expect(fromSvg({ x: -40, y: 9999 }, dims)).toEqual({ x: -245, y: 295 })
  })
  it('hauteur depuis le sol', () => {
    expect(heightFromFloor(-80, dims)).toBe(55)
    expect(zFromHeight(55, dims)).toBe(-80)
    expect(zFromHeight(999, dims)).toBe(135)      // pas au-dessus du plafond
    expect(zFromHeight(-5, dims)).toBe(-135)      // ni sous le sol
  })
})

describe('édition', () => {
  it('déplacer ne touche ni la hauteur ni les autres lampes, sans muter', () => {
    const before = plan()
    const after = moveLight(before, '1', { x: 10, y: 20 })
    expect(after.configs['1'].pos).toEqual({ x: 10, y: 20, z: -80 })
    expect(after.configs.l1).toBe(before.configs.l1)
    expect(before.configs['1'].pos.x).toBe(-61.1)
  })
  it('lampe inconnue : plan inchangé', () => {
    const p = plan()
    expect(moveLight(p, 'nope', { x: 0, y: 0 })).toBe(p)
    expect(setHeight(p, 'nope', 100)).toBe(p)
  })
  it('régler la hauteur', () => {
    expect(setHeight(plan(), 'l1', 200).configs.l1.pos).toEqual({ x: -124.5, y: -270, z: 65 })
  })
  it('rétrécir la pièce ramène les lampes à l’intérieur', () => {
    const p = resizeRoom(plan(), 'h', 300)
    expect(p.roomDims.h).toBe(300)
    expect(p.configs['1'].pos.y).toBe(145)
    expect(p.configs.l1.pos.y).toBe(-145)
  })
  it('changer la hauteur de plafond garde la hauteur des lampes depuis le sol', () => {
    const p = resizeRoom(plan(), 'd', 300)
    expect(heightFromFloor(p.configs['1'].pos.z, p.roomDims)).toBe(55)
  })
  it.each([[5, 100], [99999, 3000], [412.6, 413]])('dimension %d bornée à %d', (v, out) => {
    expect(resizeRoom(plan(), 'w', v).roomDims.w).toBe(out)
  })
  it('une saisie vide (NaN) ne casse pas le plan', () => {
    const p = plan()
    expect(resizeRoom(p, 'w', Number.NaN)).toBe(p)
  })
})

describe('envoi', () => {
  it('n’envoie que dimensions et positions (pas la TV ni le ruban)', () => {
    const payload = toPayload(plan())
    expect(Object.keys(payload)).toEqual(['roomDims', 'configs'])
    expect(payload.configs['1']).toEqual({ pos: { x: -61.1, y: 224.9, z: -80 }, name: 'Hue' })
  })
  it('isDirty', () => {
    expect(isDirty(plan(), plan())).toBe(false)
    expect(isDirty(plan(), moveLight(plan(), '1', { x: 0, y: 0 }))).toBe(true)
  })
})
