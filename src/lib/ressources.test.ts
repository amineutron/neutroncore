import { describe, expect, it } from 'vitest'
import {
  basculer, chemin, fmtDebit, fmtOctets, fmtValeur, lireFiltres, nonAttribue, plafond, procheDe, ton,
  type Echelle, type Gpu, type Point,
} from './ressources'

const E: Echelle = { t0: 0, t1: 100, max: 100, w: 200, h: 100 }
const P = (t: number, o: Partial<Point> = {}): Point => ({ t, ...o })

describe('ressources : mise en forme', () => {
  it('débits', () => {
    expect([fmtDebit(0), fmtDebit(900), fmtDebit(2048), fmtDebit(50 * 1024), fmtDebit(3 * 1024 ** 2), fmtDebit(2 * 1024 ** 3)])
      .toEqual(['0 o/s', '900 o/s', '2,0 Ko/s', '50 Ko/s', '3,0 Mo/s', '2,0 Go/s'])
    expect(fmtDebit(-5)).toBe('0 o/s')
  })
  it('valeurs et octets', () => {
    expect(fmtValeur(42.34, '%')).toBe('42,3 %')
    expect(fmtValeur(null, '°C')).toBe('—')
    expect(fmtValeur(NaN, '%')).toBe('—')
    expect(fmtValeur(2048, 'o/s')).toBe('2,0 Ko/s')
    expect([fmtOctets(500 * 1024), fmtOctets(300 * 1024 ** 2), fmtOctets(1.5 * 1024 ** 3)]).toEqual(['500 Ko', '300 Mo', '1,5 Go'])
  })
  it('teinte selon le seuil', () => {
    const s = { warn: 80, crit: 95 }
    expect([ton(10, s), ton(80, s), ton(94.9, s), ton(95, s), ton(null, s), ton(99, undefined)]).toEqual(['ok', 'warn', 'warn', 'crit', 'ok', 'ok'])
  })
})

describe('ressources : courbes', () => {
  it('plafond de l\'axe', () => {
    expect(plafond([P(0, { rx: 120 }), P(1, { rx: 4300 })], ['rx'])).toBe(5000)
    expect(plafond([P(0, { tcpu: 61 })], ['tcpu'])).toBe(70)
    expect(plafond([], ['rx'])).toBe(1)
    expect(plafond([P(0, { cpu: 3 })], ['cpu'], 100)).toBe(100)
  })
  it('chemin : coordonnées et trous de mesure', () => {
    expect(chemin([P(0, { cpu: 0 }), P(100, { cpu: 100 })], 'cpu', E)).toBe('M0.0 100.0L200.0 0.0')
    // une valeur absente coupe la ligne : nouveau M, pas de L à travers le trou
    expect(chemin([P(0, { cpu: 50 }), P(50), P(100, { cpu: 50 })], 'cpu', E)).toBe('M0.0 50.0M200.0 50.0')
    expect(chemin([], 'cpu', E)).toBe('')
    // valeurs hors bornes écrêtées
    expect(chemin([P(0, { cpu: 250 })], 'cpu', E)).toBe('M0.0 0.0')
  })
  it('point le plus proche', () => {
    const pts = [P(0), P(40), P(100)]
    expect(procheDe(pts, 85, E)?.t).toBe(40)
    expect(procheDe(pts, 190, E)?.t).toBe(100)
    expect(procheDe([], 10, E)).toBeNull()
  })
})

describe('ressources : gpu', () => {
  const gpu = { vram_utilisee: 1000 } as Gpu
  it('VRAM non attribuée', () => {
    expect(nonAttribue(gpu, [{ pid: 1, vram: 300, nom: 'a', proprietaire: 'autre' }], [])).toBe(700)
    expect(nonAttribue(gpu, [], [{ proprietaire: 'ollama', libelle: 'ollama', vram: 1200 }])).toBe(0)
    expect(nonAttribue(null, [], [])).toBe(0)
  })
})

describe('ressources : filtres mémorisés', () => {
  it('valeurs par défaut sur contenu absent ou corrompu', () => {
    for (const brut of [null, '', '{x', '[]', '"a"']) {
      expect(lireFiltres(brut)).toEqual({ plage: '24h', masquees: [], seuils: true })
    }
  })
  it('relit ce qui est valide et écarte le reste', () => {
    expect(lireFiltres(JSON.stringify({ plage: '6h', masquees: ['swap', 3], seuils: false }))).toEqual({ plage: '6h', masquees: ['swap'], seuils: false })
    expect(lireFiltres(JSON.stringify({ plage: '99h', seuils: 'oui' }))).toEqual({ plage: '24h', masquees: [], seuils: true })
  })
  it('basculer ne mute pas', () => {
    const a = ['x']
    expect(basculer(a, 'y')).toEqual(['x', 'y'])
    expect(basculer(a, 'x')).toEqual([])
    expect(a).toEqual(['x'])
  })
})
