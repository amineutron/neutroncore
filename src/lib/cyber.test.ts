import { describe, expect, it } from 'vitest'
import {
  FILTRES_DEFAUT, age, basculer, filtrer, heureValide, lireFiltres, lireVeille, nbFiltresActifs, phraseDecision, tonNiveau,
  type Avis, type Filtres,
} from './cyber'

const a = (p: Partial<Avis>): Avis => ({
  id: 'x', source: 'certfr', kind: 'avis', title: 'faille', summary: '', url: '', published: 0, level: 'info', matched: [], seen_at: 0, lu: false, ...p,
})

describe('filtres', () => {
  const items = [
    a({ id: '1', level: 'crit', matched: ['firefox'], title: 'Firefox critique' }),
    a({ id: '2', level: 'warn', source: 'shodan', lu: true }),
    a({ id: '3', level: 'info', summary: 'Noyau Linux' }),
  ]
  it('sans filtre, tout passe', () => expect(filtrer(items, FILTRES_DEFAUT)).toHaveLength(3))
  const cas: [Partial<Filtres>, string[]][] = [
    [{ niveaux: ['crit'] }, ['1']],
    [{ niveaux: ['crit', 'warn'] }, ['1', '2']],
    [{ sources: ['shodan'] }, ['2']],
    [{ nonLus: true }, ['1', '3']],
    [{ veilleSeule: true }, ['1']],
    [{ texte: ' LINUX ' }, ['3']],
    [{ niveaux: ['crit'], nonLus: true, texte: 'firefox' }, ['1']],
  ]
  it.each(cas)('%j', (f, ids) => {
    expect(filtrer(items, { ...FILTRES_DEFAUT, ...f }).map((x) => x.id)).toEqual(ids)
  })
  it('compte les filtres actifs', () => {
    expect(nbFiltresActifs(FILTRES_DEFAUT)).toBe(0)
    expect(nbFiltresActifs({ ...FILTRES_DEFAUT, niveaux: ['crit'], nonLus: true, texte: 'a' })).toBe(3)
  })
})

describe('filtres mémorisés', () => {
  it('relit un enregistrement valide', () => {
    const f = lireFiltres(JSON.stringify({ niveaux: ['crit'], sources: ['shodan'], nonLus: true, veilleSeule: false, texte: 'x' }))
    expect(f).toEqual({ niveaux: ['crit'], sources: ['shodan'], nonLus: true, veilleSeule: false, texte: 'x' })
  })
  it.each([null, '', 'pas du json', '[]', '{"niveaux":"crit"}'])('retombe sur les défauts : %s', (brut) => {
    expect(lireFiltres(brut)).toEqual(FILTRES_DEFAUT)
  })
  it('écarte les valeurs inconnues', () => {
    expect(lireFiltres('{"niveaux":["crit","zzz"],"sources":["x"],"nonLus":"oui"}')).toEqual({ ...FILTRES_DEFAUT, niveaux: ['crit'] })
  })
  it('bascule sans muter', () => {
    const l = ['a']
    expect(basculer(l, 'b')).toEqual(['a', 'b'])
    expect(basculer(l, 'a')).toEqual([])
    expect(l).toEqual(['a'])
  })
})

describe('liste de veille', () => {
  it('sépare, nettoie, dédoublonne', () => {
    expect(lireVeille(' Firefox, openssh ;NGINX\nfirefox', ['Redis'])).toEqual(['Redis', 'Firefox', 'openssh', 'NGINX'])
  })
  it('borne la longueur et ignore le vide', () => {
    expect(lireVeille(' , ;')).toEqual([])
    expect(lireVeille('x'.repeat(100))[0]).toHaveLength(60)
  })
})

describe('mise en phrases', () => {
  it.each([[30, "à l'instant"], [600, 'il y a 10 min'], [7200, 'il y a 2 h'], [3 * 86400, 'il y a 3 j'], [-5, "à l'instant"]])('age %d', (s, t) => {
    expect(age(1000 - s, 1000)).toBe(t)
  })
  it('décision connue et inconnue', () => {
    expect(phraseDecision({ action: 'rien', raison: 'silence' })).toBe('rien à faire : heures de silence')
    expect(phraseDecision({ action: 'rien', raison: 'autre' })).toBe('rien à faire : autre')
  })
  it('tons', () => {
    expect([tonNiveau('crit'), tonNiveau('warn'), tonNiveau('ok'), tonNiveau('info')]).toEqual(['crit', 'warn', 'ok', ''])
  })
  it.each([['23:00', true], ['7:00', false], ['24:00', false], ['12:60', false]])('heure %s', (h, ok) => {
    expect(heureValide(h)).toBe(ok)
  })
})
