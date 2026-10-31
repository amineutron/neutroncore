import { describe, expect, it } from 'vitest'
import { launchButtons } from './testsLabels'

describe('launchButtons', () => {
  it('suite sans cibles : un seul bouton', () => {
    expect(launchButtons(0, 0)).toEqual([{ key: 'suite', label: 'lancer la suite', solid: true }])
  })
  it('aucune sélection : lancer tout', () => {
    expect(launchButtons(4, 0).map((b) => b.label)).toEqual(['lancer tout'])
  })
  it('sélection : la sélection en premier, tout en second plan', () => {
    const b = launchButtons(4, 2)
    expect(b.map((x) => x.label)).toEqual(['lancer la sélection (2)', 'lancer tout'])
    expect(b[1].solid).toBe(false)
  })
})
