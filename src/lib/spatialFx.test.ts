import { describe, expect, it } from 'vitest'
import { COMMUN_DEFAUT, enveloppe, gainPulsation, arcEnCiel, teinte, apport, diagonale, etapeDuSet, evaluer, frappesEnSet, paramsDeScene, positionDansLeTemps, sourceMobile, tempoTape, type Dims, type FxId, type Fixture, type FxParams } from './spatialFx'
import { club, lieux, pieceReelle, salonEquipe } from './spatialVenues'
import type { Plan } from './plan'

const dims: Dims = { w: 500, h: 600, d: 230 }
const P: FxParams = { source: [0, 0, 100], axe: 'x', palette: 'neon', intensite: 1 }
const F = (pos: [number, number, number], kind: Fixture['kind'] = 'lampe'): Fixture => ({ id: 'f', kind, pos })

describe('effets dans l’espace', () => {
  it('onde de choc : l’appareil le plus proche flashe avant le plus lointain', () => {
    const pres = F([40, 0, 100]), loin = F([240, 0, 100])
    const pic = (f: Fixture) => { let best = 0, quand = 0; for (let b = 0; b < 1; b += 0.01) { const n = apport('onde', f, dims, P, b).niveau; if (n > best) { best = n; quand = b } } return quand }
    expect(pic(pres)).toBeLessThan(pic(loin))
    // à la source, le flash est tout au début du temps
    expect(apport('onde', F([0, 0, 100]), dims, P, 0).niveau).toBeCloseTo(1, 5)
    expect(apport('onde', F([0, 0, 100]), dims, P, 0.6).niveau).toBeLessThan(0.05)
  })

  it('mur de lumière : il traverse la pièce selon l’axe choisi, une fois par mesure', () => {
    const gauche = F([-240, 0, 100]), droite = F([240, 0, 100])
    expect(apport('mur', gauche, dims, P, 0.05).niveau).toBeGreaterThan(0.8)
    expect(apport('mur', droite, dims, P, 0.05).niveau).toBeLessThan(0.01)
    expect(apport('mur', droite, dims, P, 3.95).niveau).toBeGreaterThan(0.8)
    // sur l'axe vertical, c'est la hauteur qui compte, pas la place au sol
    const bas = F([200, 200, 5]), haut = F([-200, -200, 225])
    expect(apport('mur', bas, dims, { ...P, axe: 'z' }, 0.1).niveau).toBeGreaterThan(apport('mur', haut, dims, { ...P, axe: 'z' }, 0.1).niveau)
  })

  it('source mobile : elle fait un tour en 8 temps et éclaire ce qu’elle approche', () => {
    expect(sourceMobile(dims, P, 0)).toEqual([180, 0, 100])
    const [x, y] = sourceMobile(dims, P, 2)
    expect(x).toBeCloseTo(0, 5); expect(y).toBeCloseTo(216, 5)
    expect(sourceMobile(dims, P, 8)[0]).toBeCloseTo(180, 5)
    const sur = F([180, 0, 100]), oppose = F([-180, 0, 100])
    expect(apport('orbite', sur, dims, P, 0).niveau).toBeGreaterThan(0.99)
    expect(apport('orbite', oppose, dims, P, 0).niveau).toBeLessThan(apport('orbite', sur, dims, P, 0).niveau / 3)
  })

  it('marée : le bas s’allume avant le haut, tout est allumé à marée haute', () => {
    const bas = F([0, 0, 10]), haut = F([0, 0, 220])
    expect(apport('maree', bas, dims, P, 1.5).niveau).toBeGreaterThan(apport('maree', haut, dims, P, 1.5).niveau)
    expect(apport('maree', haut, dims, P, 4.5).niveau).toBeGreaterThan(0.6)
    expect(apport('maree', haut, dims, P, 0.5).niveau).toBeLessThan(0.05)
  })

  it('phare : le faisceau éclaire un côté puis l’autre', () => {
    const est = F([200, 0, 100]), ouest = F([-200, 0, 100])
    expect(apport('phare', est, dims, P, 0).niveau).toBeCloseTo(1, 5)
    expect(apport('phare', ouest, dims, P, 0).niveau).toBe(0)
    expect(apport('phare', ouest, dims, P, 2).niveau).toBeCloseTo(1, 5)
  })

  it('effets superposés : niveaux plafonnés, couleurs mélangées, intensité générale', () => {
    const f = F([0, 0, 100])
    const seul = evaluer(['onde'], f, dims, P, 0)
    const deux = evaluer(['onde', 'phare'], f, dims, P, 0)
    expect(seul.niveau).toBeCloseTo(1, 5)
    expect(deux.niveau).toBeLessThanOrEqual(1)
    expect(evaluer(['onde'], f, dims, { ...P, intensite: 0.4 }, 0).niveau).toBeCloseTo(0.4, 5)
    expect(evaluer([], f, dims, P, 0)).toEqual({ rgb: [0, 0, 0], niveau: 0, vise: null })
    expect(seul.rgb.every((c) => c >= 0 && c <= 1)).toBe(true)
  })

  it('un stroboscope ne claque que sur le temps ; une lyre vise ce que désigne l’effet', () => {
    const strobe = F([0, 0, 100], 'strobe')
    expect(evaluer(['onde'], strobe, dims, P, 0.02)).toMatchObject({ niveau: 1, rgb: [1, 1, 1] })
    expect(evaluer(['onde'], strobe, dims, P, 0.5).niveau).toBe(0)
    const lyre = F([100, 100, 220], 'projo')
    expect(evaluer(['onde'], lyre, dims, P, 0.3).vise).toEqual([0, 0, 100])
    const par: Fixture = { id: 'p', kind: 'par', pos: [0, 0, 200], aim: [10, 20, 0] }
    expect(evaluer(['onde'], par, dims, P, 0.3).vise).toEqual([10, 20, 0])        // un projecteur fixe ne bouge pas
  })

  it('tempo tapé : médiane des écarts, hors bornes ignoré', () => {
    expect(tempoTape([0, 500, 1000, 1500])).toBe(120)
    expect(tempoTape([0, 500])).toBeNull()
    expect(tempoTape([0, 480, 1000, 1500, 2010])).toBe(119)        // tapes un peu irrégulières : la médiane lisse
    expect(tempoTape([0, 5000, 10000, 15000])).toBeNull()
  })
})

describe('lieux du banc d’essai', () => {
  const plan: Plan = {
    roomDims: { w: 500, h: 600, d: 230 },
    configs: { a: { name: 'Play', pos: { x: -124, y: -270, z: -15 } }, b: { name: 'Back', pos: { x: -38, y: 281, z: -55 } } },
    strip: { segments: 2, segs: [{ pos: { x: 0, y: 100 }, angle: 0, length: 100, z: 150 }, { pos: { x: 100, y: 100 }, angle: 0, length: 100 }] },
  }

  it('ma pièce : lampes à leur hauteur depuis le sol, ruban point par point', () => {
    const v = pieceReelle(plan)
    expect(v.dims).toEqual({ w: 500, h: 600, d: 230 })
    expect(v.fixtures.filter((f) => f.kind === 'lampe').map((f) => f.pos)).toEqual([[-124, -270, 100], [-38, 281, 60]])
    const ruban = v.fixtures.filter((f) => f.kind === 'barre')
    expect(ruban).toHaveLength(4)
    expect(ruban[0].pos).toEqual([-25, 100, 150])
    expect(ruban[3].pos[2]).toBe(180)                  // hauteur jamais réglée : 1,80 m
  })

  it('les scènes simulées ont bien plus de points, tous dans la pièce, sans doublon', () => {
    for (const v of [salonEquipe(plan), club()]) {
      expect(v.fixtures.length).toBeGreaterThan(40)
      expect(new Set(v.fixtures.map((f) => f.id)).size).toBe(v.fixtures.length)
      for (const f of v.fixtures) {
        expect(Math.abs(f.pos[0])).toBeLessThanOrEqual(v.dims.w / 2)
        expect(Math.abs(f.pos[1])).toBeLessThanOrEqual(v.dims.h / 2)
        expect(f.pos[2]).toBeGreaterThanOrEqual(0); expect(f.pos[2]).toBeLessThanOrEqual(v.dims.d)
      }
    }
    expect(club().fixtures.filter((f) => f.kind === 'projo')).toHaveLength(12)
    expect(lieux(plan).map((v) => v.id)).toEqual(['piece', 'salon', 'club'])
    expect(diagonale(club().dims)).toBeGreaterThan(diagonale(plan.roomDims as never))
  })
})

describe('horloge de huebeat, pad et sets', () => {
  it('l’horloge avance au tempo ; sans tempo, elle attend le temps suivant comme huebeat', () => {
    expect(positionDansLeTemps(12, 0, 120)).toBe(12)
    expect(positionDansLeTemps(12, 0.25, 120)).toBeCloseTo(12.5, 5)
    expect(positionDansLeTemps(12, 0.9, 120)).toBeCloseTo(13.8, 5)        // un temps non détecté ne fige rien
    expect(positionDansLeTemps(0, 0.9, 0)).toBeCloseTo(0.999, 5)           // tempo inconnu : on attend le temps suivant
    expect(positionDansLeTemps(0, 0.25, 0)).toBeCloseTo(0.5, 5)
    expect(positionDansLeTemps(40, 10, 120)).toBeCloseTo(60, 5)
    // même règle que `avancer` de huebeat : sans tempo, on n'avance jamais au-delà du temps suivant (les lampes attendent)
    expect(positionDansLeTemps(3.4, 10, 0)).toBeCloseTo(3.999, 5)
    expect(positionDansLeTemps(3.4, 0.2, 0)).toBeCloseTo(3.8, 5)
  })

  it('une scène garde son point source en proportion de la pièce', () => {
    const p = paramsDeScene({ palette: 'fire', axe: 'z', source: { x: 20, y: 80, z: 50 }, intensite: 70 }, { w: 500, h: 600, d: 230 })
    expect(p.source[0]).toBeCloseTo(-150, 5); expect(p.source[1]).toBeCloseTo(180, 5); expect(p.source[2]).toBeCloseTo(115, 5)
    expect([p.axe, p.palette, p.intensite]).toEqual(['z', 'fire', 0.7])
  })

  it('un set avance mesure par mesure, boucle ou s’arrête', () => {
    const set = { pas: [{ scene: 'a', mesures: 2 }, { scene: 'b', mesures: 1 }], boucle: true }
    expect([0, 7.9, 8, 11.9, 12, 20].map((t) => etapeDuSet(set, t))).toEqual([0, 0, 1, 1, 0, 1])
    expect(etapeDuSet({ ...set, boucle: false }, 12)).toBe(-1)
    expect(etapeDuSet({ ...set, boucle: false }, 11.9)).toBe(1)
    expect(etapeDuSet({ pas: [], boucle: true }, 3)).toBe(-1)
  })

  it('ce qu’on joue au pad devient un set, arrondi à la mesure', () => {
    const pas = frappesEnSet([{ scene: 'a', beat: 0 }, { scene: 'b', beat: 8.4 }, { scene: 'b', beat: 12 }, { scene: 'c', beat: 17 }], 18)
    expect(pas).toEqual([{ scene: 'a', mesures: 2 }, { scene: 'b', mesures: 2 }, { scene: 'c', mesures: 1 }])
    expect(frappesEnSet([], 10)).toEqual([])
    expect(frappesEnSet([{ scene: 'a', beat: 0 }], 4000)[0].mesures).toBe(64)
  })
})

describe('raz de marée et arc-en-ciel', () => {
  const pres = F([30, 0, 20]), loin = F([230, 0, 20])

  it('la vague part du point : ce qui est près est submergé avant ce qui est loin', () => {
    expect(apport('raz', pres, dims, P, 0.4).niveau).toBeGreaterThan(0.5)
    expect(apport('raz', loin, dims, P, 0.4).niveau).toBe(0)
    expect(apport('raz', loin, dims, P, 2.5).niveau).toBeGreaterThan(0.4)
    // le point se déplace : la vague part d'ailleurs
    const ailleurs = { ...P, source: [230, 0, 100] as [number, number, number] }
    expect(apport('raz', loin, dims, ailleurs, 0.2).niveau).toBeGreaterThan(apport('raz', pres, dims, ailleurs, 0.2).niveau)
  })

  it('une lyre suit le front de la vague sans viser hors de la pièce', () => {
    const lyre = F([240, 280, 220], 'projo')
    for (const beat of [0.2, 1.5, 3.9]) {
      const v = evaluer(['raz'], lyre, dims, P, beat).vise!
      expect(Math.abs(v[0])).toBeLessThanOrEqual(dims.w / 2); expect(Math.abs(v[1])).toBeLessThanOrEqual(dims.h / 2); expect(v[2]).toBe(0)
    }
  })

  it('du sol, du plafond, ou du milieu vers le haut et le bas à la fois', () => {
    const bas = F([30, 0, 10]), milieu = F([30, 0, 100]), haut = F([30, 0, 220])
    const n = (f: typeof bas, depart: 'bas' | 'centre' | 'haut', beat: number) => apport('raz', f, dims, { ...P, depart }, beat).niveau
    // juste après le passage du front : seule la hauteur de départ est atteinte
    expect(n(bas, 'bas', 0.25)).toBeGreaterThan(n(haut, 'bas', 0.25))
    expect(n(haut, 'haut', 0.25)).toBeGreaterThan(n(bas, 'haut', 0.25))
    expect(n(milieu, 'centre', 0.25)).toBeGreaterThan(n(bas, 'centre', 0.25))
    expect(n(milieu, 'centre', 0.25)).toBeGreaterThan(n(haut, 'centre', 0.25))
    // un peu plus tard, toute la hauteur est sous l'eau
    for (const d of ['bas', 'centre', 'haut'] as const) { expect(n(bas, d, 1.5)).toBeGreaterThan(0.5); expect(n(haut, d, 1.5)).toBeGreaterThan(0.5) }
    expect(n(bas, 'bas', 0.25)).toBe(apport('raz', bas, dims, P, 0.25).niveau)       // sans précision : du sol
  })

  it('arc-en-ciel : la couleur dépend de l’endroit et défile avec le temps', () => {
    expect(teinte(0)).toEqual([1, 0, 0]); expect(teinte(1 / 3)).toEqual([0, 1, 0]); expect(teinte(2 / 3)).toEqual([0, 0, 1])
    expect(teinte(1.25)).toEqual(teinte(0.25)); expect(teinte(-0.25)).toEqual(teinte(0.75))
    const a = arcEnCiel([0, 0, 100], P.source, dims, 0), b = arcEnCiel([200, 0, 100], P.source, dims, 0)
    expect(a).toEqual([1, 0, 0]); expect(b).not.toEqual(a)
    expect(arcEnCiel([200, 0, 100], P.source, dims, 3)).not.toEqual(b)
    const s = evaluer(['maree'], F([200, 0, 10]), dims, { ...P, palette: 'arcenciel' }, 4)
    expect(s.rgb).toEqual(arcEnCiel([200, 0, 10], P.source, dims, 4)); expect(s.niveau).toBeGreaterThan(0)
    expect(evaluer([], F([0, 0, 0]), dims, { ...P, palette: 'arcenciel' }, 0).rgb).toEqual([0, 0, 0])
  })
})

describe('pulsation commune à toutes les scènes', () => {
  it('sans attaque, la lumière est pleine sur le temps puis s’éteint selon la retombée', () => {
    expect(enveloppe(0, { attaque: 0, retombee: 50 })).toBe(1)
    expect(enveloppe(0.9, { attaque: 0, retombee: 0 })).toBe(0)                     // fondu très court
    expect(enveloppe(0.5, { attaque: 0, retombee: 100 })).toBeGreaterThan(enveloppe(0.5, { attaque: 0, retombee: 20 }))
  })

  it('avec de l’attaque, elle monte d’abord', () => {
    const p = { attaque: 60, retombee: 50 }
    expect(enveloppe(0, p)).toBe(0)
    expect(enveloppe(0.15, p)).toBeGreaterThan(0); expect(enveloppe(0.15, p)).toBeLessThan(enveloppe(0.3, p))
    expect(enveloppe(0.3, p)).toBeCloseTo(1, 5)
  })

  it('profondeur et plancher', () => {
    expect(gainPulsation(0.7, undefined)).toBe(1)
    expect(gainPulsation(0.7, COMMUN_DEFAUT)).toBe(1)                                // profondeur 0 : l'effet seul
    const fort = { attaque: 0, retombee: 0, profondeur: 100, plancher: 0 }
    expect(gainPulsation(0, fort)).toBe(1); expect(gainPulsation(0.9, fort)).toBe(0)
    expect(gainPulsation(0.9, { ...fort, plancher: 30 })).toBeCloseTo(0.3, 5)        // il reste de la lumière entre deux temps
    expect(gainPulsation(0.9, { ...fort, profondeur: 50 })).toBeCloseTo(0.5, 5)
  })

  it('s’applique à la sortie d’un appareil, avec l’intensité générale', () => {
    const f = F([0, 0, 100])
    const sans = evaluer(['maree'], f, dims, P, 4.9).niveau
    const avec = evaluer(['maree'], f, dims, { ...P, general: 0.5, pulse: { attaque: 0, retombee: 0, profondeur: 100, plancher: 20 } }, 4.9).niveau
    expect(avec).toBeCloseTo(sans * 0.5 * 0.2, 5)
    const p = paramsDeScene({ palette: 'neon', axe: 'x', source: { x: 50, y: 50, z: 50 }, intensite: 100 }, dims, { ...COMMUN_DEFAUT, intensite: 40 })
    expect(p.general).toBe(0.4); expect(p.pulse?.retombee).toBe(60)
  })
})

describe('personnalisation du pad', () => {
  it('une palette libre joue les couleurs de la scène', async () => {
    const { couleursDe, deplacerTouche, PALETTES } = await import('./spatialFx')
    expect(couleursDe({ palette: 'libre', couleurs: ['#112233'] })).toEqual(['#112233'])
    expect(couleursDe({ palette: 'libre' })).toEqual(PALETTES.neon.couleurs)
    expect(couleursDe({ palette: 'fire', couleurs: ['#112233'] })).toEqual(PALETTES.fire.couleurs)
    expect(deplacerTouche(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(deplacerTouche(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
    expect(deplacerTouche(['a', 'b'], 'z', 1)).toEqual(['a', 'b'])
  })
})

describe('mode 2d', () => {
  it('tout réagit sur le temps, sans trajet ; une sur deux en alternance', async () => {
    const { evaluer, rangs } = await import('./spatialFx')
    const dims = { w: 400, h: 300, d: 240 }
    const p = { mode: '2d' as const, source: [0, 0, 100] as [number, number, number], axe: 'x' as const, palette: 'neutron', intensite: 1, pulse: { attaque: 0, retombee: 60, profondeur: 0, plancher: 0 } }
    const pres = { id: 'a', kind: 'lampe' as const, pos: [0, 0, 100] as [number, number, number] }
    const loin = { id: 'b', kind: 'lampe' as const, pos: [190, 140, 0] as [number, number, number] }
    expect(rangs([[50, 0, 0], [-100, 0, 0], [0, 0, 0]])).toEqual([2, 0, 1])
    expect(evaluer(['onde'], pres, dims, p, 4).niveau).toBe(1)
    expect(evaluer(['onde'], loin, dims, p, 4, 1).niveau).toBe(1)          // la distance ne retarde rien
    expect(evaluer([], pres, dims, p, 4.5).niveau).toBeLessThan(0.2)
    expect(evaluer([], pres, dims, p, 3).rgb).toEqual([0, 0, 1])          // bleu, puis rouge au temps suivant
    expect(evaluer([], pres, dims, p, 4).rgb).toEqual([1, 0, 0])
    const alt = { ...p, groupe: 'alterne' as const }
    expect([evaluer([], pres, dims, alt, 4, 0).niveau, evaluer([], pres, dims, alt, 4, 1).niveau]).toEqual([1, 0])
    expect([evaluer([], pres, dims, alt, 5, 0).niveau, evaluer([], pres, dims, alt, 5, 1).niveau]).toEqual([0, 1])
    expect(evaluer([], pres, dims, { ...alt, pulse: { ...p.pulse, plancher: 20 } }, 4, 1).niveau).toBeCloseTo(0.2)
  })
  it('durée de vie : une pulsation s’étale sur 1, 2, 4 ou 8 temps', async () => {
    const { evaluer, tempsDeVie, phaseDeVie } = await import('./spatialFx')
    expect([0, 33, 67, 100].map(tempsDeVie)).toEqual([1, 2, 4, 8])
    expect(phaseDeVie(5.5, 67)).toEqual({ n: 1, phase: 0.375 })
    expect(phaseDeVie(5.5, undefined)).toEqual({ n: 5, phase: 0.5 })                 // sans réglage : un temps
    const dims = { w: 400, h: 300, d: 240 }, f = { id: 'a', kind: 'lampe' as const, pos: [0, 0, 100] as [number, number, number] }
    const p = { mode: '2d' as const, groupe: 'alterne' as const, source: [0, 0, 100] as [number, number, number], axe: 'x' as const, palette: 'neutron', intensite: 1, pulse: { attaque: 50, retombee: 60, profondeur: 0, plancher: 0, vie: 67 } }
    const n = (beat: number, rang = 0) => evaluer([], f, dims, p, beat, rang).niveau
    expect(n(0.5)).toBeLessThan(n(1.5))                    // elle monte sur plusieurs temps…
    expect(n(3.5)).toBeLessThan(n(1.5))                    // …puis repart
    expect([n(2, 1), n(4, 1) > 0]).toEqual([0, false])     // l’autre moitié attend la pulsation suivante
    expect(n(4.9, 1)).toBeGreaterThan(0)
    expect(evaluer([], f, dims, p, 1).rgb).toEqual(evaluer([], f, dims, p, 3).rgb)   // une couleur par pulsation
  })
})

describe('réglages propres à chaque effet', () => {
  const dims = { w: 400, h: 300, d: 240 }
  const f = { id: 'a', kind: 'lampe' as const, pos: [0, 0, 20] as [number, number, number] }
  const scene = { effets: ['maree', 'orbite'] as FxId[], palette: 'neon', axe: 'x' as const, source: { x: 50, y: 50, z: 50 }, intensite: 100 }

  it('la scène se convertit effet par effet, ce qui manque vient de la scène et des réglages communs', async () => {
    const { paramsDeScene, COMMUN_DEFAUT: C } = await import('./spatialFx')
    const p = paramsDeScene({ ...scene, reglages: { maree: { palette: 'fire', intensite: 50, respiration: { profondeur: 80 }, tempo: 0.5, source: { x: 0, y: 50, z: 0 } } } }, dims, { ...C, retombee: 30 })
    const m = p.couches?.maree
    expect(m?.palette).toBe('fire'); expect(m?.intensite).toBe(0.5); expect(m?.tempo).toBe(0.5)
    expect(m?.source).toEqual([-200, 0, 0])
    expect(m?.pulse).toEqual({ ...C, retombee: 30, profondeur: 80 })          // la respiration de l’effet, le reste en commun
    expect(p.couches?.orbite).toBeUndefined()
  })

  it('sans réglage propre, rien ne change ; avec, chaque effet joue avec les siens', async () => {
    const { evaluer, paramsDeScene } = await import('./spatialFx')
    const base = paramsDeScene(scene, dims)
    const seul = paramsDeScene({ ...scene, reglages: {} }, dims)
    expect(evaluer(['maree'], f, dims, seul, 5.3)).toEqual(evaluer(['maree'], f, dims, base, 5.3))
    // intensité propre à la marée : sa lumière est divisée par deux
    const demi = paramsDeScene({ ...scene, reglages: { maree: { intensite: 50 } } }, dims)
    expect(evaluer(['maree'], f, dims, demi, 5.3).niveau).toBeCloseTo(evaluer(['maree'], f, dims, base, 5.3).niveau / 2, 5)
    // tempo propre : deux fois plus lent = la même image au double du temps
    const lent = paramsDeScene({ ...scene, reglages: { orbite: { tempo: 0.5 } } }, dims)
    expect(evaluer(['orbite'], f, dims, lent, 6).niveau).toBeCloseTo(evaluer(['orbite'], f, dims, base, 3).niveau, 5)
    // couleurs propres : la marée en feu, la source mobile reste en néon
    const feu = paramsDeScene({ ...scene, reglages: { maree: { palette: 'libre', couleurs: ['#ff0000'] } } }, dims)
    expect(evaluer(['maree'], f, dims, feu, 5.3).rgb).toEqual([1, 0, 0])
    expect(evaluer(['orbite'], f, dims, feu, 5.3).rgb).toEqual(evaluer(['orbite'], f, dims, base, 5.3).rgb)
  })
})
