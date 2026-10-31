import { describe, expect, it } from 'vitest'
import { courbeGamma, courbeLineaire } from './rampes'
import type { Reveil } from './reveil'
import type { Automation } from './automations'
import {
  automationDuReveil, debutAube, dansLisible, echeanceLisible, heureLisible, horaireDepuis, nomJours, phraseReveil,
  problemeReveil, prochainReveil, trouverAutomation, type Horaire,
} from './reveilAssistant'

const reveil = (over: Partial<Reveil> = {}): Reveil => ({
  id: 'matin', nom: 'matin', enabled: true, duree_min: 20, lampes: ['1'], plafond_bri: 254,
  courbe: { bri: courbeGamma(1200, 1, 254), kelvin: courbeLineaire(1200, 2200, 5000) },
  tele: { actif: false, ecran: 'tele', source: 'hdmi1', moment: 'fin', avant_fin_min: 0 }, ...over,
})

describe('heures et jours en mots', () => {
  it.each([['07:30', '7h30'], ['07:00', '7h'], ['00:05', '0h05'], ['x', 'x']])('%s -> %s', (a, b) => expect(heureLisible(a)).toBe(b))
  it.each([
    [[0, 1, 2, 3, 4], 'en semaine'], [[6, 5, 4, 3, 2, 1, 0], 'tous les jours'], [[5, 6], 'le week-end'],
    [[0], 'le lundi'], [[0, 2, 4], 'lundi, mercredi et vendredi'], [[], 'jamais'],
  ])('%j -> %s', (j, s) => expect(nomJours(j)).toBe(s))
})

describe('début de l’aube', () => {
  it('finit à l’heure choisie', () => expect(debutAube('07:30', 20)).toEqual({ heure: '07:10', veille: false }))
  it('passe minuit : c’est la veille', () => expect(debutAube('00:10', 30)).toEqual({ heure: '23:40', veille: true }))
})

describe('phrase d’aperçu', () => {
  const noms = { '1': 'salon' }
  it('dit quand et comment', () => {
    expect(phraseReveil(reveil({ tele: { actif: true, ecran: 'worldmonitor', source: 'hdmi1', moment: 'fin', avant_fin_min: 0 } }), { heure: '07:30', jours: [0, 1, 2, 3, 4] }, noms))
      .toBe('en semaine à 7h30 : la lumière monte de 7h10 à 7h30 sur salon, puis worldmonitor sur la télé.')
  })
  it('sans télé ni heure fixe', () => {
    expect(phraseReveil(reveil(), null, noms)).toBe('à lancer à la main : la lumière monte pendant 20 min sur salon, rien d’autre.')
  })
  it('lampe inconnue : un nom de secours, pas un trou', () => expect(phraseReveil(reveil({ lampes: ['9', '1'] }), null, noms)).toContain('sur lampe 9 et salon'))
  it('aube qui passe minuit', () => expect(phraseReveil(reveil({ duree_min: 30 }), { heure: '00:10', jours: [1] }, noms)).toContain('de 23h40 (la veille au soir) à 0h10'))
})

describe('automatisation du réveil', () => {
  const h: Horaire = { heure: '07:30', jours: [0, 1, 2, 3, 4] }
  it('part à l’heure de DÉPART, relit l’heure de réveil', () => {
    const a = automationDuReveil(reveil(), h)
    expect(a.trigger).toEqual({ type: 'time', params: { time: '07:10', days: [0, 1, 2, 3, 4] } })
    expect(a.actions).toEqual([{ action: 'reveil.run', params: { id: 'matin' }, on_error: 'stop', retry: 0 }])
    expect(horaireDepuis(a, 20)).toEqual(h)
  })
  it('aller-retour même quand l’aube commence la veille', () => {
    const r = reveil({ duree_min: 30 }), hh: Horaire = { heure: '00:10', jours: [0, 6] }
    const a = automationDuReveil(r, hh)
    expect(a.trigger.params.days).toEqual([5, 6])        // samedi et dimanche soir
    expect(horaireDepuis(a, 30)).toEqual(hh)
  })
  it('un réveil en pause met l’automatisation en pause', () => expect(automationDuReveil(reveil({ enabled: false }), h).enabled).toBe(false))
  it('la retrouve par son action, pas par son nom', () => {
    const a = { ...automationDuReveil(reveil(), h), id: 'x', last_run: null, history: [] } as Automation
    expect(trouverAutomation([a], 'matin')?.id).toBe('x')
    expect(trouverAutomation([a], 'autre')).toBeNull()
  })
  it('horaire illisible : null', () => expect(horaireDepuis(null, 20)).toBeNull())
})

describe('prochaine échéance', () => {
  const lundi9h = new Date(2026, 9, 19, 9, 0)           // lundi 19 octobre 2026
  it('passé aujourd’hui : demain', () => expect(prochainReveil({ heure: '07:30', jours: [0, 1, 2, 3, 4] }, lundi9h)?.getDate()).toBe(20))
  it('encore à venir aujourd’hui', () => expect(prochainReveil({ heure: '10:00', jours: [0] }, lundi9h)?.getDate()).toBe(19))
  it('saute les jours exclus (week-end)', () => expect(prochainReveil({ heure: '07:30', jours: [5, 6] }, lundi9h)?.getDate()).toBe(24))
  it('aucun jour ou heure fausse : null', () => {
    expect(prochainReveil({ heure: '07:30', jours: [] }, lundi9h)).toBeNull()
    expect(prochainReveil({ heure: '7h', jours: [0] }, lundi9h)).toBeNull()
  })
  it('durées lisibles', () => {
    expect(dansLisible(25 * 60000)).toBe('dans 25 min')
    expect(dansLisible((9 * 60 + 12) * 60000)).toBe('dans 9 h 12')
    expect(dansLisible(3 * 3600000)).toBe('dans 3 h')
    expect(dansLisible(72 * 3600000)).toBe('dans 3 jours')
  })
  it('échéance : demain à 7h30', () => {
    const d = prochainReveil({ heure: '07:30', jours: [0, 1, 2, 3, 4] }, lundi9h)!
    expect(echeanceLisible(d, lundi9h)).toBe('demain à 7h30 · dans 22 h 30')
  })
})

describe('ce qui empêche d’enregistrer', () => {
  const h: Horaire = { heure: '07:30', jours: [0] }
  it('dit quoi faire', () => {
    expect(problemeReveil(reveil({ lampes: [] }), h)).toBe('choisis au moins une lampe')
    expect(problemeReveil(reveil({ nom: ' ' }), h)).toBe('donne un nom à ce réveil')
    expect(problemeReveil(reveil(), { heure: '7:30', jours: [0] })).toContain('07:30')
    expect(problemeReveil(reveil(), { heure: '07:30', jours: [] })).toContain('au moins un jour')
    expect(problemeReveil(reveil(), h)).toBe('')
    expect(problemeReveil(reveil(), null)).toBe('')
  })
})
