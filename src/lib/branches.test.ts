import { describe, expect, it } from 'vitest'
import { aTraiter, conseil, trierDepots, type Branche, type Depot } from './branches'

const B = (p: Partial<Branche>): Branche => ({ nom: 'x', le: '', avance: 1, poussee: false, conflit: false, etat: 'sans_pr', pr: null, ...p })
const D = (depot: string, branches: Branche[], erreur?: string): Depot => ({ depot, branches, prs: [], sessions: [], erreur })

describe('branches des projets suivis', () => {
  it('dit quoi faire de chaque branche', () => {
    expect(conseil(B({ avance: 3 }))).toEqual({ texte: '3 commits, jamais poussée', tone: 'warn' })
    expect(conseil(B({ poussee: true }))).toEqual({ texte: '1 commit, poussée, sans PR', tone: 'warn' })
    expect(conseil(B({ etat: 'pr', pr: 12 }))).toEqual({ texte: 'en PR #12', tone: 'ok' })
    expect(conseil(B({ etat: 'pr', pr: 12, conflit: true })).texte).toBe('PR #12 en conflit avec la branche principale')
    expect(conseil(B({ conflit: true })).tone).toBe('crit')
    expect(conseil(B({ etat: 'fusionnee', avance: 0 })).texte).toBe('déjà fusionnée : à supprimer')
  })
  it('un dépôt est à traiter s’il a autre chose que des PR propres', () => {
    expect(aTraiter(D('a', [B({ etat: 'pr', pr: 1 })]))).toBe(false)
    expect(aTraiter(D('a', []))).toBe(false)
    expect(aTraiter(D('a', [B({})]))).toBe(true)
    expect(aTraiter(D('a', [B({ etat: 'pr', pr: 1, conflit: true })]))).toBe(true)
    expect(aTraiter(D('a', [], 'illisible'))).toBe(true)
    expect(aTraiter(D('a', [B({ etat: 'incluse', pr: 3 })]))).toBe(false)
    expect(conseil(B({ etat: 'incluse', pr: 3 })).texte).toBe('déjà dans la PR #3 : à supprimer une fois fusionnée')
  })
  it('les dépôts à traiter passent devant', () => {
    expect(trierDepots([D('b', []), D('c', [B({})]), D('a', [])]).map((d) => d.depot)).toEqual(['c', 'a', 'b'])
  })
})
