import { describe, expect, it } from 'vitest'
import { basculerSource, cible, commandesTrouvees, ecransDe, grouper, hitsEnCommandes, lireFiltres, parametreSources, problemes, surligner, type Hit } from './recherche'
import type { Command } from './palette'

const H = (source: Hit['source'], titre: string, over: Partial<Hit> = {}): Hit =>
  ({ source, id: `${source}:${titre}`, titre, detail: '', score: 10, ecran: '', ref: '', niveau: '', ...over })
const C = (id: string, label: string, group = 'aller'): Command => ({ id, label, group, run: () => {} })

describe('recherche globale', () => {
  it('regroupe dans l’ordre du classement', () => {
    const g = grouper([H('docs', 'a'), H('films', 'b'), H('docs', 'c')])
    expect(g.map((x) => [x.source, x.hits.length])).toEqual([['docs', 2], ['films', 1]])
    expect(g[0].label).toBe('docs claude.md')
  })

  it('signale les sources lentes ou en panne seulement', () => {
    const s = {
      films: { n: 1, ms: 5, etat: 'ok' as const, label: 'films et séries' },
      docs: { n: 0, ms: 3000, etat: 'delai' as const, label: 'docs claude.md' },
      sessions: { n: 0, ms: 9, etat: 'erreur' as const, label: 'sessions claude', erreur: 'kitty absent' },
    }
    expect(problemes(s)).toEqual(['docs claude.md : délai dépassé', 'sessions claude : kitty absent'])
  })

  it('relit les filtres, tolère un stockage corrompu et garde toujours une source', () => {
    expect(lireFiltres(null)).toHaveLength(6)
    expect(lireFiltres('{pas du json')).toHaveLength(6)
    expect(lireFiltres('["docs","inconnue"]')).toEqual(['docs'])
    expect(lireFiltres('[]')).toHaveLength(6)
    expect(basculerSource(['docs'], 'docs')).toEqual(['docs'])
    expect(basculerSource(['docs'], 'films')).toEqual(['films', 'docs'])      // ordre du catalogue conservé
    expect(parametreSources(lireFiltres(null))).toBe('')
    expect(parametreSources(['films', 'docs'])).toBe('&sources=films,docs')
  })

  it('cible : écran connu, session en lien profond, notification sans écran, docs à copier', () => {
    const ecrans = ['films', 'lanceur', 'disque']
    expect(cible(H('films', 'x', { ecran: 'films' }), ecrans)).toEqual({ type: 'ecran', ecran: 'films' })
    expect(cible(H('sessions', 'x', { ecran: 'lanceur', ref: 'sid1' }), ecrans)).toEqual({ type: 'ecran', ecran: 'lanceur', session: 'sid1' })
    expect(cible(H('notifications', 'x', { ecran: '' }), ecrans)).toEqual({ type: 'notifs' })
    expect(cible(H('notifications', 'x', { ecran: 'disque' }), ecrans)).toEqual({ type: 'ecran', ecran: 'disque' })
    expect(cible(H('notifications', 'x', { ecran: 'inconnu' }), ecrans)).toEqual({ type: 'notifs' })
    expect(cible(H('docs', 'x', { ref: 'lyra/CLAUDE.md' }), ecrans)).toEqual({ type: 'copier', texte: 'lyra/CLAUDE.md' })
  })

  it('commandes de la palette : mêmes règles que Ctrl+K, bornées, rien sous 2 lettres', () => {
    const cmds = [C('go:films', 'films & séries'), C('go:taches', 'tâches de fond'), C('tv:toggle', 'mode télé', 'affichage')]
    expect(ecransDe(cmds)).toEqual(['films', 'taches'])
    expect(commandesTrouvees(cmds, 'tele', []).map((c) => c.id)).toEqual(['tv:toggle'])
    expect(commandesTrouvees(cmds, 't', [])).toEqual([])
    expect(commandesTrouvees(cmds, 'e', [], 1)).toEqual([])
    expect(commandesTrouvees(cmds, 'es', [], 1)).toHaveLength(1)
  })

  it('surligne sans accents ni casse et fusionne les morceaux', () => {
    expect(surligner('Mode Télé', 'tele')).toEqual([{ t: 'Mode ', hit: false }, { t: 'Télé', hit: true }])
    expect(surligner('abc', '')).toEqual([{ t: 'abc', hit: false }])
    expect(surligner('aa aa', 'aa').map((m) => m.hit)).toEqual([true, false, true])
    expect(surligner('tele tele', 'tele salon').filter((m) => m.hit)).toHaveLength(2)
  })

  it('chaque résultat devient une commande qui appelle la bonne action', () => {
    const appels: string[] = []
    const actions = {
      allerA: (e: string, s?: string) => { appels.push(`aller:${e}:${s ?? ''}`) },
      ouvrirNotifs: () => { appels.push('notifs') },
      copier: (t: string) => { appels.push(`copier:${t}`) },
    }
    const hits = [H('films', 'Dune', { ecran: 'films', detail: 'film 2021' }), H('sessions', 's', { ecran: 'lanceur', ref: 'sid' }),
      H('notifications', 'n'), H('docs', 'd', { ref: 'lyra/CLAUDE.md' })]
    const cmds = hitsEnCommandes(hits, ['films', 'lanceur'], actions)
    expect(cmds.map((c) => c.group)).toEqual(['films et séries', 'sessions claude', 'notifications', 'docs claude.md'])
    expect(cmds[0]).toMatchObject({ label: 'Dune', detail: 'film 2021', nav: true })
    expect(cmds[3].nav).toBe(false)
    cmds.forEach((c) => { void c.run() })
    expect(appels).toEqual(['aller:films:', 'aller:lanceur:sid', 'notifs', 'copier:lyra/CLAUDE.md'])
  })
})
