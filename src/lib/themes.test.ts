import { describe, expect, it } from 'vitest'
import {
  BUILTIN, TOKEN_NAMES, contrastChecks, contrastFailures, contrastRatio, duplicateTheme, exportThemes, importThemes,
  loadThemes, luminance, newTheme, normalizeHex, persoIdOf, persoValue, removeTheme, saveThemes, slugId, themeCss,
  upsertTheme, validateTheme, withDerivedSofts, type CustomTheme, type KV,
} from './themes'

const neutron = BUILTIN.neutron
const mk = (name = 'mon theme', taken: string[] = []): CustomTheme => newTheme(name, neutron, taken)

describe('contraste WCAG', () => {
  it.each([
    ['#000000', '#ffffff', 21],
    ['#ffffff', '#ffffff', 1],
    ['#777777', '#ffffff', 4.48],   // valeur de reference connue : juste sous AA
    ['#767676', '#ffffff', 4.54],   // premier gris AA sur blanc
  ])('%s sur %s = %f', (a, b, want) => {
    expect(contrastRatio(a, b)).toBeCloseTo(want, 1)
    expect(contrastRatio(b, a)).toBeCloseTo(want, 1)   // symetrique
  })
  it('luminance bornee et hex court', () => {
    expect(luminance('#000')).toBe(0)
    expect(luminance('#fff')).toBeCloseTo(1, 5)
    expect(luminance('nimporte')).toBe(0)
  })
  it('AA : 4,5 pour le texte, 3 pour les indices', () => {
    const bad = { ...neutron, tokens: { ...neutron.tokens, muted: '#3b2d40' } }
    const f = contrastFailures(bad)
    expect(f.map((c) => c.label)).toContain('texte discret sur fond')
    const hints = contrastChecks(neutron).find((c) => c.label === 'indices sur carte')
    expect(hints?.min).toBe(3)
  })
  it('les themes integres passent le texte principal en AA', () => {
    for (const [id, b] of Object.entries(BUILTIN)) {
      const main = contrastChecks(b).filter((c) => c.label.startsWith('texte sur'))
      expect(main.every((c) => c.pass), id).toBe(true)
    }
  })
})

describe('hex et validation', () => {
  it.each([
    ['#ABC', '#aabbcc'], ['#aabbcc', '#aabbcc'], ['#aabbcc80', '#aabbcc80'], [' #fff ', '#ffffff'],
    ['red', null], ['#12', null], ['#12345', null], ['#gggggg', null], [42, null], [undefined, null],
    ['#fff; background:url(x)', null], ['url(javascript:1)', null],
  ])('%p -> %p', (v, want) => expect(normalizeHex(v)).toBe(want))

  it('theme valide, couleurs normalisees', () => {
    const r = validateTheme({ ...mk(), tokens: { ...neutron.tokens, ink: '#000' } })
    expect(r.ok && r.theme.tokens.ink).toBe('#000000')
  })
  it.each([
    [null], ['x'], [{}], [{ name: 'a', dark: 'oui', tokens: neutron.tokens }],
    [{ name: '', dark: true, tokens: neutron.tokens }],
    [{ name: 'a', dark: true, tokens: { ...neutron.tokens, ink: 'rouge' } }],
    [{ name: 'a', dark: true, tokens: { ...neutron.tokens, ink: '#00000080' } }],  // fond translucide interdit
    [{ name: 'a', dark: true, tokens: { ...neutron.tokens, gold: undefined } }],
  ])('theme invalide %#', (raw) => expect(validateTheme(raw).ok).toBe(false))

  it('un jeton translucide est accepte pour les derives', () => {
    expect(validateTheme({ name: 'a', dark: true, tokens: { ...neutron.tokens, glow1: '#11223344' } }).ok).toBe(true)
  })
  it('un id hostile est remplace', () => {
    const r = validateTheme({ ...mk('ok'), id: '"] body{display:none}' })
    expect(r.ok && r.theme.id).toBe('ok')
  })
})

describe('identifiants et liste', () => {
  it.each([
    ['Mon Theme Sombre', [], 'mon-theme-sombre'],
    ['Éte chaud!', [], 'ete-chaud'],
    ['', [], 'theme'],
    ['a', ['a'], 'a-2'],
    ['a', ['a', 'a-2'], 'a-3'],
  ])('slugId(%p, %p) = %p', (name, taken, want) => expect(slugId(name, taken)).toBe(want))

  it('dupliquer, modifier, supprimer sans muter', () => {
    const a = mk('un')
    const b = duplicateTheme(a, [a.id])
    expect(b.id).not.toBe(a.id)
    expect(b.name).toBe('un copie')
    b.tokens.ink = '#111111'
    expect(a.tokens.ink).toBe(neutron.tokens.ink)   // copie profonde des jetons
    const l = upsertTheme([a], b)
    expect(l).toHaveLength(2)
    const edited = { ...a, name: 'renomme' }
    expect(upsertTheme(l, edited)[0].name).toBe('renomme')
    expect(removeTheme(l, a.id)).toEqual([b])
    expect(l).toHaveLength(2)
  })
})

describe('import / export', () => {
  it('aller-retour', () => {
    const l = [mk('un'), mk('deux', ['un'])]
    const r = importThemes(exportThemes(l), [])
    expect(r.errors).toEqual([])
    expect(r.themes).toEqual(l)
  })
  it('id deja pris -> renomme, jamais d\'ecrasement', () => {
    const have = [mk('un')]
    const r = importThemes(JSON.stringify(have[0]), have)
    expect(r.themes[0].id).toBe('un-2')
  })
  it('accepte un theme seul ou un tableau', () => {
    expect(importThemes(JSON.stringify(mk('x')), []).themes).toHaveLength(1)
    expect(importThemes(JSON.stringify([mk('x'), mk('y')]), []).themes).toHaveLength(2)
  })
  it.each([['pas du json'], ['{"themes":[{"name":"a"}]}'], [JSON.stringify('x'.repeat(300_000))]])('refuse %#', (text) => {
    const r = importThemes(text, [])
    expect(r.themes).toEqual([])
    expect(r.errors.length).toBeGreaterThan(0)
  })
  it('un theme valide et un mauvais : garde le bon, signale l\'autre', () => {
    const r = importThemes(JSON.stringify([mk('bon'), { name: 'mauvais' }]), [])
    expect(r.themes).toHaveLength(1)
    expect(r.errors).toHaveLength(1)
  })
})

describe('stockage', () => {
  const kv = (init?: string): KV & { v: string | null } => {
    const s = { v: init ?? null, getItem: () => s.v, setItem: (_k: string, v: string) => { s.v = v } }
    return s
  }
  it('aller-retour', () => {
    const s = kv()
    saveThemes(s, [mk('un')])
    expect(loadThemes(s)).toEqual([mk('un')])
  })
  it.each([[undefined], ['{'], ['{"a":1}'], ['[1,{"name":"x"}]']])('stockage corrompu %p -> liste vide', (init) => {
    expect(loadThemes(kv(init))).toEqual([])
  })
})

describe('css', () => {
  it('definit chaque jeton sous le selecteur data-theme perso', () => {
    const css = themeCss(mk('un'))
    expect(css).toContain(':root[data-theme="perso:un"]{')
    for (const n of TOKEN_NAMES) expect(css).toContain(`--${n}:`)
    expect(css).toContain('color-scheme:dark')
    expect(css).not.toContain('::selection')   // reglages de theme clair seulement
  })
  it('theme clair : memes retouches que dawn/paper/sky', () => {
    const css = themeCss(newTheme('clair', BUILTIN.paper, []))
    expect(css).toContain('color-scheme:light')
    expect(css).toContain('::selection')
    expect(css).toContain('.btn.solid{color:#fff')
  })
  it('perso:<id> aller-retour', () => {
    expect(persoIdOf(persoValue('x'))).toBe('x')
    expect(persoIdOf('sky')).toBeNull()
  })
  it('les translucides suivent l\'accent', () => {
    const t = withDerivedSofts({ ...neutron.tokens, gold: '#112233' }, true)
    expect(t['gold-soft']).toBe('#11223322')
  })
})
