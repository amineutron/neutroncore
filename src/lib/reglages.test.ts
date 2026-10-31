import { describe, expect, it } from 'vitest'
import {
  annulerLocal, appliquerLocal, cleExportable, collecterLocal, CLE_AVANT_IMPORT, ecrireFiltres, FILTRES_DEFAUT, filtresActifs,
  filtresValides, filtresVersQuery, lireDocument, lireFiltres, motEcart, nomFichierExport, sectionsParDefaut, type Apercu,
} from './reglages'

class Faux {
  d = new Map<string, string>()
  get length() { return this.d.size }
  key(i: number) { return [...this.d.keys()][i] ?? null }
  getItem(k: string) { return this.d.get(k) ?? null }
  setItem(k: string, v: string) { this.d.set(k, v) }
  removeItem(k: string) { this.d.delete(k) }
}

describe('réglages du navigateur', () => {
  it.each([
    ['neutroncore_settings', true], ['neutroncore_palette_favs', true], ['neutroncore_audit_filtres', true],
    ['neutroncore_api_key', false], ['neutroncore_last_visit', false], ['neutroncore_tour_v1', false],
    ['neutroncore_ntfy_token', false], ['neutroncore_avant_import', false], ['autre', false], ['cs-draft:1', false],
  ])('%s exportable : %s', (cle, ok) => expect(cleExportable(cle)).toBe(ok))

  it('ne collecte jamais la clé d’API', () => {
    const m = new Faux()
    m.setItem('neutroncore_api_key', 'SECRET'); m.setItem('neutroncore_settings', '{}'); m.setItem('x', '1')
    expect(collecterLocal(m)).toEqual({ neutroncore_settings: '{}' })
  })

  it('applique, mémorise l’avant et annule', () => {
    const m = new Faux()
    m.setItem('neutroncore_settings', 'A')
    appliquerLocal(m, { neutroncore_settings: 'B', neutroncore_neuf: 'N', neutroncore_api_key: 'X', pas_prefixe: 'Y' })
    expect(m.getItem('neutroncore_settings')).toBe('B')
    expect(m.getItem('neutroncore_api_key')).toBeNull()
    expect(m.getItem('pas_prefixe')).toBeNull()
    expect(annulerLocal(m)).toBe(2)
    expect(m.getItem('neutroncore_settings')).toBe('A')
    expect(m.getItem('neutroncore_neuf')).toBeNull()
    expect(m.getItem(CLE_AVANT_IMPORT)).toBeNull()
  })

  it('annuler sans sauvegarde ou avec sauvegarde corrompue ne fait rien', () => {
    const m = new Faux()
    expect(annulerLocal(m)).toBe(0)
    m.setItem(CLE_AVANT_IMPORT, '[1,2')
    expect(annulerLocal(m)).toBe(0)
    m.setItem(CLE_AVANT_IMPORT, JSON.stringify({ neutroncore_api_key: 'x', hors: 'y' }))
    expect(annulerLocal(m)).toBe(0)
    expect(m.getItem('neutroncore_api_key')).toBeNull()
  })
})

describe('lecture d’un fichier importé', () => {
  it.each([
    ['pas json', 'pas du JSON'], ['[]', 'document inattendu'], ['{"format":"autre","version":1}', 'export de réglages'],
    ['{"format":"neutroncore-reglages"}', 'version manquante'],
  ])('refuse %s', (txt, msg) => expect(lireDocument(txt).erreur).toContain(msg))

  it('accepte un export valide', () => {
    const r = lireDocument('{"format":"neutroncore-reglages","version":1,"sections":{}}')
    expect(r.erreur).toBe('')
    expect(r.doc?.version).toBe(1)
  })

  it('refuse un fichier énorme', () => expect(lireDocument(' '.repeat(8_000_001)).doc).toBeNull())
})

describe('aperçu', () => {
  it('coche ce qui change et est valide', () => {
    const a: Apercu = {
      valide: true, erreurs: [], local: null,
      sections: [
        { id: 'a', libelle: 'a', statut: 'different', erreurs: [], diff: [] }, { id: 'b', libelle: 'b', statut: 'identique', erreurs: [], diff: [] },
        { id: 'c', libelle: 'c', statut: 'invalide', erreurs: ['x'], diff: [] }, { id: 'd', libelle: 'd', statut: 'nouveau', erreurs: [], diff: [] },
      ],
    }
    expect(sectionsParDefaut(a)).toEqual(['a', 'd'])
  })

  it('phrase les écarts', () => {
    expect(motEcart({ chemin: 'cadence', genre: 'change', avant: 60, apres: 30 })).toBe('~ cadence : 60 -> 30')
    expect(motEcart({ chemin: 'x', genre: 'ajoute', avant: null, apres: 'v' })).toBe('+ x : v')
    expect(motEcart({ chemin: 'x', genre: 'retire', avant: [1], apres: null })).toBe('- x : [1]')
  })

  it('nomme le fichier avec la date locale', () => {
    expect(nomFichierExport(new Date(2026, 9, 20, 1, 5))).toBe('neutroncore-reglages-20261020-0105.json')
  })
})

describe('filtres du journal', () => {
  it('retombent sur le défaut quand le stockage est abîmé', () => {
    expect(filtresValides(null)).toEqual(FILTRES_DEFAUT)
    expect(filtresValides({ kinds: ['x', 'auth'], resultat: 'zzz', periode: '3 ans', texte: 4, sensible: 'oui' }))
      .toEqual({ ...FILTRES_DEFAUT, kinds: ['auth'] })
    const m = new Faux(); m.setItem('neutroncore_audit_filtres', '{oups')
    expect(lireFiltres(m)).toEqual(FILTRES_DEFAUT)
  })

  it('se souviennent', () => {
    const m = new Faux()
    const f = { ...FILTRES_DEFAUT, texte: 'tv', kinds: ['action' as const], resultat: 'echec' as const, periode: '7j' as const, sensible: true }
    ecrireFiltres(m, f)
    expect(lireFiltres(m)).toEqual(f)
  })

  it('se traduisent en requête (et seulement ce qui est actif)', () => {
    const t = new Date('2026-10-20T12:00:00Z')
    expect(filtresVersQuery({ ...FILTRES_DEFAUT, periode: 'tout' }, t)).toBe('')
    const q = new URLSearchParams(filtresVersQuery({ ...FILTRES_DEFAUT, texte: ' tv ', kinds: ['action', 'auth'], resultat: 'echec', sensible: true }, t, 500))
    expect(Object.fromEntries(q)).toEqual({ texte: 'tv', kinds: 'action,auth', resultat: 'echec', depuis: '2026-10-19T12:00:00Z', sensible: '1', limite: '500' })
  })

  it('compte les filtres actifs', () => {
    expect(filtresActifs({ ...FILTRES_DEFAUT, periode: 'tout' })).toBe(0)
    expect(filtresActifs({ ...FILTRES_DEFAUT, ip: '1.2.3.4', sensible: true })).toBe(3)
  })
})
