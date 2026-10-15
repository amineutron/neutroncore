import { afterEach, describe, expect, it } from 'vitest'
import { canLeave, hasNavGuard, setNavGuard } from './navGuard'

afterEach(() => setNavGuard(null))

describe('navGuard', () => {
  it('sans garde, on quitte librement', async () => {
    expect(hasNavGuard()).toBe(false)
    await expect(canLeave()).resolves.toBe(true)
  })
  it('la garde décide, puis se retire', async () => {
    setNavGuard(async () => false)
    expect(hasNavGuard()).toBe(true)
    await expect(canLeave()).resolves.toBe(false)
    setNavGuard(null)
    await expect(canLeave()).resolves.toBe(true)
  })
})
