import { describe, expect, it } from 'vitest'
import { aDetail, cibleSolution, elementsDetail, type SectionBriefing } from './resume'

describe('détail et solution du résumé', () => {
  const connus = ['sauvegardes', 'ressources']
  it('cible : notifications, écran connu, ou rien', () => {
    expect(cibleSolution({ texte: 't', ecran: 'notifications', bouton: 'b' }, connus)).toEqual({ kind: 'notifs' })
    expect(cibleSolution({ texte: 't', ecran: 'sauvegardes', bouton: 'b' }, connus)).toEqual({ kind: 'ecran', id: 'sauvegardes' })
    expect(cibleSolution({ texte: 't', ecran: 'inconnu', bouton: 'b' }, connus)).toBeNull()
    expect(cibleSolution(null, connus)).toBeNull()
  })
  it('éléments et dépliage', () => {
    const base: SectionBriefing = { id: 'a', titre: 'a', niveau: 'ok', lignes: [{ text: 'x', level: 'ok' }], cachees: 0, total: 1 }
    expect(aDetail(base)).toBe(false)
    expect(elementsDetail(base)).toBe(base.lignes)
    const riche = { ...base, tous: [{ text: 'x', level: 'ok' as const, detail: 'd' }, { text: 'y', level: 'ok' as const }] }
    expect(aDetail(riche)).toBe(true)
    expect(elementsDetail(riche)).toHaveLength(2)
  })
})
