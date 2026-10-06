import { describe, expect, it } from 'vitest'
import {
  EMPTY_DRAFT, daysLabel, defaultBlock, describeAction, describeCondition, describeTrigger, draftError, isRoutine, runLabel,
  choiceLabel, completeBlock, normalize, sameDraft, sentence, type AutomationDraft, type Block, type BlockSpec,
} from './automations'
import type { ActionSpec } from './routines'

const b = (type: string, params: Block['params'] = {}): Block => ({ type, params })
const CAT: ActionSpec[] = [
  { action: 'hue.off', label: 'lumières : tout éteindre', params: [] },
  { action: 'tv.power', label: 'tv', params: [{ name: 'on', type: 'bool' }] },
]

describe('describeTrigger', () => {
  it.each([
    [b('manual'), 'à la main'],
    [b('time', { time: '07:30', days: [0, 1, 2, 3, 4] }), 'à 07:30 en semaine'],
    [b('alert', { kind: 'disk', when: 'raised' }), 'quand une alerte « disque » apparaît'],
    [b('alert', { kind: 'any', when: 'resolved' }), 'quand une alerte est résolue'],
    [b('download_done'), 'quand un téléchargement se termine'],
    [b('session', { when: 'waiting' }), 'quand une session claude attend une réponse'],
    [b('service', { name: 'plex', state: 'down' }), 'quand plex tombe'],
    [b('service', { name: 'any', state: 'up' }), 'quand un service revient'],
    [b('tv', { state: 'off' }), 'quand la tv s’éteint'],
    [b('futur_inconnu'), 'futur_inconnu'],
  ])('%j', (t, out) => expect(describeTrigger(t)).toBe(out))
})

describe('describeCondition', () => {
  it.each([
    [b('time_between', { start: '22:00', end: '06:00' }), 'entre 22:00 et 06:00'],
    [b('days', { days: [5, 6] }), 'le week-end'],
    [b('tv_is', { state: 'on' }), 'la tv est allumée'],
    [b('lights_are', { state: 'off' }), 'les lumières sont éteintes'],
  ])('%j', (c, out) => expect(describeCondition(c)).toBe(out))
})

describe('describeAction', () => {
  it('actions propres aux automatisations', () => {
    expect(describeAction({ action: 'notify.phone', params: { message: 'disque plein' } }, CAT)).toBe('notification sur le téléphone : « disque plein »')
    expect(describeAction({ action: 'service.start', params: { name: 'plex' } }, CAT)).toBe('démarrer plex')
  })
  it('les actions de routine gardent leur phrase', () => {
    expect(describeAction({ action: 'tv.power', params: { on: false } }, CAT)).toBe('tv : éteindre')
  })
})

describe('sentence', () => {
  const draft: AutomationDraft = {
    ...EMPTY_DRAFT, name: 'coucher',
    trigger: b('tv', { state: 'off' }), conditions: [b('time_between', { start: '22:00', end: '06:00' }), b('days', { days: [0, 1, 2, 3, 6] })],
    actions: [{ action: 'hue.off', params: {} }, { action: 'notify.app', params: { message: 'bonne nuit' } }],
  }
  it('phrase complète relue avant d’enregistrer', () => {
    expect(sentence(draft, CAT)).toBe('Quand la tv s’éteint, si entre 22:00 et 06:00 et lun mar mer jeu dim : lumières : tout éteindre, puis notification dans l’app : « bonne nuit ».')
  })
  it('sans condition ni action', () => {
    expect(sentence({ ...EMPTY_DRAFT, trigger: b('download_done') }, CAT)).toBe('Quand un téléchargement se termine : ….')
  })
})

describe('daysLabel / isRoutine', () => {
  it.each([[[0, 1, 2, 3, 4, 5, 6], 'tous les jours'], [[6, 5], 'le week-end'], [[2, 0], 'lun mer']])('%j', (d, out) => expect(daysLabel(d)).toBe(out))
  it('une automatisation à déclencheur manuel est une routine', () => {
    expect(isRoutine({ trigger: b('manual') })).toBe(true)
    expect(isRoutine({ trigger: b('time', { time: '07:30', days: [0] }) })).toBe(false)
  })
})

describe('defaultBlock', () => {
  it('valeurs de départ selon le type de paramètre', () => {
    const spec: BlockSpec = { type: 'time_between', label: 'entre deux heures', params: [{ name: 'start', type: 'time' }, { name: 'end', type: 'time' }] }
    expect(defaultBlock(spec)).toEqual({ type: 'time_between', params: { start: '22:00', end: '06:00' } })
    const alert: BlockSpec = { type: 'alert', label: 'alerte', params: [{ name: 'kind', type: 'choice', choices: ['any', 'disk'] }, { name: 'when', type: 'choice', choices: ['raised', 'resolved'] }] }
    expect(defaultBlock(alert).params).toEqual({ kind: 'any', when: 'raised' })
    expect(defaultBlock({ type: 'time', label: 'heure', params: [{ name: 'time', type: 'time' }, { name: 'days', type: 'days' }] }).params).toEqual({ time: '07:30', days: [0, 1, 2, 3, 4] })
  })
})

describe('draftError', () => {
  const ok: AutomationDraft = { ...EMPTY_DRAFT, name: 'x', actions: [{ action: 'hue.off', params: {} }] }
  it.each([
    [ok, ''], [{ ...ok, name: ' ' }, 'nom'], [{ ...ok, actions: [] }, 'action'],
    [{ ...ok, actions: [{ action: 'notify.app', params: { message: '  ' } }] }, 'message'],
    [{ ...ok, actions: [{ action: 'hue.scene', params: { scene_id: '' } }] }, 'scène'],
    [{ ...ok, trigger: b('time', { time: '07:30', days: [] }) }, 'jour'],
    [{ ...ok, trigger: b('tv', { state: 'on' }), conditions: [b('days', { days: [] })] }, 'jour'],
  ])('%#', (d, fragment) => {
    const e = draftError(d)
    if (fragment === '') expect(e).toBe('')
    else expect(e).toContain(fragment)
  })
})

describe('runLabel', () => {
  const base = { at: 1, trigger: 'alert', why: '', success: true, failed: 0, detail: '' }
  it.each([
    [base, 'réussie'], [{ ...base, success: false, failed: 2 }, '2 action(s) en échec'],
    [{ ...base, skipped: true, why: 'condition non remplie : hors de la plage' }, 'non lancée — condition non remplie : hors de la plage'],
  ])('%#', (r, out) => expect(runLabel(r)).toBe(out))
})

describe('sameDraft', () => {
  it('même contenu malgré un ordre de champs différent (régression : l’éditeur se croyait toujours modifié)', () => {
    const reordered = { cooldown_min: 5, actions: [], conditions: [], trigger: { params: {}, type: 'manual' }, enabled: true, name: '' } as AutomationDraft
    expect(sameDraft(EMPTY_DRAFT, reordered)).toBe(true)
  })
  it('détecte un vrai changement', () => {
    expect(sameDraft(EMPTY_DRAFT, { ...EMPTY_DRAFT, name: 'x' })).toBe(false)
    expect(sameDraft(EMPTY_DRAFT, { ...EMPTY_DRAFT, actions: [{ action: 'hue.off', params: {} }] })).toBe(false)
    expect(sameDraft(EMPTY_DRAFT, { ...EMPTY_DRAFT, trigger: b('tv', { state: 'on' }) })).toBe(false)
  })
})

describe('normalize (routine)', () => {
  const messy: AutomationDraft = { ...EMPTY_DRAFT, name: 'r', enabled: false, cooldown_min: 60, conditions: [b('days', { days: [] })], actions: [{ action: 'hue.off', params: {} }] }
  it('une routine n’emporte ni condition masquée, ni pause, ni cadence', () => {
    expect(normalize(messy)).toMatchObject({ conditions: [], enabled: true, cooldown_min: 5 })
  })
  it('une condition invisible ne bloque pas l’enregistrement d’une routine', () => expect(draftError(messy)).toBe(''))
  it('une automatisation déclenchée garde tout', () => {
    const auto = { ...messy, trigger: b('tv', { state: 'on' }) }
    expect(normalize(auto)).toBe(auto)
    expect(draftError(auto)).toContain('jour')
  })
})

describe('completeBlock / choiceLabel / sameDraft', () => {
  const spec: BlockSpec = { type: 'alert', label: 'alerte', params: [{ name: 'kind', type: 'choice', choices: ['any', 'disk'] }, { name: 'when', type: 'choice', choices: ['raised', 'resolved'] }] }
  it('complète un paramètre absent sans toucher aux présents', () => {
    expect(completeBlock(b('alert', { kind: 'disk' }), spec).params).toEqual({ kind: 'disk', when: 'raised' })
    expect(completeBlock(b('alert', { kind: 'disk' }), undefined).params).toEqual({ kind: 'disk' })
  })
  it('les libellés dépendent du paramètre, pas seulement de la valeur', () => {
    expect(choiceLabel('kind', 'backup')).toBe('sauvegarde')
    expect(choiceLabel('name', 'backup')).toBe('backup')          // un service de ce nom garde son nom
    expect(choiceLabel('name', 'any')).toBe('n’importe lequel')
    expect(choiceLabel('kind', 'any')).toBe('n’importe laquelle')
    expect(choiceLabel('mode', 'LOUNGE_LIGHT')).toBe('lounge')
    expect(choiceLabel('source', 'SAT/CBL')).toBe('sat/cbl')
  })
  it('sameDraft ignore l’ordre des paramètres d’un bloc', () => {
    const a = { ...EMPTY_DRAFT, trigger: b('alert', { kind: 'disk', when: 'raised' }) }
    const c = { ...EMPTY_DRAFT, trigger: b('alert', { when: 'raised', kind: 'disk' }) }
    expect(sameDraft(a, c)).toBe(true)
  })
})
