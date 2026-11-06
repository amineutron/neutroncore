import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FILTRES_DEFAUT, chargerFiltres, dureeCourte, parFichier, phraseRotation, requeteJournal, sauverFiltres, tonNiveau, type Rotation } from './securite'

const R = (p: Partial<Rotation>): Rotation => ({ nom: 'x.cred', libelle: 'x', age_jours: 10, periode_jours: 30, reste_jours: 20, etat: 'ok', ...p })

describe('securite', () => {
  beforeEach(() => {
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), clear: () => m.clear() })
  })

  it('la requete encode les filtres et omet les vides', () => {
    expect(requeteJournal(FILTRES_DEFAUT)).toBe('unite=%40user&plage=1h')
    expect(requeteJournal({ ...FILTRES_DEFAUT, priorite: 'erreur', recherche: ' a&b=c ' })).toBe('unite=%40user&plage=1h&priorite=erreur&recherche=a%26b%3Dc')
  })

  it('les filtres sont retenus et un stockage abime retombe sur le defaut', () => {
    sauverFiltres({ ...FILTRES_DEFAUT, plage: '24h', groupes: false })
    expect(chargerFiltres()).toMatchObject({ plage: '24h', groupes: false })
    localStorage.setItem('neutroncore_securite_filtres', '{pas du json')
    expect(chargerFiltres()).toEqual(FILTRES_DEFAUT)
    localStorage.setItem('neutroncore_securite_filtres', JSON.stringify({ unite: 3, recherche: 'x'.repeat(500) }))
    expect(chargerFiltres().unite).toBe('@user')
    expect(chargerFiltres().recherche).toHaveLength(100)
  })

  it.each([[0, 'crit'], [3, 'crit'], [4, 'warn'], [5, ''], [7, '']])('ton du niveau %i', (n, ton) => {
    expect(tonNiveau(n)).toBe(ton)
  })

  it('phrase de rotation', () => {
    expect(phraseRotation(R({}))).toBe('renouvelée il y a 10 j, prochaine dans 20 j')
    expect(phraseRotation(R({ etat: 'due', age_jours: 40, reste_jours: -10 }))).toBe('due depuis 10 j (âge 40 j sur 30)')
  })

  it.each([[5, '5 s'], [120, '2 min'], [7200, '2 h'], [259200, '3 j']])('duree %i', (s, txt) => {
    expect(dureeCourte(s)).toBe(txt)
  })

  it('regroupe les trouvailles par fichier', () => {
    const t = (chemin: string, ligne: number) => ({ depot: 'd', chemin, ligne, motif: 'm', emplacement: '' })
    expect(parFichier([t('b.py', 1), t('a.py', 2), t('a.py', 5)]).map((g) => [g.fichier, g.lignes])).toEqual([['d/a.py', [2, 5]], ['d/b.py', [1]]])
  })
})
