import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ageTexte, basculer, ecrirePref, etiquetteTendance, FILTRE_DETTE_DEFAUT, filtrerDette, fmtDuree, grouperParFichier, lirePref,
  phraseBench, pointsCourbe, toneNiveau, type Comparaison, type ElementDette,
} from './qualite'

const E = (p: Partial<ElementDette>): ElementDette => ({
  id: 'a', depot: 'lyra', fichier: 'x.py', ligne: 1, marqueur: 'TODO', source: 'code', texte: 'renommer', age_jours: 5,
  score: 1, niveau: 'basse', raisons: [], ignore: false, ...p,
})

describe('mise en forme', () => {
  it.each([[0.42, '0,4 s'], [9.96, '10,0 s'], [12.4, '12 s'], [59.6, '1 min 00 s'], [185, '3 min 05 s'], [-1, '?'], [NaN, '?']])(
    'durée %s', (s, attendu) => expect(fmtDuree(s)).toBe(attendu))
  it.each([[null, 'âge inconnu'], [0, 'récent'], [13, '13 j'], [200, '7 mois'], [900, '2 ans']])('âge %s', (j, attendu) => expect(ageTexte(j)).toBe(attendu))
  it('étiquette de tendance', () => {
    const t = { mediane: 1, derniere: 1, points: [] }
    expect(etiquetteTendance({ etat: 'plus_lent', variation_pct: 34.6, ...t })).toEqual({ texte: 'plus lent +35 %', tone: 'warn' })
    expect(etiquetteTendance({ etat: 'plus_rapide', variation_pct: -20, ...t })).toEqual({ texte: 'plus rapide -20 %', tone: 'ok' })
    expect(etiquetteTendance({ etat: 'insuffisant', variation_pct: 0, ...t }).tone).toBe('')
  })
  it('courbe : bornes, valeur seule, vide', () => {
    expect(pointsCourbe([], 100, 20)).toBe('')
    expect(pointsCourbe([5], 100, 20)).toBe('2.0,10.0')
    expect(pointsCourbe([1, 3], 100, 20)).toBe('2.0,18.0 98.0,2.0')
    expect(pointsCourbe([4, 4, 4], 100, 20)).toBe('2.0,10.0 50.0,10.0 98.0,10.0')
  })
})

describe('bench', () => {
  const base = (p: Partial<Comparaison>): Comparaison => ({
    suite: 'api', resultat: 'identique',
    a: { id: 'a', started: 0, duree: 10, ok: true, commit: 'aaaaaaa', dirty: false }, b: { id: 'b', started: 1, duree: 15, ok: true, commit: 'bbbbbbb', dirty: false },
    duree: { a: 10, b: 15, ecart_s: 5, variation_pct: 50, verdict: 'plus_lent' },
    comptes: { passed: { a: 1, b: 1, ecart: 0 }, failed: { a: 0, b: 0, ecart: 0 }, errors: { a: 0, b: 0, ecart: 0 }, skipped: { a: 0, b: 0, ecart: 0 } },
    nouveaux_echecs: [], corriges: [], toujours_en_echec: [], ...p,
  })
  it('phrase', () => {
    expect(phraseBench(base({}))).toBe('même résultat global ; plus lent de 5,0 s (+50 %).')
    expect(phraseBench(base({ resultat: 'regression', nouveaux_echecs: ['t::x', 't::y'], duree: { a: 10, b: 10.2, ecart_s: 0.2, variation_pct: 2, verdict: 'equivalent' } })))
      .toBe('régression : la batterie passait, elle échoue ; durée équivalente (10 s contre 10 s) ; 2 nouveaux échecs.')
    expect(phraseBench(base({ resultat: 'corrige', duree: { a: 20, b: 10, ecart_s: -10, variation_pct: -50, verdict: 'plus_rapide' } }))).toContain('plus rapide de 10 s (-50 %)')
  })
})

describe('dette', () => {
  const liste = [
    E({ id: '1', niveau: 'haute', marqueur: 'FIXME', score: 7, texte: 'coupe la socket', fichier: 'a.py' }),
    E({ id: '2', niveau: 'basse', score: 1, depot: 'hue-mcp', fichier: 'b.py' }),
    E({ id: '3', niveau: 'moyenne', marqueur: 'DETTE', source: 'claude', score: 4, fichier: 'a.py' }),
    E({ id: '4', ignore: true }),
  ]
  it('filtre sans muter, cumule les critères', () => {
    const copie = JSON.stringify(liste)
    expect(filtrerDette(liste, FILTRE_DETTE_DEFAUT).map((e) => e.id)).toEqual(['1', '2', '3'])
    expect(filtrerDette(liste, { ...FILTRE_DETTE_DEFAUT, niveaux: ['haute', 'moyenne'] }).map((e) => e.id)).toEqual(['1', '3'])
    expect(filtrerDette(liste, { ...FILTRE_DETTE_DEFAUT, marqueurs: ['DETTE'], depot: 'lyra' }).map((e) => e.id)).toEqual(['3'])
    expect(filtrerDette(liste, { ...FILTRE_DETTE_DEFAUT, recherche: ' SOCKET ' }).map((e) => e.id)).toEqual(['1'])
    expect(filtrerDette(liste, { ...FILTRE_DETTE_DEFAUT, ignores: true }).map((e) => e.id)).toEqual(['4'])
    expect(JSON.stringify(liste)).toBe(copie)
  })
  it('groupe par fichier, le plus chargé d’abord', () => {
    const g = grouperParFichier(liste.filter((e) => !e.ignore))
    expect(g.map((x) => [x.cle, x.score, x.elements.length])).toEqual([['lyra/a.py', 11, 2], ['hue-mcp/b.py', 1, 1]])
  })
  it('bascule et ton', () => {
    expect(basculer(['a'], 'b')).toEqual(['a', 'b'])
    expect(basculer(['a', 'b'], 'a')).toEqual(['b'])
    expect([toneNiveau('haute'), toneNiveau('moyenne'), toneNiveau('basse')]).toEqual(['crit', 'warn', ''])
  })
})

describe('préférences', () => {
  beforeEach(() => {
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), clear: () => m.clear() })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('défaut si rien, fusion des clés manquantes, ignore un contenu de mauvais type', () => {
    expect(lirePref('k', { a: 1, b: [] as string[] })).toEqual({ a: 1, b: [] })
    ecrirePref('k', { a: 2 })
    expect(lirePref('k', { a: 1, b: [] as string[] })).toEqual({ a: 2, b: [] })
    ecrirePref('t', 42)
    expect(lirePref('t', 'tests')).toBe('tests')
    ecrirePref('t', 'dette')
    expect(lirePref('t', 'tests')).toBe('dette')
    localStorage.setItem('k', '{pas du json')
    expect(lirePref('k', { a: 1 })).toEqual({ a: 1 })
  })
  it('stockage qui lève : lecture au défaut, écriture muette', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqué') }, setItem: () => { throw new Error('bloqué') } })
    expect(lirePref('k', 3)).toBe(3)
    expect(() => ecrirePref('k', 3)).not.toThrow()
  })
})
