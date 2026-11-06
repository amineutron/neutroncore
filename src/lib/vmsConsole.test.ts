import { describe, expect, it } from 'vitest'
import { filterVms, jobDuration, nameError, fmtSize, vmName, type Filters } from './vmsConsole'
import type { Vm } from './vms'

const vm = (name: string, status: string): Vm => ({ name: `vm_${name}`, display_name: name, status, type: 'vm', extra: {} })
const VMS = [vm('arch-base', 'up'), vm('test-vm', 'down'), vm('win', 'starting')]
const F = (state: Filters['state'], q = ''): Filters => ({ state, q })

describe('filterVms', () => {
  it.each([
    ['all', '', ['arch-base', 'test-vm', 'win']],
    ['up', '', ['arch-base']],
    ['down', '', ['test-vm', 'win']],     // en transition : pas allumee
    ['all', 'TEST', ['test-vm']],
    ['up', 'win', []],
  ] as const)('%s / "%s"', (s, q, noms) => {
    expect(filterVms(VMS, F(s, q)).map(vmName)).toEqual(noms)
  })
})

describe('nameError', () => {
  it.each([['vm-1', null], ['', 'donne un nom'], ['a b', 'x'], ['-a', 'x'], ['../x', 'x']] as const)('%s', (n, r) => {
    const e = nameError(n)
    expect(r === null ? e === null : e !== null).toBe(true)
  })
  it('refuse un nom deja pris', () => expect(nameError('a', ['a'])).toBe('ce nom est deja pris'))
})

it('jobDuration', () => {
  expect(jobDuration({ started: 0, ended: 42 })).toBe('42 s')
  expect(jobDuration({ started: 0, ended: 125 })).toBe('2 min 5 s')
  expect(jobDuration({ started: 100, ended: null }, 130)).toBe('30 s')
})

it('fmtSize', () => {
  expect(fmtSize(2_500_000_000)).toBe('2.5 Go')
  expect(fmtSize(42_000_000)).toBe('42 Mo')
})
