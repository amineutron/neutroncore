import { describe, expect, it } from 'vitest'
import { bilanPalette, couleursMesurees, extraireCouleurs, hexVersRgb, MAX_COULEURS, pixelsDeCouleurs, rgbVersHex, satVal } from './spatialPalette'

type Taches = [string, number][]
/** Image fabriquée : chaque tache = [couleur, nombre de pixels]. */
function image(taches: Taches, alpha = 255): Uint8ClampedArray {
  const total = taches.reduce((t, [, n]) => t + n, 0)
  const px = new Uint8ClampedArray(total * 4)
  let i = 0
  for (const [hex, n] of taches) {
    const c = hexVersRgb(hex)!
    for (let k = 0; k < n; k++, i += 4) px.set([c[0], c[1], c[2], alpha], i)
  }
  return px
}

describe('conversions', () => {
  it('hex <-> rgb', () => {
    expect(hexVersRgb('#ff8800')).toEqual([255, 136, 0])
    expect(hexVersRgb('ff8800')).toBeNull()
    expect(hexVersRgb('#ff88')).toBeNull()
    expect(rgbVersHex([255, 136.4, -5])).toBe('#ff8800')
    expect(rgbVersHex([300, 0, 0])).toBe('#ff0000')
  })
  it('saturation et valeur', () => {
    expect(satVal([128, 128, 128]).s).toBe(0)
    expect(satVal([0, 0, 0])).toEqual({ s: 0, v: 0 })
    expect(satVal([255, 0, 0])).toEqual({ s: 1, v: 1 })
  })
})

describe('extraireCouleurs', () => {
  it('une couleur unie rend cette couleur', () => {
    expect(extraireCouleurs(image([['#e63946', 500]]), 5)).toEqual(['#e63946'])
  })
  it('ignore les gris, les blancs ternes et les noirs ternes', () => {
    const px = image([['#808080', 400], ['#101010', 300], ['#f0f0f0', 200], ['#1d4ed8', 100]])
    expect(extraireCouleurs(px, 5)).toEqual(['#1d4ed8'])
  })
  it('rend une liste vide pour une image sans couleur vive ou vide', () => {
    expect(extraireCouleurs(image([['#777777', 100], ['#050505', 100]]))).toEqual([])
    expect(extraireCouleurs(new Uint8ClampedArray(0))).toEqual([])
  })
  it('ignore les pixels transparents', () => {
    expect(extraireCouleurs(image([['#ff0000', 100]], 0))).toEqual([])
  })
  it('classe la grande tache vive avant le petit détail', () => {
    const px = image([['#2a9d8f', 800], ['#f4a261', 150], ['#e63946', 50]])
    expect(extraireCouleurs(px, 3)).toEqual(['#2a9d8f', '#f4a261', '#e63946'])
  })
  it('à poids égal, la plus saturée passe avant la plus terne', () => {
    const px = image([['#6b7fa0', 300], ['#0050ff', 300]])
    expect(extraireCouleurs(px, 2)[0]).toBe('#0050ff')
  })
  it('ne garde pas deux variantes d’une même couleur', () => {
    const px = image([['#2040ff', 300], ['#2444f8', 280], ['#ff9020', 100]])
    const res = extraireCouleurs(px, 5)
    expect(res).toHaveLength(2)
    expect(res).toContain('#ff9020')
  })
  it('respecte le nombre demandé et le plafond de l’API', () => {
    const teintes = ['#ff0000', '#ff9900', '#ffee00', '#22cc44', '#00bbff', '#3344ff', '#aa33ff', '#ff00aa']
    const px = image(teintes.map((c) => [c, 100] as [string, number]))
    expect(extraireCouleurs(px, 3)).toHaveLength(3)
    expect(extraireCouleurs(px, 99)).toHaveLength(MAX_COULEURS)
    expect(extraireCouleurs(px, 0)).toHaveLength(1)
  })
  it('est déterministe et ne rend que des #rrggbb', () => {
    const px = image([['#ff0000', 10], ['#00ff00', 10], ['#0000ff', 10]])
    const a = extraireCouleurs(px, 3), b = extraireCouleurs(px, 3)
    expect(a).toEqual(b)
    expect(a.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true)
  })
  it('écarte le bruit sous le poids minimal', () => {
    const px = image([['#2a9d8f', 10000], ['#ff0000', 5]])
    expect(extraireCouleurs(px, 5)).toEqual(['#2a9d8f'])
  })
})

describe('Ambilight', () => {
  it('met les côtés bout à bout et écarte ce qui n’est pas #rrggbb', () => {
    expect(couleursMesurees({ left: ['#111111', 'rouge'], top: ['#222222'], right: [], bottom: ['#333333'] })).toEqual(['#111111', '#222222', '#333333'])
    expect(couleursMesurees({})).toEqual([])
  })
  it('les couleurs mesurées se passent par la même extraction', () => {
    const mesures = ['#1d3a6e', '#22407a', '#162c55', '#7a3b1e', '#8a4a22', '#6e2f18', '#5a1d4e']
    const res = extraireCouleurs(pixelsDeCouleurs(mesures), 4)
    expect(res.length).toBeGreaterThanOrEqual(2)
    expect(res.length).toBeLessThanOrEqual(4)
  })
})

describe('bilanPalette', () => {
  it('dit honnêtement ce qui a été trouvé', () => {
    expect(bilanPalette([])).toContain('trop grise')
    expect(bilanPalette(['#ff0000'])).toBe('une seule couleur vive dans cette image')
    expect(bilanPalette(['#ff0000', '#00ff00'])).toBe('deux couleurs vives dans cette image')
    expect(bilanPalette(['#ff0000', '#00ff00', '#0000ff'])).toBe('3 couleurs dominantes')
  })
})
