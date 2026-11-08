// God Eye : invariants des dessins canvas (zones, traces, carte) avec un faux contexte 2D qui enregistre les appels.
// Pas de pixels : on vérifie ce qui est émis (nombre de traits, arcs) et qu'aucun argument n'est NaN ou infini.
import { describe, expect, it } from 'vitest'
import type { Amas } from '../../lib/godeye/amas'
import { REGLAGES_CARTE_DEFAUT } from '../../lib/godeye/apparence'
import type { Objet } from '../../lib/godeye/modele'
import type { Polyligne } from '../../lib/godeye/trace'
import { zoneVide, type ZoneBrouillon } from '../../lib/godeye/zones'
import { projeter, type Vue } from '../../lib/vueMonde'
import { dessinerAmas, dessinerNuitPlat, dessinerQuadrillagePlat } from './dessinCarte'
import { dessinerPolylignes } from './dessinTraces'
import { dessinerZonesGlobe, dessinerZonesPlat } from './dessinZones'

type Appel = { nom: string; args: unknown[] }
type Faux = { ctx: CanvasRenderingContext2D; appels: Appel[]; proprietes: Appel[] }

/** Contexte 2D factice : chaque méthode est enregistrée, chaque affectation de propriété aussi. */
function fauxContexte(): Faux {
  const appels: Appel[] = []
  const proprietes: Appel[] = []
  const ctx = new Proxy({}, {
    get: (_, nom: string) => (...args: unknown[]) => { appels.push({ nom, args }); return undefined },
    set: (_, nom: string, v) => { proprietes.push({ nom, args: [v] }); return true },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, appels, proprietes }
}
const nb = (f: Faux, nom: string): number => f.appels.filter((a) => a.nom === nom).length
const nombresInvalides = (f: Faux): Appel[] =>
  [...f.appels, ...f.proprietes].filter((a) => a.args.flat(2).some((v) => typeof v === 'number' && !Number.isFinite(v)))

const W = 800, H = 400
const vue: Vue = { cx: 10, cy: 20, zoom: 1 }
const plat = (lon: number, lat: number): [number, number] => projeter(lon, lat, vue, W, H)
const globe = (lon: number, lat: number) => ({ x: (lon + 180) / 360 * W, y: (90 - lat) / 180 * H })

const cercle: ZoneBrouillon = { ...zoneVide(48, 2), id: 'c1', nom: 'cercle', rayon_km: 200 }
const rect: ZoneBrouillon = { id: 'r1', nom: 'rect', forme: 'rect', centre: { lat: 40, lon: 10 }, bbox: { s: 35, w: 5, n: 45, e: 15 }, objets: ['avion'], actif: true, notifier: false }

describe('dessinZones', () => {
  it('liste vide : rien n\'est dessiné', () => {
    const f = fauxContexte()
    dessinerZonesPlat(f.ctx, [], plat, W, H)
    dessinerZonesGlobe(f.ctx, [], globe)
    expect(f.appels).toEqual([])
    expect(f.proprietes).toEqual([])
  })
  it('carte à plat : un cercle et un rectangle émettent des contours fermés, sans valeur invalide', () => {
    const f = fauxContexte()
    dessinerZonesPlat(f.ctx, [cercle, rect], (lon, lat) => [(lon + 180) / 360 * W, (90 - lat) / 180 * H], W, H)
    expect(nb(f, 'beginPath')).toBeGreaterThanOrEqual(2)
    expect(nb(f, 'stroke')).toBe(nb(f, 'beginPath'))
    expect(nb(f, 'fill')).toBe(nb(f, 'beginPath'))
    expect(nb(f, 'closePath')).toBe(nb(f, 'beginPath'))
    expect(nb(f, 'moveTo')).toBe(nb(f, 'beginPath'))
    expect(nb(f, 'lineTo')).toBeGreaterThan(nb(f, 'moveTo') * 3)
    expect(nb(f, 'save')).toBe(nb(f, 'restore'))
    expect(nombresInvalides(f)).toEqual([])
  })
  it('carte à plat : une zone entièrement hors de la toile ne dessine rien', () => {
    const f = fauxContexte()
    dessinerZonesPlat(f.ctx, [cercle], () => [-5000, -5000], W, H)
    expect(nb(f, 'beginPath')).toBe(0)
  })
  it('le brouillon est tracé en tirets, une zone normale en trait plein', () => {
    const f = fauxContexte()
    dessinerZonesPlat(f.ctx, [{ ...cercle, id: 'brouillon' }], (lon, lat) => [(lon + 180) / 360 * W, (90 - lat) / 180 * H], W, H)
    expect(f.appels.find((a) => a.nom === 'setLineDash')?.args[0]).toEqual([6, 4])
    const g = fauxContexte()
    dessinerZonesPlat(g.ctx, [cercle], (lon, lat) => [(lon + 180) / 360 * W, (90 - lat) / 180 * H], W, H)
    expect(g.appels.find((a) => a.nom === 'setLineDash')?.args[0]).toEqual([])
  })
  it('globe : zone visible = contour rempli et fermé ; derrière l\'horizon = rien', () => {
    const f = fauxContexte()
    dessinerZonesGlobe(f.ctx, [cercle, rect], globe)
    expect(nb(f, 'closePath')).toBe(2)
    expect(nb(f, 'fill')).toBe(2)
    expect(nb(f, 'stroke')).toBe(2)
    expect(nombresInvalides(f)).toEqual([])
    const g = fauxContexte()
    dessinerZonesGlobe(g.ctx, [cercle], () => null)
    expect(nb(g, 'beginPath')).toBe(0)
  })
  it('globe : zone à moitié cachée = trait interrompu, pas de remplissage', () => {
    const f = fauxContexte()
    dessinerZonesGlobe(f.ctx, [rect], (lon, lat) => (lon > 10 ? null : globe(lon, lat)))
    expect(nb(f, 'stroke')).toBe(1)
    expect(nb(f, 'fill')).toBe(0)
    expect(nb(f, 'closePath')).toBe(0)
  })
})

describe('dessinTraces', () => {
  const ligne = (morceaux: [number, number][][], genre: Polyligne['genre'] = 'suivi'): Polyligne => ({ id: 'l', genre, couleur: '#ffd43b', morceaux })
  const proj = (lon: number, lat: number) => globe(lon, lat)
  it('liste vide : rien', () => {
    const f = fauxContexte()
    dessinerPolylignes(f.ctx, [], proj)
    expect(f.appels).toEqual([])
  })
  it('3 points : un moveTo et un lineTo par segment, soit 2 segments', () => {
    const f = fauxContexte()
    dessinerPolylignes(f.ctx, [ligne([[[0, 0], [5, 5], [10, 8]]])], proj)
    expect(nb(f, 'moveTo')).toBe(2)
    expect(nb(f, 'lineTo')).toBe(2)
    expect(nb(f, 'stroke')).toBe(2)
    expect(nombresInvalides(f)).toEqual([])
    const alphas = f.proprietes.filter((p) => p.nom === 'globalAlpha').map((p) => p.args[0] as number)
    expect(alphas).toHaveLength(2)
    expect(alphas[1]).toBeGreaterThan(alphas[0])
    // l'opacité reste dans ]0, 1] : un globalAlpha > 1 serait ignoré par le canvas (régression corrigée)
    expect(alphas.every((a) => Number.isFinite(a) && a > 0 && a <= 1)).toBe(true)
  })
  it('un point caché coupe la ligne ; la sélection est en tirets', () => {
    const f = fauxContexte()
    dessinerPolylignes(f.ctx, [ligne([[[0, 0], [5, 5], [50, 5], [10, 8]]], 'selection')], (lon, lat) => (lon === 50 ? null : proj(lon, lat)))
    expect(nb(f, 'lineTo')).toBe(1)
    expect(f.appels.find((a) => a.nom === 'setLineDash')?.args[0]).toEqual([4, 3])
  })
  it('un morceau d\'un seul point ne trace rien', () => {
    const f = fauxContexte()
    dessinerPolylignes(f.ctx, [ligne([[[0, 0]]])], proj)
    expect(nb(f, 'lineTo')).toBe(0)
  })
})

describe('dessinCarte', () => {
  const obj = (id: string): Objet => ({ id, couche: 'avions', lon: 0, lat: 0, ton: 'info', rayon: 3, titre: id, detail: '' })
  const amasDe = (n: number): Amas<{ x: number; y: number; o: Objet }>[] => Array.from({ length: n }, (_, i) => ({
    x: 50 + i * 60, y: 80, n: 10 + i * 100, cle: `a${i}`, membres: [{ x: 50, y: 80, o: obj(`avi:${i}`) }],
  }))
  it('amas : deux arcs (halo et pastille) et un texte par amas', () => {
    const f = fauxContexte()
    dessinerAmas(f.ctx, amasDe(5))
    expect(nb(f, 'arc')).toBe(10)
    expect(nb(f, 'fillText')).toBe(5)
    expect(nombresInvalides(f)).toEqual([])
  })
  it('aucun amas : aucun dessin', () => {
    const f = fauxContexte()
    dessinerAmas(f.ctx, [])
    expect(nb(f, 'arc')).toBe(0)
    expect(nb(f, 'fillText')).toBe(0)
  })
  it('voile de nuit : un polygone rempli, puis le terminateur tracé trois fois', () => {
    const f = fauxContexte()
    dessinerNuitPlat(f.ctx, vue, W, H, { lat: 12, lon: -30 })
    expect(nb(f, 'fill')).toBe(1)
    expect(nb(f, 'stroke')).toBe(3)
    expect(nb(f, 'closePath')).toBe(1)
    expect(nb(f, 'lineTo')).toBeGreaterThan(100)
    expect(nombresInvalides(f)).toEqual([])
  })
  it('voile de nuit : soleil aux pôles et zoom élevé restent finis', () => {
    for (const s of [{ lat: 23.4, lon: 0 }, { lat: -23.4, lon: 180 }, { lat: 0, lon: -180 }]) {
      const f = fauxContexte()
      dessinerNuitPlat(f.ctx, { cx: 0, cy: 0, zoom: 8 }, W, H, s)
      expect(nombresInvalides(f)).toEqual([])
    }
  })
  it('quadrillage : une ligne par méridien et parallèle ; spéciaux en tirets seulement si demandés', () => {
    const f = fauxContexte()
    dessinerQuadrillagePlat(f.ctx, vue, W, H, REGLAGES_CARTE_DEFAUT)
    expect(nb(f, 'moveTo')).toBeGreaterThan(10)
    expect(nb(f, 'moveTo')).toBe(nb(f, 'lineTo'))
    expect(nb(f, 'stroke')).toBe(1)
    expect(nombresInvalides(f)).toEqual([])
    const g = fauxContexte()
    dessinerQuadrillagePlat(g.ctx, vue, W, H, { ...REGLAGES_CARTE_DEFAUT, equateur: true, tropiques: true })
    expect(nb(g, 'stroke')).toBe(2)
    // l'équateur remplace le parallèle 0 de la grille : trois lignes à part, une de moins dans la grille
    expect(nb(g, 'moveTo')).toBe(nb(f, 'moveTo') + 2)
    expect(g.appels.filter((a) => a.nom === 'setLineDash')).toHaveLength(2)
    expect(nombresInvalides(g)).toEqual([])
  })
})
