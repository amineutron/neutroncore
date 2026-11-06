import { describe, expect, it } from 'vitest'
import { AUTOMATION_CATALOGUE } from '../mock/data/automationCatalogue'
import { EXEMPLES_AUTOMATISATION } from './automationExemples'
import { draftError, type Catalogue } from './automations'

describe('exemples d’automatisation', () => {
  const cat = AUTOMATION_CATALOGUE as unknown as Catalogue
  it.each(EXEMPLES_AUTOMATISATION.map((e) => [e.id, e] as const))('%s : blocs connus du catalogue et brouillon valide', (_id, e) => {
    expect(cat.triggers.some((t) => t.type === e.draft.trigger.type)).toBe(true)
    for (const a of e.draft.actions) expect(cat.actions.some((x) => x.action === a.action)).toBe(true)
    expect(draftError(e.draft)).toBe('')
  })
  it('identifiants uniques', () => {
    const ids = EXEMPLES_AUTOMATISATION.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
