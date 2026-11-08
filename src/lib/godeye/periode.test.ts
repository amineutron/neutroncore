import { describe, expect, it } from 'vitest'
import { ELEMENTS, ELEMENTS_CARTE, ELEMENTS_DEFAUT, lireElements } from './elements'
import { FILTRES_DEFAUT } from './filtres'
import { appliquerDepuis, depuisCourant, DEPUIS, fluxSeismes, HEURES_SEISMES, libelleHeures } from './periode'

describe('durées', () => {
  it.each([[1, '1 h'], [6, '6 h'], [24, '24 h'], [72, '3 jours'], [168, '7 jours'], [720, '30 jours']])('%i h se lit « %s »', (h, t) => expect(libelleHeures(h)).toBe(t))
  it.each([[1, 'heure'], [2, 'jour'], [24, 'jour'], [25, 'semaine'], [168, 'semaine'], [169, 'mois'], [720, 'mois']])('%i h : flux %s', (h, flux) => expect(fluxSeismes(h)).toBe(flux))
  it('les durées proposées sont croissantes et toutes lisibles', () => {
    expect([...HEURES_SEISMES]).toEqual([...HEURES_SEISMES].sort((a, b) => a - b))
    for (const h of HEURES_SEISMES) expect(libelleHeures(h)).not.toBe('')
  })
})

describe('tout depuis...', () => {
  it('applique la même durée aux actualités, séismes et événements, sans toucher au reste', () => {
    const f = appliquerDepuis({ ...FILTRES_DEFAUT, texte: 'x' }, 6)
    expect([f.infos.heures, f.seismes.heures, f.evenements.jours]).toEqual([6, 6, 1])
    expect(f.texte).toBe('x')
    expect(f.infos.themes).toEqual(FILTRES_DEFAUT.infos.themes)
    expect(FILTRES_DEFAUT.infos.heures).toBe(24)   // l'original n'est pas modifié
  })
  it('les actualités plafonnent à 3 jours, les événements arrondissent au jour supérieur', () => {
    const f = appliquerDepuis(FILTRES_DEFAUT, 168)
    expect([f.infos.heures, f.seismes.heures, f.evenements.jours]).toEqual([72, 168, 7])
    expect(appliquerDepuis(FILTRES_DEFAUT, 1).evenements.jours).toBe(1)
  })
  it('retrouve le raccourci actif, ou « personnalisé » dès qu\'une valeur diverge', () => {
    for (const d of DEPUIS) expect(depuisCourant(appliquerDepuis(FILTRES_DEFAUT, d.heures))).toBe(d.heures)
    const f = appliquerDepuis(FILTRES_DEFAUT, 24)
    expect(depuisCourant({ ...f, infos: { ...f.infos, heures: 5 } })).toBeNull()
  })
})

describe('éléments affichés', () => {
  it('tout est affiché par défaut et quand le réglage est absent ou illisible', () => {
    for (const brut of [null, '', 'pas du json', '3', '[]']) expect(lireElements(brut)).toEqual(ELEMENTS_DEFAUT)
  })
  it('seul un false explicite masque un élément ; les clés inconnues sont ignorées', () => {
    const e = lireElements(JSON.stringify({ halos: false, bandeau: 0, inconnu: false }))
    expect(e.halos).toBe(false)
    expect(e.bandeau).toBe(true)
    expect(Object.keys(e).sort()).toEqual([...ELEMENTS, ...ELEMENTS_CARTE].map((x) => x.id).sort())
  })
})
