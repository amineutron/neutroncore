import { describe, expect, it } from 'vitest'
import { aSignaler, avecVille, basculer, deplacer, deplacerVers, fixerMax, heureValide, memesReglages, pastille, sansVille, type Reglages, type SectionReglage } from './resume'

const L = (...ids: string[]): SectionReglage[] => ids.map((id) => ({ id, enabled: true, max: 5 }))
const ids = (l: SectionReglage[]) => l.map((s) => s.id)

describe('réglages du résumé matinal', () => {
  it('déplace d’un cran sans muter, et ne bouge pas aux bords', () => {
    const l = L('a', 'b', 'c')
    expect(ids(deplacer(l, 'b', -1))).toEqual(['b', 'a', 'c'])
    expect(ids(deplacer(l, 'b', 1))).toEqual(['a', 'c', 'b'])
    expect(deplacer(l, 'a', -1)).toBe(l)
    expect(deplacer(l, 'c', 1)).toBe(l)
    expect(deplacer(l, 'zz', 1)).toBe(l)
    expect(ids(l)).toEqual(['a', 'b', 'c'])
  })

  it.each([
    ['a', 'c', ['b', 'c', 'a']],       // vers le bas : prend la place de la cible
    ['c', 'a', ['c', 'a', 'b']],       // vers le haut
    ['b', 'b', ['a', 'b', 'c']],
  ])('glisser %s sur %s', (from, to, attendu) => {
    expect(ids(deplacerVers(L('a', 'b', 'c'), from, to))).toEqual(attendu)
  })

  it('glisser vers un identifiant inconnu ne change rien', () => {
    const l = L('a', 'b')
    expect(deplacerVers(l, 'a', 'x')).toBe(l)
  })

  it('bascule une section et borne le nombre d’éléments', () => {
    const l = L('a', 'b')
    expect(basculer(l, 'a')[0].enabled).toBe(false)
    expect(l[0].enabled).toBe(true)
    expect(fixerMax(l, 'a', 99)[0].max).toBe(20)
    expect(fixerMax(l, 'a', 0)[0].max).toBe(1)
    expect(fixerMax(l, 'a', 3.6)[0].max).toBe(4)
  })

  it.each([['07:30', true], ['23:59', true], ['24:00', false], ['7:30', false], ['', false]])('heure %s', (h, ok) => {
    expect(heureValide(h)).toBe(ok)
  })

  it('ville : choisir puis retirer', () => {
    const r: Reglages = {
      heure: '07:30', intro: '', sections: [], meteo: { ville: '', lat: null, lon: null },
      envoi: { actif: false, telephone: true, centre: true }, accueil: true, ia: { actif: false, modele: 'm' },
    }
    const v = avecVille(r, { nom: 'Lyon', zone: '', lat: 45.75, lon: 4.85 })
    expect(v.meteo).toEqual({ ville: 'Lyon', lat: 45.75, lon: 4.85 })
    expect(sansVille(v).meteo.lat).toBeNull()
    expect(memesReglages(r, { ...r })).toBe(true)
    expect(memesReglages(r, v)).toBe(false)
  })

  it('pastilles et décompte', () => {
    expect(pastille('info')).toBe('ok')
    expect(pastille('crit')).toBe('crit')
    const s = (niveau: 'ok' | 'warn' | 'crit') => ({ id: 'x', titre: '', niveau, lignes: [], cachees: 0, total: 0 })
    expect(aSignaler([s('ok'), s('warn'), s('crit')])).toBe(2)
  })
})
