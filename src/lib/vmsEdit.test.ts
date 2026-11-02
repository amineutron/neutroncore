import { describe, expect, it } from 'vitest'
import { draftFrom, editErrors, editPayload, editSummary, needsStop } from './vmsEdit'

const base = draftFrom({ vcpus: 4, memory_mib: 8192, autostart_on: false })

describe('draftFrom', () => {
  it('reprend les valeurs actuelles', () => {
    expect(base).toEqual({ vcpus: '4', memory_mib: '8192', autostart: false })
  })
  it('valeurs inconnues : champs vides, demarrage auto desactive', () => {
    expect(draftFrom({})).toEqual({ vcpus: '', memory_mib: '', autostart: false })
    expect(draftFrom({ autostart_on: null }).autostart).toBe(false)
  })
})

describe('editErrors', () => {
  it('brouillon d\'origine valide', () => expect(editErrors(base)).toEqual({}))
  it.each([
    ['0', 'vcpus'], ['33', 'vcpus'], ['2.5', 'vcpus'], ['abc', 'vcpus'], ['', 'vcpus'], ['-1', 'vcpus'],
  ])('vcpus %j refuse', (v, k) => expect(editErrors({ ...base, vcpus: v })[k as 'vcpus']).toBeTruthy())
  it.each([['511'], ['65537'], ['4 Go'], ['']])('memoire %j refusee', (v) => {
    expect(editErrors({ ...base, memory_mib: v }).memory_mib).toBeTruthy()
  })
  it('bornes incluses', () => {
    expect(editErrors({ ...base, vcpus: '32', memory_mib: '512' })).toEqual({})
    expect(editErrors({ ...base, vcpus: '1', memory_mib: '65536' })).toEqual({})
  })
  it('message de bornes lisible', () => {
    expect(editErrors({ ...base, vcpus: '99' }).vcpus).toBe('entre 1 et 32 processeurs')
  })
})

describe('editPayload', () => {
  it('rien de change : demande vide', () => expect(editPayload(base, base)).toEqual({}))
  it('seulement les champs modifies', () => {
    expect(editPayload(base, { ...base, vcpus: '6' })).toEqual({ vcpus: 6 })
    expect(editPayload(base, { ...base, memory_mib: '4096', autostart: true })).toEqual({ memory_mib: 4096, autostart: true })
  })
  it('espaces ignores', () => expect(editPayload(base, { ...base, vcpus: ' 4 ' })).toEqual({}))
})

describe('needsStop / editSummary', () => {
  it('cpu et memoire exigent l\'arret, pas le demarrage auto', () => {
    expect(needsStop({ vcpus: 2 })).toBe(true)
    expect(needsStop({ memory_mib: 1024 })).toBe(true)
    expect(needsStop({ autostart: true })).toBe(false)
    expect(needsStop({})).toBe(false)
  })
  it('resume en francais', () => {
    expect(editSummary({ vcpus: 1, memory_mib: 2048, autostart: true }))
      .toBe('1 processeur, 2048 Mio de memoire, demarrage auto active')
    expect(editSummary({ vcpus: 8 })).toBe('8 processeurs')
  })
})
