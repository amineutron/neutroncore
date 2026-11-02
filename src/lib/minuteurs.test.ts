import { describe, expect, it } from 'vitest'
import {
  aAnnoncer, choisirPrincipal, partEcoulee, compteARebours, dureeParlee, filtrer, lireDuree, lireFiltres, plusProche, restantMaintenant,
  type Evenement, type Minuteur,
} from './minuteurs'
import { lireFiltresNotes, lireSaisie, quand, requeteNotes } from './notes'

const notif = { centre: true, navigateur: true, ntfy: false, sonnerie: true }
const mk = (p: Partial<Minuteur>): Minuteur => ({
  id: 'a', nom: 'x', type: 'minuteur', etat: 'actif', duree_s: 60, fin: 0, restant_s: 60, progression: 0, cree: 0,
  notif, sonnerie: 'classique', pomodoro: null, ...p,
})

describe('compte à rebours', () => {
  it.each([[0, '00:00'], [0.2, '00:01'], [65, '01:05'], [3599, '59:59'], [3725, '1:02:05'], [-5, '00:00']])('%s -> %s', (s, txt) => {
    expect(compteARebours(s)).toBe(txt)
  })
  it.each([[45, '45 s'], [300, '5 min'], [90, '1 min 30 s'], [3600, '1 h'], [5400, '1 h 30']])('durée %s -> %s', (s, txt) => {
    expect(dureeParlee(s)).toBe(txt)
  })
})

describe('restant local', () => {
  it('décompte depuis le relevé, jamais sous zéro', () => {
    expect(restantMaintenant(mk({ restant_s: 10 }), 1000, 4000)).toBe(7)
    expect(restantMaintenant(mk({ restant_s: 2 }), 1000, 9000)).toBe(0)
  })
  it('en pause ou fini, rien ne bouge', () => {
    expect(restantMaintenant(mk({ etat: 'pause', restant_s: 10 }), 0, 99999)).toBe(10)
    expect(restantMaintenant(mk({ etat: 'fini', restant_s: 0 }), 0, 99999)).toBe(0)
  })
})

describe('saisie de durée', () => {
  it.each([['10', 600], ['10 min', 600], ['1h30', 5400], ['1 h 30', 5400], ['90s', 90], ['2 minutes 30 secondes', 150], ['1,5 h', 5400]])(
    '%s -> %s', (t, s) => expect(lireDuree(t)).toBe(s))
  it.each([[''], ['abc'], ['10 pommes'], ['0']])('%j refusé', (t) => expect(lireDuree(t)).toBeNull())
})

describe('évènements et filtres', () => {
  const ev = (n: number): Evenement => ({ n, timer: 'a', nom: 'x', kind: 'fin', message: 'm', at: 0, rattrape: false, notif })
  it('le premier relevé n’annonce rien, les suivants seulement le neuf', () => {
    expect(aAnnoncer([ev(1), ev(2)], null)).toEqual([])
    expect(aAnnoncer([ev(1), ev(2), ev(3)], 1).map((e) => e.n)).toEqual([2, 3])
  })
  it('le plus proche est un minuteur actif', () => {
    expect(plusProche([mk({ id: 'p', etat: 'pause', restant_s: 1 }), mk({ id: 'b', restant_s: 50 }), mk({ id: 'c', restant_s: 20 })])?.id).toBe('c')
    expect(plusProche([mk({ etat: 'fini' })])).toBeNull()
  })
  it('filtrer', () => {
    const l = [mk({ id: '1' }), mk({ id: '2', etat: 'fini' }), mk({ id: '3', type: 'pomodoro' })]
    expect(filtrer(l, { onglet: 'minuteurs', finis: false, type: 'tous' }).map((t) => t.id)).toEqual(['1', '3'])
    expect(filtrer(l, { onglet: 'minuteurs', finis: true, type: 'pomodoro' }).map((t) => t.id)).toEqual(['3'])
  })
  it('filtres retenus : valeur abîmée = défaut', () => {
    expect(lireFiltres('pas du json')).toEqual({ onglet: 'minuteurs', finis: true, type: 'tous' })
    expect(lireFiltres('{"onglet":"notes","finis":false,"type":"pomodoro"}')).toEqual({ onglet: 'notes', finis: false, type: 'pomodoro' })
    expect(lireFiltres('{"onglet":"x","type":3}').type).toBe('tous')
  })
})

describe('notes', () => {
  it('saisie en une ligne', () => {
    expect(lireSaisie('acheter du thé', '')).toEqual({ texte: 'acheter du thé', projet: '' })
    expect(lireSaisie('#lyra revoir le plan', 'hue')).toEqual({ texte: 'revoir le plan', projet: 'lyra' })
    expect(lireSaisie('acheter', 'hue')).toEqual({ texte: 'acheter', projet: 'hue' })
    expect(lireSaisie('#lyra', '')).toEqual({ texte: '#lyra', projet: '' })
    expect(lireSaisie('   ', '')).toBeNull()
  })
  it('requête', () => {
    expect(requeteNotes('', { projet: null, epinglees: false })).toBe('')
    expect(requeteNotes(' thé ', { projet: '', epinglees: true })).toBe('?q=th%C3%A9&projet=&epingle=true')
  })
  it('filtres retenus', () => {
    expect(lireFiltresNotes('{"projet":"lyra","epinglees":true}')).toEqual({ projet: 'lyra', epinglees: true })
    expect(lireFiltresNotes(null)).toEqual({ projet: null, epinglees: false })
  })
  it('quand', () => {
    const now = 1_000_000_000_000
    expect(quand(now / 1000 - 10, now)).toBe('à l’instant')
    expect(quand(now / 1000 - 600, now)).toBe('il y a 10 min')
    expect(quand(now / 1000 - 7200, now)).toBe('il y a 2 h')
    expect(quand(now / 1000 - 100000, now)).toBe('hier')
  })
})

describe('principal et part écoulée', () => {
  it('prend le choix s\'il existe, sinon le plus proche', () => {
    const l = [mk({ id: 'a', restant_s: 50 }), mk({ id: 'b', restant_s: 10 }), mk({ id: 'c', etat: 'fini', restant_s: 0 })]
    expect(choisirPrincipal(l, 'a')?.id).toBe('a')
    expect(choisirPrincipal(l, 'zz')?.id).toBe('b')
    expect(choisirPrincipal([mk({ id: 'p', etat: 'pause' }), mk({ id: 'f', etat: 'fini' })], null)?.id).toBe('p')
    expect(choisirPrincipal([mk({ id: 'f', etat: 'fini' })], null)?.id).toBe('f')
    expect(choisirPrincipal([], null)).toBeNull()
  })
  it('borne la part écoulée', () => {
    expect(partEcoulee({ etat: 'actif', duree_s: 100 }, 25)).toBe(0.75)
    expect(partEcoulee({ etat: 'actif', duree_s: 100 }, 500)).toBe(0)
    expect(partEcoulee({ etat: 'fini', duree_s: 100 }, 0)).toBe(1)
    expect(partEcoulee({ etat: 'actif', duree_s: 0 }, 0)).toBe(0)
  })
})
