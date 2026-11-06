import { describe, expect, it } from 'vitest'
import {
  ALT_MAX_FT, appliquer, basculerCouche, basculerDans, couchesActives, ecartStable, extrapoler, infosFiltrees, FILTRES_DEFAUT, lireFiltres, modifier,
  resumeFiltres, VUES_INTEGREES, type Contexte, type Filtres,
} from './filtres'
import { DONNEES_VIDES, type Avion, type Donnees, type Info } from './modele'

const NOW = 1_800_000_000_000
const ctx: Contexte = { maintenant: NOW, boite: null, niveauCyber: 'ok' }
const tout = (f: Partial<Filtres['couches']> = {}): Filtres => ({ ...FILTRES_DEFAUT, couches: { infos: false, seismes: true, avions: true, satellites: true, navires: true, evenements: true, cyber: true, ...f } })

const avion = (o: Partial<Avion> = {}): Avion => ({
  id: 'a1', indicatif: 'AFR123', immat: 'F-GKXA', type: 'A320', alt: 35_000, sol: false, vitesse: 450, cap: 90,
  lat: 48, lon: 2, squawk: '1000', urgence: false, militaire: false, ...o,
})
const donnees = (o: Partial<Donnees> = {}): Donnees => ({ ...DONNEES_VIDES, releveAvions: NOW, releveNavires: NOW, ...o })

describe('lireFiltres', () => {
  it.each([null, undefined, 'x', 3, [], {}])('retombe sur le défaut pour %j', (brut) => {
    expect(lireFiltres(brut)).toEqual(FILTRES_DEFAUT)
  })
  it('borne les nombres et ignore les types faux', () => {
    const f = lireFiltres({ seismes: { magMin: 99, profMax: -4, periode: 'an' }, avions: { altMin: 'haut', vitesseMin: 5000 }, evenements: { jours: 400 } })
    expect(f.seismes).toEqual({ magMin: 8, profMax: 10, periode: 'jour' })
    expect(f.avions.altMin).toBe(0)
    expect(f.avions.vitesseMin).toBe(700)
    expect(f.evenements.jours).toBe(90)
  })
  it("garde altMax >= altMin et écarte les groupes inconnus", () => {
    const f = lireFiltres({ avions: { altMin: 30_000, altMax: 10_000 }, satellites: { groupes: ['gps-ops', 'inconnu'] } })
    expect(f.avions.altMax).toBeGreaterThanOrEqual(f.avions.altMin)
    expect(f.satellites.groupes).toEqual(['gps-ops'])
  })
  it('survit à un aller-retour JSON', () => {
    const f = modifier(FILTRES_DEFAUT, 'avions', { militairesSeuls: true })
    expect(lireFiltres(JSON.parse(JSON.stringify(f)))).toEqual(f)
  })
})

describe('modifier et bascules ne modifient pas l\'original', () => {
  it('modifier', () => {
    const f = modifier(FILTRES_DEFAUT, 'seismes', { magMin: 5 })
    expect(f.seismes.magMin).toBe(5)
    expect(FILTRES_DEFAUT.seismes.magMin).toBe(2.5)
  })
  it('basculerCouche et basculerDans', () => {
    expect(basculerCouche(FILTRES_DEFAUT, 'avions').couches.avions).toBe(true)
    expect(FILTRES_DEFAUT.couches.avions).toBe(false)
    expect(basculerDans(['a'], 'b')).toEqual(['a', 'b'])
    expect(basculerDans(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('extrapoler', () => {
  it('ne bouge pas sans vitesse ni durée', () => {
    expect(extrapoler(10, 20, 0, 90, 30)).toEqual([10, 20])
    expect(extrapoler(10, 20, 400, 90, 0)).toEqual([10, 20])
  })
  it('avance vers l\'est à l\'équateur : 1 nœud pendant 1 h ~ 1 mille nautique ~ 1/60 degré', () => {
    const [lat, lon] = extrapoler(0, 0, 60, 90, 3600)
    expect(lat).toBeCloseTo(0, 3)
    expect(lon).toBeCloseTo(1, 1)
  })
  it('avance vers le nord et franchit l\'antiméridien proprement', () => {
    expect(extrapoler(0, 0, 60, 0, 3600)[0]).toBeCloseTo(1, 1)
    expect(extrapoler(0, 179.9, 600, 90, 3600)[1]).toBeLessThan(0)
  })
})

describe('appliquer', () => {
  it('une couche coupée ne produit rien', () => {
    const d = donnees({ avions: [avion()] })
    expect(appliquer(d, FILTRES_DEFAUT, ctx).filter((o) => o.couche === 'avions')).toEqual([])
  })
  it('filtre les avions par altitude, vitesse, sol, militaires et urgences', () => {
    const d = donnees({ avions: [
      avion({ id: 'haut' }), avion({ id: 'bas', alt: 3000 }), avion({ id: 'lent', vitesse: 100 }),
      avion({ id: 'sol', sol: true, alt: 0 }), avion({ id: 'mil', militaire: true }), avion({ id: 'urg', urgence: true, squawk: '7700' }),
    ] })
    const ids = (f: Filtres) => appliquer(d, f, ctx).map((o) => o.id.slice(4)).sort()
    const f = tout({ seismes: false, satellites: false, navires: false, evenements: false, cyber: false })
    expect(ids(f)).toEqual(['bas', 'haut', 'lent', 'mil', 'urg'])
    expect(ids(modifier(f, 'avions', { altMin: 20_000 }))).toEqual(['haut', 'lent', 'mil', 'urg'])
    expect(ids(modifier(f, 'avions', { vitesseMin: 300 }))).toEqual(['bas', 'haut', 'mil', 'urg'])
    expect(ids(modifier(f, 'avions', { sol: true }))).toContain('sol')
    expect(ids(modifier(f, 'avions', { militairesSeuls: true }))).toEqual(['mil'])
    expect(ids(modifier(f, 'avions', { urgencesSeules: true }))).toEqual(['urg'])
  })
  it('les avions sont extrapolés depuis leur relevé, au plus 45 s', () => {
    const d = donnees({ avions: [avion({ lat: 0, lon: 0, vitesse: 600, cap: 90 })], releveAvions: NOW - 10_000 })
    const f = tout({ seismes: false, satellites: false, navires: false, evenements: false, cyber: false })
    const proche = appliquer(d, f, ctx)[0].lon
    const loin = appliquer({ ...d, releveAvions: NOW - 600_000 }, f, ctx)[0].lon
    expect(proche).toBeGreaterThan(0.02)
    expect(loin).toBeCloseTo(appliquer({ ...d, releveAvions: NOW - 45_000 }, f, ctx)[0].lon, 6)
  })
  it('« zone visible » exclut ce qui est hors de la boîte', () => {
    const d = donnees({ avions: [avion({ id: 'in', lon: 2 }), avion({ id: 'out', lon: 100 })] })
    const f = { ...tout({ seismes: false, satellites: false, navires: false, evenements: false, cyber: false }), vueSeule: true }
    const boite = { sud: 40, ouest: -10, nord: 55, est: 20 }
    expect(appliquer(d, f, { ...ctx, boite }).map((o) => o.id)).toEqual(['avi:in'])
    expect(appliquer(d, f, ctx)).toHaveLength(2)
  })
  it('le texte cherche sans accent ni casse', () => {
    const d = donnees({ evenements: [
      { id: '1', titre: 'Incendie près d\'Évora', categorie: 'wildfires', lon: -8, lat: 38, t: NOW, lien: '' },
      { id: '2', titre: 'Volcan Etna', categorie: 'volcanoes', lon: 15, lat: 37.7, t: NOW, lien: '' },
    ] })
    const f = { ...tout({ seismes: false, avions: false, satellites: false, navires: false, cyber: false }), texte: 'evora' }
    expect(appliquer(d, f, ctx).map((o) => o.id)).toEqual(['eve:1'])
  })
  it('événements : catégories et ancienneté', () => {
    const vieux = NOW - 40 * 86_400_000
    const d = donnees({ evenements: [
      { id: 'a', titre: 'a', categorie: 'wildfires', lon: 0, lat: 0, t: NOW, lien: '' },
      { id: 'b', titre: 'b', categorie: 'floods', lon: 0, lat: 0, t: NOW, lien: '' },
      { id: 'c', titre: 'c', categorie: 'wildfires', lon: 0, lat: 0, t: vieux, lien: '' },
    ] })
    const f = modifier(tout({ seismes: false, avions: false, satellites: false, navires: false, cyber: false }), 'evenements', { categories: ['wildfires'] })
    expect(appliquer(d, f, ctx).map((o) => o.id)).toEqual(['eve:a'])
  })
  it('satellites : seuls les groupes cochés, et sous l\'altitude maximale', () => {
    const d = donnees({ satellites: [
      { id: '1', nom: 'ISS', groupe: 'stations', lon: 0, lat: 0, altKm: 420, vitesseKms: 7.7 },
      { id: '2', nom: 'GPS', groupe: 'gps-ops', lon: 0, lat: 0, altKm: 20_200, vitesseKms: 3.9 },
    ] })
    const f = tout({ seismes: false, avions: false, navires: false, evenements: false, cyber: false })
    expect(appliquer(d, f, ctx).map((o) => o.titre)).toEqual(['ISS'])
    const g = modifier(f, 'satellites', { groupes: ['stations', 'gps-ops'], altMaxKm: 1000 })
    expect(appliquer(d, g, ctx).map((o) => o.titre)).toEqual(['ISS'])
  })
  it('séismes : magnitude et profondeur', () => {
    const d = donnees({ seismes: [
      { id: 'x', mag: 6.1, lieu: 'Japon', lon: 140, lat: 36, prof: 30, t: NOW },
      { id: 'y', mag: 3, lieu: 'Chili', lon: -70, lat: -30, prof: 500, t: NOW },
    ] })
    expect(appliquer(d, FILTRES_DEFAUT, ctx)).toHaveLength(2)
    expect(appliquer(d, modifier(FILTRES_DEFAUT, 'seismes', { magMin: 5 }), ctx).map((o) => o.id)).toEqual(['sei:x'])
    expect(appliquer(d, modifier(FILTRES_DEFAUT, 'seismes', { profMax: 100 }), ctx).map((o) => o.id)).toEqual(['sei:x'])
  })
  it('cyber : le repère suit le niveau minimal', () => {
    const f = tout({ seismes: false, avions: false, satellites: false, navires: false, evenements: false })
    expect(appliquer(donnees(), f, { ...ctx, niveauCyber: 'info' })).toHaveLength(1)
    const g = modifier(f, 'cyber', { niveauMin: 'crit' })
    expect(appliquer(donnees(), g, { ...ctx, niveauCyber: 'warn' })).toHaveLength(0)
    expect(appliquer(donnees(), g, { ...ctx, niveauCyber: 'crit' })).toHaveLength(1)
  })
})

describe('résumé et vues intégrées', () => {
  it('le réglage de départ n\'a rien à résumer', () => {
    expect(resumeFiltres(FILTRES_DEFAUT)).toEqual([])
  })
  it('décrit les écarts des couches allumées seulement', () => {
    const f = modifier(modifier(FILTRES_DEFAUT, 'avions', { altMin: 30_000, militairesSeuls: true }), 'seismes', { magMin: 5 })
    expect(resumeFiltres(f)).toEqual(['séismes M5+'])
    const g = { ...f, couches: { ...f.couches, avions: true } }
    expect(resumeFiltres(g)).toEqual(expect.arrayContaining(['militaires seulement', 'altitude FL300 à FL450']))
  })
  it('les vues intégrées sont valides, nommées et ont un id unique', () => {
    expect(new Set(VUES_INTEGREES.map((v) => v.id)).size).toBe(VUES_INTEGREES.length)
    for (const v of VUES_INTEGREES) {
      expect(lireFiltres(v.filtres)).toEqual(v.filtres)
      expect(v.nom).not.toBe('')
      expect(couchesActives(v.filtres).length).toBeGreaterThan(0)
    }
    expect(ALT_MAX_FT).toBe(45_000)
  })
})

const info = (o: Partial<Info> = {}): Info => ({
  id: 'x1', titre: 'Frappes sur Kharkiv', resume: '', lien: 'https://x/1', source: 'bbc', sourceNom: 'BBC World', t: NOW - 3_600_000,
  theme: 'guerre', niveau: 'crit', pays: 'Ukraine', lat: 49, lon: 32, ...o,
})
const seulInfos = (): Filtres => tout({ seismes: false, avions: false, satellites: false, navires: false, evenements: false, cyber: false, infos: true })

describe('actualités', () => {
  it('filtre par thème, importance, fraîcheur et source', () => {
    const l = [
      info({ id: 'a' }), info({ id: 'b', theme: 'economie', niveau: 'info' }), info({ id: 'c', t: NOW - 30 * 3_600_000 }),
      info({ id: 'd', source: 'cnbc', sourceNom: 'CNBC', niveau: 'warn' }),
    ]
    const ids = (f: Filtres) => infosFiltrees(l, f, ctx).map((a) => a.id)
    expect(ids(seulInfos())).toEqual(['a', 'b', 'd'])                                               // « c » a plus de 24 h
    expect(ids(modifier(seulInfos(), 'infos', { themes: ['economie'] }))).toEqual(['b'])
    expect(ids(modifier(seulInfos(), 'infos', { niveauMin: 'crit' }))).toEqual(['a'])
    expect(ids(modifier(seulInfos(), 'infos', { niveauMin: 'warn' }))).toEqual(['a', 'd'])
    expect(ids(modifier(seulInfos(), 'infos', { heures: 72 }))).toContain('c')
    expect(ids(modifier(seulInfos(), 'infos', { sources: ['cnbc'] }))).toEqual(['d'])
  })
  it('« localisées seulement » et « zone visible » écartent les actualités sans lieu', () => {
    const l = [info({ id: 'a' }), info({ id: 'b', lat: null, lon: null, pays: null }), info({ id: 'c', lat: -30, lon: 140 })]
    expect(infosFiltrees(l, modifier(seulInfos(), 'infos', { avecLieu: true }), ctx).map((a) => a.id)).toEqual(['a', 'c'])
    const zone = { ...seulInfos(), vueSeule: true }
    expect(infosFiltrees(l, zone, { ...ctx, boite: { sud: 40, ouest: 20, nord: 60, est: 40 } }).map((a) => a.id)).toEqual(['a'])
  })
  it('la recherche porte sur le titre, le pays et la source', () => {
    const l = [info({ id: 'a' }), info({ id: 'b', titre: 'Autre', pays: 'Taiwan', sourceNom: 'DW' })]
    expect(infosFiltrees(l, { ...seulInfos(), texte: 'taiwan' }, ctx).map((a) => a.id)).toEqual(['b'])
    expect(infosFiltrees(l, { ...seulInfos(), texte: 'KHARKIV' }, ctx).map((a) => a.id)).toEqual(['a'])
  })
  it('seules les actualités localisées deviennent des points, décalés de façon stable', () => {
    const d = donnees({ infos: [info({ id: 'a' }), info({ id: 'b', lat: null, lon: null }), info({ id: 'c' })] })
    const o = appliquer(d, seulInfos(), ctx)
    expect(o.map((x) => x.id)).toEqual(['inf:a', 'inf:c'])
    expect(o[0].couche).toBe('infos')
    expect(o[0].sorte).toBe('guerre')
    expect(o[0].ton).toBe('crit')
    expect([o[0].lon, o[0].lat]).not.toEqual([o[1].lon, o[1].lat])      // même pays, pas superposées
    expect(appliquer(d, seulInfos(), ctx)).toEqual(o)                   // stable d'un appel à l'autre
  })
  it('ecartStable reste petit et déterministe', () => {
    for (const id of ['a', 'b', 'abcdef123456', '']) {
      const [x, y] = ecartStable(id)
      expect(Math.abs(x)).toBeLessThanOrEqual(1.2)
      expect(Math.abs(y)).toBeLessThanOrEqual(1.2)
      expect(ecartStable(id)).toEqual([x, y])
    }
  })
  it('relit et borne les filtres d\'actualités', () => {
    const f = lireFiltres({ infos: { themes: ['guerre', 'inconnu'], niveauMin: 'x', heures: 9999, sources: ['bbc', 'a b', 5], avecLieu: 'oui' } })
    expect(f.infos).toEqual({ themes: ['guerre'], niveauMin: 'info', heures: 72, sources: ['bbc'], avecLieu: false })
  })
  it('le résumé nomme thèmes, importance et fraîcheur', () => {
    const f = modifier(seulInfos(), 'infos', { themes: ['cyber'], niveauMin: 'warn', heures: 6 })
    expect(resumeFiltres(f)).toEqual(expect.arrayContaining(['actualités : cyber', 'actualités importantes seulement', 'actualités des 6 dernières heures']))
  })
})
