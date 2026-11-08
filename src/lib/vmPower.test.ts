import { describe, expect, it } from 'vitest'
import { POWER_LABEL } from './vmHubApi'
import { POWER_ACTIONS, POWER_BUSY, POWER_SHORT, POWER_TARGET, isDangerous, lifeOf } from './vmPower'

describe('lifeOf', () => {
  it('hub : vm_state fait foi', () => {
    expect(lifeOf({ status: 'up', extra: { vm_state: 'running' } })).toBe('running')
    expect(lifeOf({ status: 'paused', extra: { vm_state: 'paused' } })).toBe('paused')
    expect(lifeOf({ status: 'starting', extra: { vm_state: 'starting' } })).toBe('transition')
    expect(lifeOf({ status: 'down', extra: { vm_state: 'stopped' } })).toBe('stopped')
  })
  it('ecran des services : status up/down, vm_state en clair', () => {
    expect(lifeOf({ status: 'up', extra: { vm_state: 'actif' } })).toBe('running')
    expect(lifeOf({ status: 'down', extra: { vm_state: 'arrêtée' } })).toBe('stopped')
    expect(lifeOf({ status: 'down', extra: {} })).toBe('stopped')
    expect(lifeOf({ status: 'unknown' })).toBe('stopped')
  })
})

describe('boutons selon l\'etat', () => {
  it('en marche : pause, redémarrer, arrêter, forcer ; en pause : reprendre, forcer ; éteinte : démarrer ; transition : rien', () => {
    expect(POWER_ACTIONS.running.map((a) => POWER_SHORT[a])).toEqual(['pause', 'redémarrer', 'arrêter', 'forcer'])
    expect(POWER_ACTIONS.paused.map((a) => POWER_SHORT[a])).toEqual(['reprendre', 'forcer'])
    expect(POWER_ACTIONS.stopped.map((a) => POWER_SHORT[a])).toEqual(['démarrer'])
    expect(POWER_ACTIONS.transition).toEqual([])
  })
  it('chaque action a une cible, un libelle occupe, un verbe et un toast', () => {
    for (const a of ['start', 'stop', 'force_stop', 'pause', 'resume', 'reboot'] as const) {
      expect(POWER_TARGET[a]).toBeTruthy()
      expect(POWER_BUSY[a]).toMatch(/…$/)
      expect(POWER_LABEL[a].verb.length).toBeGreaterThan(3)
      expect(POWER_LABEL[a].toast).toMatch(/ de$/)
    }
  })
  it('reprendre ramene en marche, la pause vise « en pause »', () => {
    expect(POWER_TARGET.resume).toBe('running')
    expect(POWER_TARGET.pause).toBe('paused')
    expect(POWER_TARGET.reboot).toBe('running')
  })
  it('arrêt, arrêt forcé et redémarrage sont dangereux ; pause, reprise et démarrage non', () => {
    expect(['stop', 'force_stop', 'reboot'].every((a) => isDangerous(a as 'stop'))).toBe(true)
    expect(['start', 'pause', 'resume'].some((a) => isDangerous(a as 'start'))).toBe(false)
  })
})
