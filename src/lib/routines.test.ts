import { describe, expect, it } from 'vitest'
import { defaultParams, describeStep, moveStep, type ActionSpec, type Step } from './routines'

const CAT: ActionSpec[] = [
  { action: 'hue.scene', label: 'scène hue', params: [{ name: 'scene_id', type: 'id' }] },
  { action: 'hue.off', label: 'lumières : tout éteindre', params: [] },
  { action: 'hue.brightness', label: 'lumières : intensité', params: [{ name: 'brightness', type: 'int', min: 1, max: 254 }] },
  { action: 'tv.power', label: 'tv', params: [{ name: 'on', type: 'bool' }] },
  { action: 'tv.ambilight', label: 'ambilight', params: [{ name: 'mode', type: 'choice', choices: ['FOLLOW_VIDEO', 'LOUNGE_LIGHT', 'OFF'] }] },
  { action: 'denon.volume', label: 'volume', params: [{ name: 'level', type: 'int', min: 0, max: 60 }] },
  { action: 'wait', label: 'attendre', params: [{ name: 'seconds', type: 'int', min: 1, max: 60 }] },
]
const step = (action: string, params: Step['params'] = {}): Step => ({ action, params })

describe('describeStep', () => {
  it.each([
    [step('hue.scene', { scene_id: 's1' }), 'scène hue : soirée'],
    [step('hue.scene', { scene_id: 'gone' }), 'scène hue : scène supprimée'],
    [step('hue.off'), 'lumières : tout éteindre'],
    [step('hue.brightness', { brightness: 127 }), 'lumières à 50 %'],
    [step('tv.power', { on: false }), 'tv : éteindre'],
    [step('tv.ambilight', { mode: 'FOLLOW_VIDEO' }), 'ambilight : video'],
    [step('tv.ambilight', { mode: 'LOUNGE_LIGHT' }), 'ambilight : lounge'],
    [step('denon.volume', { level: 35 }), 'ampli : volume 35'],
    [step('wait', { seconds: 5 }), 'attendre 5 s'],
    [step('inconnue.du.catalogue'), 'inconnue.du.catalogue'],
  ])('%j', (s, out) => expect(describeStep(s, CAT, { s1: 'soirée' })).toBe(out))
})

describe('defaultParams', () => {
  it('valeurs de départ dans les bornes', () => {
    expect(defaultParams(CAT[0], 's1')).toEqual({ scene_id: 's1' })
    expect(defaultParams(CAT[1])).toEqual({})
    expect(defaultParams(CAT[3])).toEqual({ on: true })
    expect(defaultParams(CAT[4])).toEqual({ mode: 'FOLLOW_VIDEO' })
    expect(defaultParams(CAT[5])).toEqual({ level: 30 })
    expect(defaultParams(CAT[6])).toEqual({ seconds: 5 })
  })
  it('un message de notification démarre vide, jamais avec l’identifiant d’une scène', () => {
    const notify: ActionSpec = { action: 'notify.app', label: 'notification', params: [{ name: 'message', type: 'text', max: 200 }] }
    expect(defaultParams(notify, 'scene-123')).toEqual({ message: '' })
  })
})

describe('moveStep', () => {
  const steps = [step('a'), step('b'), step('c')]
  it('monte et descend', () => {
    expect(moveStep(steps, 1, -1).map((s) => s.action)).toEqual(['b', 'a', 'c'])
    expect(moveStep(steps, 1, 1).map((s) => s.action)).toEqual(['a', 'c', 'b'])
  })
  it('aux extrémités : inchangé', () => {
    expect(moveStep(steps, 0, -1)).toBe(steps)
    expect(moveStep(steps, 2, 1)).toBe(steps)
  })
})
