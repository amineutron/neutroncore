import { describe, expect, it } from 'vitest'
import { highlight, matchesFilter, matchesQuery, normalize, search, selected, sizeText, terms, type LibEntry } from './vmLibrary'
import { ENV_DEFAULT, effectiveEnv, envCommand, envIsEmpty, envLabels, envPackages } from './vmEnv'

const e = (id: string, o: Partial<LibEntry> = {}): LibEntry => ({
  id, dist: id.split('-')[0], nom: 'Distro', ver: 'édition', fmt: 'iso', mb: 100, ram: 512, disk: 5, tags: [], ui: 'aucune', pk: 'minimal',
  os: 'X', src: 'exemple.org', desc: 'une description', pour: 'un usage', cached: false, deployable: true, reason: '', ...o,
})
const CAT: LibEntry[] = [
  e('debian-cloud', { nom: 'Debian 12', ver: 'genericcloud', fmt: 'cloud', tags: ['léger', 'serveur'] }),
  e('debian-kde', { nom: 'Debian 12', ver: 'Live KDE Plasma', ui: 'KDE Plasma', tags: ['bureau'], desc: 'Bureau KDE très personnalisable' }),
  e('debian-xfce', { nom: 'Debian 12', ver: 'Live Xfce', ui: 'Xfce', tags: ['bureau', 'léger'], desc: 'Plus léger que GNOME et KDE' }),
  e('fedora-sway', { nom: 'Fedora 43', ver: 'Sway (tuilage)', ui: 'Sway', tags: ['bureau', 'léger'], desc: 'tuilage Wayland' }),
  e('arch-iso', { nom: 'Arch Linux', ver: 'ISO', tags: ['léger'] }),
]

describe('normalisation', () => {
  it('sans accents ni casse', () => { expect(normalize('Léger ÉCRAN')).toBe('leger ecran') })
  it('mots de la requete', () => { expect(terms('  Debian   KDE ')).toEqual(['debian', 'kde']) })
})

describe('recherche reactive : a chaque lettre', () => {
  it('requete vide : tout', () => { expect(CAT.every((x) => matchesQuery(x, ''))).toBe(true) })
  it('sans accents : « leger » trouve « léger »', () => {
    expect(search(CAT, 'leger', 'tout').flatMap((g) => g.vars.map((v) => v.id)).sort()).toEqual(['arch-iso', 'debian-cloud', 'debian-xfce', 'fedora-sway'])
  })
  it('chaque lettre ajoutee ou retiree met a jour le resultat', () => {
    const ids = (q: string) => search(CAT, q, 'tout').flatMap((g) => g.vars.map((v) => v.id))
    expect(ids('k')).toContain('debian-kde')
    expect(ids('kd')).toEqual(['debian-kde', 'debian-xfce'])   // xfce cite KDE dans sa description
    expect(ids('kde')).toEqual(['debian-kde', 'debian-xfce'])
    expect(ids('kdex')).toEqual([])
    expect(ids('kde')).toEqual(['debian-kde', 'debian-xfce'])  // on revient en arriere
  })
  it('plusieurs mots se cumulent', () => {
    expect(search(CAT, 'debian live', 'tout').flatMap((g) => g.vars.map((v) => v.id))).toEqual(['debian-kde', 'debian-xfce'])
    expect(search(CAT, 'debian sway', 'tout')).toEqual([])
  })
  it('l\'interface est cherchable', () => {
    expect(search(CAT, 'tuilage', 'tout')[0].vars[0].id).toBe('fedora-sway')
    expect(search(CAT, 'avec interface', 'tout').flatMap((g) => g.vars).every((v) => v.ui !== 'aucune')).toBe(true)
  })
  it('les groupes gardent l\'ordre du catalogue', () => {
    expect(search(CAT, '', 'tout').map((g) => g.dist)).toEqual(['debian', 'fedora', 'arch'])
  })
  it('une distribution sans edition qui passe disparait', () => {
    expect(search(CAT, 'arch', 'tout').map((g) => g.dist)).toEqual(['arch'])
  })
})

describe('filtres', () => {
  it.each([
    ['sans interface', ['debian-cloud', 'arch-iso']],
    ['avec interface', ['debian-kde', 'debian-xfce', 'fedora-sway']],
    ['images prêtes', ['debian-cloud']],
    ['iso', ['debian-kde', 'debian-xfce', 'fedora-sway', 'arch-iso']],
    ['bureau', ['debian-kde', 'debian-xfce', 'fedora-sway']],
    ['serveur', ['debian-cloud']],
    ['virt-builder', []],
  ] as const)('%s', (f, ids) => {
    expect(CAT.filter((x) => matchesFilter(x, f)).map((x) => x.id)).toEqual(ids)
  })
  it('filtre ET recherche se combinent', () => {
    expect(search(CAT, 'debian', 'avec interface').flatMap((g) => g.vars.map((v) => v.id))).toEqual(['debian-kde', 'debian-xfce'])
  })
})

describe('edition choisie', () => {
  const g = search(CAT, '', 'tout')[0]
  it('la choisie si elle passe encore', () => { expect(selected(g, 'debian-xfce').id).toBe('debian-xfce') })
  it('sinon la premiere', () => {
    expect(selected(g, 'inconnue').id).toBe('debian-cloud')
    expect(selected(g, undefined).id).toBe('debian-cloud')
  })
})

describe('surbrillance', () => {
  it('marque les mots trouves, sans accents', () => {
    expect(highlight('Plus léger que KDE', 'leger kde')).toEqual([
      { text: 'Plus ', hit: false }, { text: 'léger', hit: true }, { text: ' que ', hit: false }, { text: 'KDE', hit: true },
    ])
  })
  it('sans requete : un seul segment', () => { expect(highlight('abc', '')).toEqual([{ text: 'abc', hit: false }]) })
  it('occurrences multiples et texte vide', () => {
    expect(highlight('abab', 'ab')).toEqual([{ text: 'abab', hit: true }])
    expect(highlight('', 'x')).toEqual([{ text: '', hit: false }])
  })
  it('recoller les segments redonne le texte', () => {
    const t = 'Bureau KDE très personnalisable'
    expect(highlight(t, 'kde tres').map((s) => s.text).join('')).toBe(t)
  })
})

describe('tailles', () => {
  it('Mo sous 1 Go, Go au-dela', () => {
    expect(sizeText(340)).toBe('340 Mo')
    expect(sizeText(2300)).toBe('2,3 Go')
  })
})

describe('mon environnement', () => {
  it('une edition sans interface desactive barre, raccourcis et lanceur', () => {
    const c = effectiveEnv(ENV_DEFAULT, false)
    expect(c).toEqual({ bar: false, keys: false, launcher: false, term: true, tools: true })
  })
  it('avec interface : tout est conserve, sans modifier l\'entree', () => {
    const before = { ...ENV_DEFAULT }
    expect(effectiveEnv(ENV_DEFAULT, true)).toEqual(before)
    effectiveEnv(ENV_DEFAULT, false)
    expect(ENV_DEFAULT).toEqual(before)
  })
  it('libelles et paquets suivent le choix', () => {
    const c = { bar: true, keys: false, launcher: false, term: true, tools: false }
    expect(envLabels(c)).toBe('barre, terminal')
    expect(envPackages(c)).toEqual(['quickshell', 'kitty'])
  })
  it('commande selon la distribution', () => {
    expect(envCommand({ bar: false, keys: false, launcher: false, term: true, tools: false }, 'arch')).toBe('pacman -S kitty')
    expect(envCommand({ bar: false, keys: false, launcher: false, term: true, tools: false }, 'fedora')).toBe('dnf install kitty')
    expect(envCommand({ bar: false, keys: false, launcher: false, term: true, tools: false }, 'inconnue')).toBe('apt install kitty')
  })
  it('rien a appliquer : aucune commande', () => {
    const none = { bar: false, keys: false, launcher: false, term: false, tools: false }
    expect(envIsEmpty(none)).toBe(true)
    expect(envCommand(none, 'arch')).toBe('')
  })
})
