// Themes personnalises : modele, contraste WCAG, import/export, CSS injecte.
// Logique pure (le seul acces DOM est installPersoStyles, isole en bas de fichier).
// Les tokens sont ceux de :root dans styles.css ; un theme perso les redefinit
// sous :root[data-theme="perso:<id>"] par une feuille <style> injectee.

export const PERSO_PREFIX = 'perso:'
export const STORAGE_KEY = 'neutroncore_perso_themes' // guard:allow cle localStorage
export const MAX_THEMES = 30

// Tokens de styles.css (:root + redefinitions des 6 themes integres), par groupe.
export type TokenName =
  | 'ink' | 'surface' | 'surface2' | 'raise' | 'line' | 'line2' | 'text' | 'muted' | 'faint'
  | 'gold' | 'rose' | 'ok' | 'warn' | 'crit' | 'off' | 'gold-soft' | 'rose-soft' | 'glow1' | 'glow2'

export const TOKEN_GROUPS: { label: string; tokens: { name: TokenName; label: string }[] }[] = [
  { label: 'fonds', tokens: [
    { name: 'ink', label: 'fond de page' }, { name: 'surface', label: 'cartes' },
    { name: 'surface2', label: 'cartes en relief' }, { name: 'raise', label: 'survol' }] },
  { label: 'traits', tokens: [{ name: 'line', label: 'bordure' }, { name: 'line2', label: 'bordure forte' }] },
  { label: 'texte', tokens: [
    { name: 'text', label: 'texte' }, { name: 'muted', label: 'texte discret' }, { name: 'faint', label: 'indices' }] },
  { label: 'accents', tokens: [{ name: 'gold', label: 'accent principal' }, { name: 'rose', label: 'accent second' }] },
  { label: 'etats', tokens: [
    { name: 'ok', label: 'ok' }, { name: 'warn', label: 'attention' }, { name: 'crit', label: 'critique' }, { name: 'off', label: 'eteint' }] },
  { label: 'avance (derives)', tokens: [
    { name: 'gold-soft', label: 'accent translucide' }, { name: 'rose-soft', label: 'accent 2 translucide' },
    { name: 'glow1', label: 'halo haut droit' }, { name: 'glow2', label: 'halo bas gauche' }] },
]
export const TOKEN_NAMES: TokenName[] = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.name))
// jetons qui acceptent un canal alpha (#rrggbbaa) ; les autres sont opaques
export const ALPHA_TOKENS: ReadonlySet<TokenName> = new Set(['gold-soft', 'rose-soft', 'glow1', 'glow2'])

export type Tokens = Record<TokenName, string>
export type CustomTheme = { id: string; name: string; dark: boolean; tokens: Tokens }

// ---------- themes integres (copie de styles.css, pour « dupliquer ») ----------
const NEUTRON: Tokens = {
  ink: '#0e0a10', surface: '#171019', surface2: '#1f1622', raise: '#251a29', line: '#2e2331', line2: '#3b2d40',
  text: '#ece5ee', muted: '#9c8ea6', faint: '#6b5f75', gold: '#f6c177', rose: '#eb6f92',
  ok: '#82d69c', warn: '#f0b45e', crit: '#ff5c74', off: '#5c5262',
  'gold-soft': '#f6c17726', 'rose-soft': '#eb6f9222', glow1: '#231a2666', glow2: '#1c101b55',
}
export type BuiltinId = 'neutron' | 'ironman' | 'matrix' | 'midnight' | 'dawn' | 'paper' | 'sky'
export const BUILTIN: Record<BuiltinId, { label: string; dark: boolean; tokens: Tokens }> = {
  neutron: { label: 'neutron', dark: true, tokens: NEUTRON },
  ironman: { label: 'iron man', dark: true, tokens: { ...NEUTRON, ink: '#0d0d0d', surface: '#181414', surface2: '#201818', raise: '#281c1c', line: '#2e2424', line2: '#403030', gold: '#e04a4a', 'gold-soft': '#e04a4a26', rose: '#f0a35c', 'rose-soft': '#f0a35c22', glow1: '#3a1a1a66', glow2: '#2a141455' } },
  matrix: { label: 'matrix', dark: true, tokens: { ...NEUTRON, ink: '#050a06', surface: '#0b140d', surface2: '#101c13', raise: '#142418', line: '#1c2b1f', line2: '#2a4030', text: '#d4e8d6', muted: '#8fae94', faint: '#5f7a64', gold: '#4ade80', 'gold-soft': '#4ade8022', rose: '#a3e635', 'rose-soft': '#a3e63522', glow1: '#0f2a1566', glow2: '#0a1f1055' } },
  midnight: { label: 'midnight', dark: true, tokens: { ...NEUTRON, ink: '#070b16', surface: '#0e1424', surface2: '#131b30', raise: '#18223c', line: '#1d2740', line2: '#2c3a5c', text: '#e4e9f5', muted: '#94a0bd', faint: '#5f6b8a', gold: '#6ea8fe', 'gold-soft': '#6ea8fe22', rose: '#9d7bf5', 'rose-soft': '#9d7bf522', glow1: '#14204066', glow2: '#100e3055' } },
  dawn: { label: 'dawn', dark: false, tokens: { ...NEUTRON, ink: '#faf4ed', surface: '#fffaf3', surface2: '#f4ede4', raise: '#efe6da', line: '#dfd4c8', line2: '#c9bcae', text: '#575279', muted: '#797593', faint: '#9893a5', gold: '#c8851f', 'gold-soft': '#c8851f1e', rose: '#d4567e', 'rose-soft': '#d4567e1a', ok: '#35845e', warn: '#c07b16', crit: '#c93b5b', off: '#b5aeb0', glow1: '#f2e2c866', glow2: '#f0d9e055' } },
  paper: { label: 'paper', dark: false, tokens: { ...NEUTRON, ink: '#f6f6f4', surface: '#ffffff', surface2: '#f0efec', raise: '#eae8e3', line: '#e2e0da', line2: '#c9c6be', text: '#2b2a28', muted: '#6f6c66', faint: '#a09c94', gold: '#a06a10', 'gold-soft': '#a06a101a', rose: '#c04a70', 'rose-soft': '#c04a701a', ok: '#2f7d52', warn: '#a5690e', crit: '#bd3452', off: '#b8b5ae', glow1: '#e8e4da88', glow2: '#e2dcd455' } },
  sky: { label: 'sky', dark: false, tokens: { ...NEUTRON, ink: '#eef4fa', surface: '#ffffff', surface2: '#e9f0f8', raise: '#dfe9f4', line: '#d4e0ec', line2: '#b4c6da', text: '#1f3347', muted: '#57708a', faint: '#8aa0b6', gold: '#1f6fc0', 'gold-soft': '#1f6fc01a', rose: '#7c5cd6', 'rose-soft': '#7c5cd61a', ok: '#25805a', warn: '#a06a10', crit: '#c33b5e', off: '#a8b8c6', glow1: '#d4e4f488', glow2: '#dcd8f055' } },
}

// ---------- couleurs ----------
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

// '#abc' -> '#aabbcc' ; renvoie null si invalide
export function normalizeHex(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!HEX.test(s)) return null
  const h = s.slice(1).toLowerCase()
  return '#' + (h.length === 3 ? h.split('').map((c) => c + c).join('') : h)
}

export function parseRgb(hex: string): [number, number, number] | null {
  const n = normalizeHex(hex)
  if (!n) return null
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)]
}

// luminance relative WCAG 2.x
export function luminance(hex: string): number {
  const rgb = parseRgb(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export const AA_TEXT = 4.5
export const AA_LARGE = 3

export type ContrastCheck = { fg: string; bg: string; label: string; min: number; ratio: number; pass: boolean }

// Couples verifies : texte courant en AA (4.5), indices et elements d'interface en 3.
// Le texte du bouton plein est celui de styles.css : sombre sur theme sombre, blanc sur clair.
export function contrastChecks(t: { dark: boolean; tokens: Tokens }): ContrastCheck[] {
  const k = t.tokens
  const pairs: [string, string, string, number][] = [
    ['texte sur fond de page', k.text, k.ink, AA_TEXT],
    ['texte sur carte', k.text, k.surface, AA_TEXT],
    ['texte sur carte en relief', k.text, k.surface2, AA_TEXT],
    ['texte discret sur fond', k.muted, k.ink, AA_TEXT],
    ['texte discret sur carte', k.muted, k.surface, AA_TEXT],
    ['indices sur carte', k.faint, k.surface, AA_LARGE],
    ['accent sur fond', k.gold, k.ink, AA_TEXT],
    ['accent sur carte', k.gold, k.surface, AA_TEXT],
    ['accent second sur carte', k.rose, k.surface, AA_TEXT],
    ['ok sur carte', k.ok, k.surface, AA_TEXT],
    ['attention sur carte', k.warn, k.surface, AA_TEXT],
    ['critique sur carte', k.crit, k.surface, AA_TEXT],
    ['bouton plein', t.dark ? '#241505' : '#ffffff', k.gold, AA_TEXT],
  ]
  return pairs.map(([label, fg, bg, min]) => {
    const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100
    return { label, fg, bg, min, ratio, pass: ratio >= min }
  })
}
export const contrastFailures = (t: { dark: boolean; tokens: Tokens }) => contrastChecks(t).filter((c) => !c.pass)

// Les jetons translucides suivent l'accent tant qu'on ne les regle pas a la main.
export function withDerivedSofts(tokens: Tokens, dark: boolean): Tokens {
  const a = dark ? '22' : '1a'
  return { ...tokens, 'gold-soft': tokens.gold.slice(0, 7) + a, 'rose-soft': tokens.rose.slice(0, 7) + a }
}

// ---------- modele et validation ----------
export type ValidationResult = { ok: true; theme: CustomTheme } | { ok: false; errors: string[] }

export function slugId(name: string, taken: Iterable<string> = []): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'theme'
  const used = new Set(taken)
  let id = base
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`
  return id
}

export function validateTheme(raw: unknown): ValidationResult {
  const errors: string[] = []
  const r = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null
  if (!r) return { ok: false, errors: ['le theme n\'est pas un objet'] }
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 32) : ''
  if (!name) errors.push('nom manquant')
  if (typeof r.dark !== 'boolean') errors.push('« dark » doit etre vrai ou faux')
  const src = (r.tokens && typeof r.tokens === 'object' ? r.tokens : {}) as Record<string, unknown>
  const tokens = {} as Tokens
  for (const n of TOKEN_NAMES) {
    const h = normalizeHex(src[n])
    if (!h) errors.push(`couleur invalide ou manquante : ${n}`)
    else if (h.length === 9 && !ALPHA_TOKENS.has(n)) errors.push(`${n} ne peut pas etre translucide`)
    else tokens[n] = h
  }
  if (errors.length) return { ok: false, errors }
  const id = typeof r.id === 'string' && /^[a-z0-9-]{1,32}$/.test(r.id) ? r.id : slugId(name)
  return { ok: true, theme: { id, name, dark: r.dark as boolean, tokens } }
}

export function newTheme(name: string, base: { dark: boolean; tokens: Tokens }, taken: Iterable<string>): CustomTheme {
  return { id: slugId(name, taken), name: name.trim().slice(0, 32) || 'sans nom', dark: base.dark, tokens: { ...base.tokens } }
}
export const duplicateTheme = (t: CustomTheme, taken: Iterable<string>): CustomTheme =>
  newTheme(`${t.name} copie`, t, taken)

export function upsertTheme(list: CustomTheme[], t: CustomTheme): CustomTheme[] {
  return list.some((x) => x.id === t.id) ? list.map((x) => (x.id === t.id ? t : x)) : [...list, t]
}
export const removeTheme = (list: CustomTheme[], id: string): CustomTheme[] => list.filter((t) => t.id !== id)

// ---------- import / export JSON ----------
export const EXPORT_FORMAT = 'neutroncore-themes'
export const MAX_IMPORT_CHARS = 200_000

export function exportThemes(list: CustomTheme[]): string {
  return JSON.stringify({ format: EXPORT_FORMAT, version: 1, themes: list }, null, 2)
}

// Accepte un theme seul, un tableau ou un lot exporte. Un id deja pris est renomme.
export function importThemes(text: string, existing: CustomTheme[]): { themes: CustomTheme[]; errors: string[] } {
  if (text.length > MAX_IMPORT_CHARS) return { themes: [], errors: ['fichier trop gros'] }
  let data: unknown
  try { data = JSON.parse(text) } catch { return { themes: [], errors: ['JSON illisible'] } }
  const d = data as { themes?: unknown }
  const items: unknown[] = Array.isArray(data) ? data : Array.isArray(d?.themes) ? d.themes : [data]
  const taken = new Set(existing.map((t) => t.id))
  const themes: CustomTheme[] = []
  const errors: string[] = []
  items.forEach((it, i) => {
    const v = validateTheme(it)
    if (!v.ok) { errors.push(`theme ${i + 1} : ${v.errors.join(', ')}`); return }
    if (existing.length + themes.length >= MAX_THEMES) { errors.push(`limite de ${MAX_THEMES} themes atteinte`); return }
    const id = taken.has(v.theme.id) ? slugId(v.theme.name, taken) : v.theme.id
    taken.add(id)
    themes.push({ ...v.theme, id })
  })
  return { themes, errors }
}

// ---------- stockage (injecte pour les tests) ----------
export type KV = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

export function loadThemes(kv: KV): CustomTheme[] {
  try {
    const raw = JSON.parse(kv.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.flatMap((x) => { const v = validateTheme(x); return v.ok ? [v.theme] : [] }).slice(0, MAX_THEMES)
  } catch { return [] }
}
export function saveThemes(kv: KV, list: CustomTheme[]): void {
  kv.setItem(STORAGE_KEY, JSON.stringify(list))
}

// ---------- CSS ----------
export const persoValue = (id: string): string => PERSO_PREFIX + id
export const persoIdOf = (themeSetting: string): string | null =>
  themeSetting.startsWith(PERSO_PREFIX) ? themeSetting.slice(PERSO_PREFIX.length) : null

// Les valeurs sont deja validees comme hex et l'id comme [a-z0-9-] : rien d'autre ne
// peut entrer dans la feuille (pas d'injection CSS).
export function themeCss(t: CustomTheme): string {
  const sel = `:root[data-theme="${persoValue(t.id)}"]`
  const vars = TOKEN_NAMES.map((n) => `--${n}:${t.tokens[n]}`).join(';')
  const extra = [
    `${sel}{${vars};color-scheme:${t.dark ? 'dark' : 'light'}}`,
    `${sel} .lyra-panel{background:var(--${t.dark ? 'surface' : 'surface2'})}`,
  ]
  if (!t.dark) {
    extra.push(
      `${sel} ::selection{background:var(--gold);color:#fff}`,
      `${sel} .topbar{background:color-mix(in srgb,var(--ink) 88%,transparent)}`,
      `${sel} .btn.solid{color:#fff;background:linear-gradient(100deg,var(--gold),var(--rose))}`,
      `${sel} .msg.me{background:var(--gold-soft);border-color:var(--line2)}`,
    )
  }
  return extra.join('\n')
}
export const allThemesCss = (list: CustomTheme[]): string => list.map(themeCss).join('\n')

// Variables en ligne pour l'apercu (un conteneur qui porte les tokens sans toucher a la page).
export const previewStyle = (t: { tokens: Tokens }): Record<string, string> =>
  Object.fromEntries(TOKEN_NAMES.map((n) => [`--${n}`, t.tokens[n]]))

// ---------- DOM (seule partie non pure) ----------
const STYLE_ID = 'nc-perso-themes'
export function installPersoStyles(list: CustomTheme[] = loadThemes(localStorage)): void {
  if (typeof document === 'undefined') return
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) { el = document.createElement('style'); el.id = STYLE_ID; document.head.appendChild(el) }
  el.textContent = allThemesCss(list)
}
