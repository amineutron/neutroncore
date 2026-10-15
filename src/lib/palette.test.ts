import { beforeEach, describe, expect, it } from 'vitest'
import { fold, getFavs, rank, score, setFavs, subscribeFavs, toggleFav, type Command } from './palette'

const cmd = (id: string, label: string, group = 'aller', keywords?: string): Command => ({ id, label, group, keywords, run: () => {} })
const CMDS = [
  cmd('go:films', 'films & séries'), cmd('go:dl', 'téléchargements', 'aller', 'torrents qbittorrent'),
  cmd('tv:toggle', 'mode télé', 'affichage'), cmd('scene:1', 'scène : soirée film', 'maison'),
  cmd('go:taches', 'tâches'),
]
const ids = (l: Command[]) => l.map((c) => c.id)

describe('fold', () => {
  it('retire accents et majuscules', () => expect(fold('Télé SÉRIES')).toBe('tele series'))
})

describe('score', () => {
  it.each([
    ['tele', 'tv:toggle'], ['telech', 'go:dl'], ['torrent', 'go:dl'], ['flm', 'go:films'], ['soiree', 'scene:1'],
  ])('« %s » trouve %s', (q, id) => expect(ids(rank(CMDS, q, []))[0]).toBe(id))

  it('tous les mots doivent correspondre', () => {
    expect(score('scene film', CMDS[3])).toBeGreaterThan(0)
    expect(score('scene torrent', CMDS[3])).toBe(0)
  })

  it('le début du libellé passe devant un début de mot au milieu', () => {
    expect(ids(rank(CMDS, 'fil', []))).toEqual(['go:films', 'scene:1'])
  })

  it('le mot entier passe devant un simple préfixe', () => {
    expect(ids(rank(CMDS, 'film', []))).toEqual(['scene:1', 'go:films'])
  })

  it('l’approximatif ne pioche pas ses lettres dans plusieurs mots', () => {
    // régression : « soir » trouvait « lumières : tout éteindre » (s…o…i…r éparpillés)
    expect(score('soir', { label: 'lumières : tout éteindre', group: 'maison' })).toBe(0)
    expect(score('flm', { label: 'films & séries', group: 'aller' })).toBe(20)
  })

  it('une lettre seule ne déclenche pas la recherche approximative', () => {
    expect(score('z', CMDS[0])).toBe(0)
  })

  it('sans correspondance : liste vide, même pour un favori', () => {
    expect(rank(CMDS, 'xyzzy', ['go:films'])).toEqual([])
  })
})

describe('rank', () => {
  it('saisie vide : favoris d’abord, dans l’ordre choisi', () => {
    expect(ids(rank(CMDS, '', ['scene:1', 'go:dl']))).toEqual(['scene:1', 'go:dl', 'go:films', 'tv:toggle', 'go:taches'])
  })

  it('un favori disparu (scène supprimée) est ignoré', () => {
    expect(ids(rank(CMDS, ' ', ['scene:gone', 'go:taches']))[0]).toBe('go:taches')
  })

  it('à score égal, le favori passe devant', () => {
    expect(ids(rank(CMDS, 't', ['go:taches'])).indexOf('go:taches')).toBeLessThan(ids(rank(CMDS, 't', [])).indexOf('go:taches') + 1)
    expect(ids(rank(CMDS, 't', ['go:taches']))[0]).toBe('go:taches')
  })
})

describe('favoris', () => {
  beforeEach(() => setFavs([]))

  it('toggleFav ajoute puis retire sans muter', () => {
    const a: string[] = []
    const b = toggleFav(a, 'x')
    expect(a).toEqual([]); expect(b).toEqual(['x']); expect(toggleFav(b, 'x')).toEqual([])
  })

  it('setFavs prévient les abonnés, même sans stockage disponible', () => {
    const seen: string[][] = []
    const off = subscribeFavs(() => seen.push(getFavs()))
    setFavs(['go:films'])
    off()
    setFavs([])
    expect(seen).toEqual([['go:films']])
  })
})
