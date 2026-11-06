import { describe, expect, it } from 'vitest'
import {
  etatEdition, grouperParSection, grouperParTheme, libelleCanal, messageApplication, nomOutil, pourcent, quand,
  requete, texteEditable, toneTaux, verdict, estListe, listeDeValeur, nettoyerLignes, validerMot, valeurDeListe,
  type Evenement, type Souvenir, type Theme,
} from './lyraMemoire'

describe('ajout d un mot et de ses « veut dire »', () => {
  it('valide et normalise', () => {
    expect(validerMot('  la box ', ['la télé', ' ', 'La Télé', 'la television'])).toEqual({
      ok: true, mot: 'la box', veutDire: ['la télé', 'la television'],
    })
  })
  it.each([
    ['', ['a'], 'écris le mot'],
    ['a,b', ['a'], 'virgule'],
    ['box', [], 'au moins un'],
    ['box', [' ', ''], 'au moins un'],
    ['box', ['Box'], 'au moins un'],
    ['box', ['a,b'], 'virgule'],
    ['x'.repeat(61), ['a'], 'dépasse'],
    ['box', ['y'.repeat(61)], 'dépasse'],
    ['box', Array.from({ length: 13 }, (_, i) => `m${i}`), 'au plus'],
  ])('refuse %j %j', (mot, lignes, extrait) => {
    const r = validerMot(mot, lignes as string[])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erreur).toContain(extrait)
  })
  it('liste <-> valeur', () => {
    expect(listeDeValeur('machine, serveur,,  hôte ')).toEqual(['machine', 'serveur', 'hôte'])
    expect(valeurDeListe(['a', 'A', ' b '])).toBe('a, b')
    expect(nettoyerLignes(['', ' '])).toEqual([])
  })
  it('seul un mot a liste est une liste', () => {
    const mot = (detail: string): Souvenir => ({ ...s('x', 'vocabulaire'), genre: 'mot', detail })
    expect(estListe(mot('aussi dit : a, b'))).toBe(true)
    expect(estListe(mot('veut dire « demarre »'))).toBe(false)
    expect(estListe(s('y', 'tele'))).toBe(false)
  })
  it('messages apres un ajout', () => {
    expect(messageApplication('ajouté', { appliquee_chez_lyra: true, redemarrage_requis: true }))
      .toEqual({ texte: 'ajouté dans la mémoire de lyra - actif après le redémarrage de son démon', ton: 'ok' })
    expect(messageApplication('ajouté', { appliquee_chez_lyra: false }).ton).toBe('warn')
    expect(messageApplication('ajouté', { appliquee_chez_lyra: false }).texte).toContain('neutroncore seulement')
  })
})

const s = (id: string, theme: string, groupe = ''): Souvenir =>
  ({ id, genre: 'demande', theme, texte: id, detail: '', at: null, outil: '', groupe, corrige: false })
const THEMES: Theme[] = [{ id: 'tele', libelle: 'télé', n: 1 }, { id: 'machines', libelle: 'machines', n: 2 }]

describe('grouperParTheme', () => {
  it('suit l’ordre des themes et ignore les themes vides', () => {
    const g = grouperParTheme([s('a', 'machines'), s('b', 'tele'), s('c', 'machines')], THEMES)
    expect(g.map((x) => [x.libelle, x.items.map((i) => i.id)])).toEqual([['télé', ['b']], ['machines', ['a', 'c']]])
  })
  it('un theme inconnu garde son identifiant, a la fin', () => {
    const g = grouperParTheme([s('a', 'nouveau'), s('b', 'tele')], THEMES)
    expect(g.map((x) => x.libelle)).toEqual(['télé', 'nouveau'])
  })
  it('liste vide', () => expect(grouperParTheme([], THEMES)).toEqual([]))
})

describe('grouperParSection', () => {
  it('regroupe par section en gardant l’ordre', () => {
    const g = grouperParSection([s('a', 'v', 'VM'), s('b', 'v', 'Hue'), s('c', 'v', 'VM')])
    expect(g.map((x) => [x.section, x.items.length])).toEqual([['VM', 2], ['Hue', 1]])
  })
})

describe('quand', () => {
  const now = 1_000_000 * 1000
  it.each([[null, ''], [1_000_000 - 10, "à l'instant"], [1_000_000 - 600, 'il y a 10 min'],
    [1_000_000 - 7200, 'il y a 2 h'], [1_000_000 - 86400 * 3, 'il y a 3 j'], [1_000_000 + 50, "à l'instant"]])(
    '%s', (at, out) => expect(quand(at, now)).toBe(out))
})

describe('taux', () => {
  it.each([[null, undefined, '-'], [95, 'ok', '95 %'], [60, 'warn', '60 %'], [20, 'crit', '20 %'], [0, 'crit', '0 %']])(
    '%s', (t, tone, txt) => { expect(toneTaux(t)).toBe(tone); expect(pourcent(t)).toBe(txt) })
})

describe('verdict et nomOutil', () => {
  const ev = (succes: boolean | null, compris: boolean) => ({ succes, compris }) as Evenement
  it.each([[true, true, 'a marché'], [false, true, "n'a pas abouti"], [false, false, "n'a pas compris"],
    [null, true, 'résultat non noté']])('%s %s', (a, b, out) => expect(verdict(ev(a, b))).toBe(out))
  it('nomOutil', () => {
    expect(nomOutil('fedora.vm_start')).toBe('vm start')
    expect(nomOutil('')).toBe('rien compris')
  })
})

describe('messageApplication : vraie memoire ou copie neutroncore', () => {
  it('correction chez lyra', () => {
    expect(messageApplication('corrigé', { appliquee_chez_lyra: true })).toEqual({ texte: 'corrigé dans la mémoire de lyra', ton: 'ok' })
  })
  it('suppression chez lyra : definitive, et redemarrage annonce pour le vocabulaire', () => {
    expect(messageApplication('supprimé', { appliquee_chez_lyra: true }).texte).toBe('oublié par lyra pour de bon')
    const m = messageApplication('corrigé', { appliquee_chez_lyra: true, redemarrage_requis: true })
    expect(m.ton).toBe('ok')
    expect(m.texte).toContain('redémarrage')
  })
  it.each([[{ appliquee_chez_lyra: false }], [undefined], [{}]])('couche locale seulement : %j', (r) => {
    const m = messageApplication('corrigé', r)
    expect(m.ton).toBe('warn')
    expect(m.texte).toBe("corrigé dans neutroncore seulement : lyra garde l'original")
  })
})

describe('etatEdition', () => {
  it('dit la verite dans les deux cas', () => {
    expect(etatEdition(true)).toMatchObject({ libelle: 'mémoire réelle', ton: 'ok' })
    expect(etatEdition(false)).toMatchObject({ libelle: 'copie neutroncore', ton: 'warn' })
    expect(etatEdition(undefined).ton).toBe('warn')       // un ancien serveur sans le champ : prudence
  })
})

describe('texteEditable et libelleCanal', () => {
  it('un mot se corrige par son sens, le reste par sa phrase', () => {
    expect(texteEditable({ ...s('v', 'vocabulaire'), genre: 'mot', texte: 'start', valeur: 'démarre' })).toBe('démarre')
    expect(texteEditable({ ...s('v', 'vocabulaire'), genre: 'mot', texte: 'start' })).toBe('')
    expect(texteEditable(s('a', 'tele'))).toBe('a')
  })
  it.each([['vocal', 'voix'], ['texte', 'clavier'], ['api', 'application'], ['inconnu', ''], ['', '']])('%s', (c, l) =>
    expect(libelleCanal(c)).toBe(l))
})

describe('requete', () => {
  it('ignore le vide et encode', () => {
    expect(requete({ q: 'a b', theme: '', n: 3, x: undefined })).toBe('?q=a+b&n=3')
    expect(requete({})).toBe('')
  })
})
