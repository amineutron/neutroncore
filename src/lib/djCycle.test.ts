import { describe, expect, it } from 'vitest'
import { CYCLE_DEFAUT, HISTORIQUE_VIDE, ajouterFlux, estimerCycle, positionDansMesure, type HistoriqueFlux } from './djCycle'
import { suiteRythmee } from './djBench'

/** L'historique d'un rythme connu après `secondes` de musique. */
function historique(bpm: number, mesure: 3 | 4, secondes: number, opts: { oubli?: number; oubliUn?: number } = {}): HistoriqueFlux {
  let h = HISTORIQUE_VIDE
  for (const im of suiteRythmee(bpm, mesure, secondes, opts).images) h = ajouterFlux(h, im.spec, im.t, CYCLE_DEFAUT.fenetreS)
  return h
}
const proche = (a: number, b: number, tol = 0.03): boolean => Math.abs(a / b - 1) < tol

describe('cycle : tempo et mesure', () => {
  it.each([[92, 4], [120, 4], [128, 4], [140, 4], [105, 3], [128, 3]] as const)('trouve %i par minute en %i temps', (bpm, m) => {
    const e = estimerCycle(historique(bpm, m, 20))!
    expect(proche(e.bpm, bpm)).toBe(true)
    expect(e.mesure).toBe(m)
    expect(e.confiance).toBeGreaterThan(0.45)
  })
  it('tient avec la moitié des grosses caisses absentes', () => {
    const e = estimerCycle(historique(128, 4, 20, { oubli: 0.6 }))!
    expect(proche(e.bpm, 128)).toBe(true)
  })
  it('ne devine rien sur un son sans relief ni sur trop peu de musique', () => {
    expect(estimerCycle(HISTORIQUE_VIDE)).toBeNull()
    expect(estimerCycle(historique(128, 4, 3))).toBeNull()
    let h = HISTORIQUE_VIDE
    for (let i = 0; i < 600; i++) h = ajouterFlux(h, new Array(96).fill(40), i / 30, 14)
    expect(estimerCycle(h)).toBeNull()
  })
  it('respecte une mesure imposée', () => {
    const e = estimerCycle(historique(120, 4, 20), { ...CYCLE_DEFAUT, mesure: 3 })
    expect(e === null || e.mesure === 3).toBe(true)
  })
  it('respecte la plage de tempo permise', () => {
    const e = estimerCycle(historique(128, 4, 20), { ...CYCLE_DEFAUT, bpmMin: 70, bpmMax: 100 })
    expect(e === null || e.bpm <= 100).toBe(true)
  })
  it('départage un tempo de son double avec l indice des grosses caisses', () => {
    const h = historique(150, 4, 20, { oubli: 0.75, oubliUn: 0.3 })
    const e = estimerCycle(h, CYCLE_DEFAUT, { indice: 150 })!
    expect(proche(e.bpm, 150)).toBe(true)
  })
})

describe('cycle : le premier temps de la mesure', () => {
  it('le « un » trouvé tombe sur un vrai premier temps (à un huitième de temps près)', () => {
    for (const [bpm, m] of [[120, 4], [128, 4], [105, 3]] as const) {
      const h = historique(bpm, m, 20)
      const e = estimerCycle(h)!
      expect(e.premierTemps).not.toBeNull()
      const P = 60 / bpm
      const k = (e.premierTemps! - 0.31) / (m * P)                 // le vrai « un » est à 0,31 s + un nombre entier de mesures
      expect(Math.abs(k - Math.round(k))).toBeLessThan(0.125 / m)
    }
  })
  it('positionDansMesure compte de 0 au « un » à la mesure exclue', () => {
    expect(positionDansMesure(10, 120, 4, 10)).toBeCloseTo(0)
    expect(positionDansMesure(10, 120, 4, 11)).toBeCloseTo(2)
    expect(positionDansMesure(10, 120, 4, 12.2)).toBeCloseTo(0.4)
    expect(positionDansMesure(10, 120, 4, 9.5)).toBeCloseTo(3)
  })
})
