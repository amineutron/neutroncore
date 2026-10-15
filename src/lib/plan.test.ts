import { describe, expect, it } from 'vitest'
import { fromSvg, heightFromFloor, isDirty, moveLight, moveSeg, normAngle, resizeRoom, rotateSeg, segEnds, setHeight, toPayload, toSvg, zFromHeight, type Plan, addSeg, removeSeg, resampleStrip, segHeight, setSegHeight, setSegLength } from './plan'

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
  it('sans ruban : dimensions et positions seulement (jamais la TV)', () => {
    const payload = toPayload(plan())
    expect(Object.keys(payload)).toEqual(['roomDims', 'configs'])
    expect(payload.configs['1']).toEqual({ pos: { x: -61.1, y: 224.9, z: -80 }, name: 'Hue' })
  })
  it('isDirty', () => {
    expect(isDirty(plan(), plan())).toBe(false)
    expect(isDirty(plan(), moveLight(plan(), '1', { x: 0, y: 0 }))).toBe(true)
  })
})

describe('ruban LED', () => {
  const withStrip = (): Plan => ({
    ...plan(),
    strip: { segments: 2, segs: [{ pos: { x: 0, y: 180 }, angle: -90, length: 67 }, { pos: { x: 50, y: 120 }, angle: 0, length: 50 }] },
  })

  it('extrémités : à plat le long de la largeur, à -90° le long de la profondeur', () => {
    const [a, b] = segEnds({ pos: { x: 50, y: 120 }, angle: 0, length: 50 })
    expect([a, b]).toEqual([{ x: 25, y: 120 }, { x: 75, y: 120 }])
    const [c, d] = segEnds({ pos: { x: 0, y: 180 }, angle: -90, length: 60 })
    expect(c.x).toBeCloseTo(0); expect(c.y).toBeCloseTo(210); expect(d.y).toBeCloseTo(150)
  })

  it('déplacer un seul segment laisse les autres en place', () => {
    const p = moveSeg(withStrip(), 0, { x: -100, y: 0 }, false)
    expect(p.strip?.segs?.map((s) => s.pos)).toEqual([{ x: -100, y: 0 }, { x: 50, y: 120 }])
  })

  it('déplacer tout le ruban garde sa forme', () => {
    const p = moveSeg(withStrip(), 0, { x: -100, y: 100 }, true)
    expect(p.strip?.segs?.map((s) => s.pos)).toEqual([{ x: -100, y: 100 }, { x: -50, y: 40 }])
  })

  it('tout le ruban bute contre le mur sans se déformer', () => {
    const p = moveSeg(withStrip(), 0, { x: 9999, y: 9999 }, true)
    const [a, b] = p.strip!.segs!
    expect(b.pos.x).toBe(245)                       // le segment le plus à droite touche le mur
    expect(a.pos.y).toBe(295)                       // le plus au fond aussi
    expect([b.pos.x - a.pos.x, b.pos.y - a.pos.y]).toEqual([50, -60])   // écart d'origine conservé
  })

  it('segment inconnu ou plan sans ruban : inchangé', () => {
    const p = withStrip()
    expect(moveSeg(p, 7, { x: 0, y: 0 }, false).strip).toEqual(p.strip)
    const bare = plan()
    expect(moveSeg(bare, 0, { x: 0, y: 0 }, true)).toBe(bare)
    expect(rotateSeg(bare, 0, 30)).toBe(bare)
  })

  it.each([[270, -90], [-200, 160], [180, 180], [-180, 180], [0, 0], [725, 5], [12.34, 12.3]])('angle %d normalisé en %d', (input, out) => {
    expect(normAngle(input)).toBe(out)
  })

  it('tourner un segment, sans muter', () => {
    const before = withStrip()
    const after = rotateSeg(before, 1, 45)
    expect(after.strip?.segs?.[1].angle).toBe(45)
    expect(before.strip?.segs?.[1].angle).toBe(0)
    expect(rotateSeg(before, 1, Number.NaN)).toBe(before)
  })

  it('l’envoi porte position, angle et longueur du ruban ; la hauteur seulement si elle a été réglée', () => {
    const envoye = toPayload(withStrip()).strip!.segs
    expect(envoye.map((s) => [s.pos, s.angle])).toEqual([[{ x: 0, y: 180 }, -90], [{ x: 50, y: 120 }, 0]])
    expect(envoye.every((s) => typeof s.length === 'number' && !('z' in s))).toBe(true)
    expect(toPayload(setSegHeight(withStrip(), 0, 150, false)).strip!.segs.map((s) => s.z)).toEqual([150, undefined])
    expect(isDirty(withStrip(), rotateSeg(withStrip(), 0, 10))).toBe(true)
    expect(isDirty(withStrip(), withStrip())).toBe(false)
  })

  it('un ruban non modifié n’est pas renvoyé (déplacer une lampe ne réécrit pas le ruban)', () => {
    const saved = withStrip()
    const lampMoved = moveLight(saved, '1', { x: 0, y: 0 })
    expect(toPayload(lampMoved, saved).strip).toBeUndefined()
    expect(toPayload(rotateSeg(saved, 0, 10), saved).strip?.segs).toHaveLength(2)
  })

  it('la révision lue est renvoyée, sans compter comme une modification', () => {
    const saved = { ...withStrip(), rev: 'abc123' }
    expect(toPayload(saved, saved).rev).toBe('abc123')
    expect(isDirty(saved, { ...saved, rev: 'autre' })).toBe(false)
  })

  it('un ruban plus large que la pièce peut encore bouger, sans saut', () => {
    const wide: Plan = { ...plan(), strip: { segments: 2, segs: [{ pos: { x: -300, y: 0 }, angle: 0, length: 50 }, { pos: { x: 300, y: 0 }, angle: 0, length: 50 }] } }
    // aucun déplacement horizontal possible sans aggraver un côté : il reste en place au lieu de sauter
    expect(moveSeg(wide, 0, { x: -290, y: 0 }, true).strip?.segs?.map((s) => s.pos.x)).toEqual([-300, 300])
    // l'autre axe reste libre
    expect(moveSeg(wide, 0, { x: -300, y: 40 }, true).strip?.segs?.map((s) => s.pos.y)).toEqual([40, 40])
  })

  it('un segment hors bornes peut revenir vers l’intérieur', () => {
    const out: Plan = { ...plan(), strip: { segments: 1, segs: [{ pos: { x: 260, y: 0 }, angle: 0, length: 50 }] } }
    expect(moveSeg(out, 0, { x: 200, y: 0 }, true).strip?.segs?.[0].pos.x).toBe(200)
    expect(moveSeg(out, 0, { x: 280, y: 0 }, true).strip?.segs?.[0].pos.x).toBe(260)   // ne s'éloigne pas davantage
  })

  it('rétrécir la pièce ramène aussi le ruban à l’intérieur', () => {
    expect(resizeRoom(withStrip(), 'h', 300).strip?.segs?.[0].pos.y).toBe(145)
  })
})

describe('ruban : hauteur, longueur, nombre de segments', () => {
  const dims = { w: 500, h: 400, d: 250 }
  const plan: Plan = { roomDims: dims, configs: {}, strip: { segments: 2, segs: [
    { pos: { x: 0, y: -100 }, angle: 90, length: 100, z: null },      // descend le long de y, de -150 à -50
    { pos: { x: 50, y: -50 }, angle: 0, length: 100 },                // puis part vers la droite, de 0 à 100
  ] } }

  it('une hauteur jamais réglée vaut 1,80 m, ou 20 cm sous un plafond bas', () => {
    expect(segHeight(plan.strip!.segs![0], dims)).toBe(180)
    expect(segHeight(plan.strip!.segs![0], { ...dims, d: 150 })).toBe(130)
    expect(segHeight({ ...plan.strip!.segs![0], z: 999 }, dims)).toBe(250)
  })

  it('monter un segment monte tout le ruban du même écart, ou ce segment seul', () => {
    const tout = setSegHeight(plan, 0, 200, true).strip!.segs!
    expect(tout.map((s) => s.z)).toEqual([200, 200])
    const seul = setSegHeight(plan, 1, 90, false).strip!.segs!
    expect(seul.map((s) => s.z ?? null)).toEqual([null, 90])
    expect(setSegHeight(plan, 0, 9999, true).strip!.segs![0].z).toBe(250)
    expect(setSegHeight(plan, 0, NaN, true)).toBe(plan)
  })

  it('longueur bornée', () => {
    expect(setSegLength(plan, 0, 42.26).strip!.segs![0].length).toBe(42.3)
    expect(setSegLength(plan, 0, 0).strip!.segs![0].length).toBe(3)
    expect(setSegLength(plan, 1, 99999).strip!.segs![1].length).toBe(1000)
  })

  it('ajouter prolonge le segment choisi, retirer en laisse toujours un', () => {
    const plus = addSeg(plan, 1).strip!
    expect(plus.segments).toBe(3)
    expect(addSeg(plan, 0).strip!.segs![1].pos).toEqual({ x: 0, y: 0 })      // inséré juste après le segment choisi
    expect(plus.segs![2]).toMatchObject({ pos: { x: 150, y: -50 }, angle: 0, length: 100 })
    const un = removeSeg(removeSeg(plan, 0), 0).strip!
    expect(un.segments).toBe(1)
  })

  it('redécoupe en gardant le tracé : le vrai découpage du ruban Hue', () => {
    const parts = [1, 1, 3, 3, 3, 1, 1]
    const r = resampleStrip(plan, parts).strip!
    expect(r.segments).toBe(7)
    expect(r.segs!.reduce((t, s) => t + s.length, 0)).toBeCloseTo(200, 0)
    expect(r.segs!.map((s) => Math.round(s.length))).toEqual([15, 15, 46, 46, 46, 15, 15])
    // le quatrième a son milieu pile sur l'angle : il reste sur le premier morceau
    expect(r.segs!.map((s) => s.angle)).toEqual([90, 90, 90, 90, 0, 0, 0])
    expect(r.segs![0].pos).toEqual({ x: 0, y: -142.3 })
    expect(r.segs![6].pos.x).toBeCloseTo(92.3, 1)
    expect(resampleStrip(plan, [])).toBe(plan)
    expect(resampleStrip(plan, [1, -1])).toBe(plan)
  })
})
