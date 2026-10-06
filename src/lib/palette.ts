// Palette de commandes (Ctrl+K) : classement des commandes selon la saisie et
// favoris. Logique pure ; le rendu est dans components/Palette.tsx et la liste
// des commandes dans lib/commands.tsx.

export type Command = {
  id: string                  // stable : sert de clé de favori (« go:films », « scene:abc »)
  label: string
  group: string               // aller | affichage | maison | lanceur | liens
  keywords?: string           // synonymes cherchables, non affichés
  nav?: boolean               // simple navigation : pas de message « fait »
  run: () => void | Promise<unknown>
}

const FAVS_STORAGE = 'neutroncore_palette_favs'

// minuscules sans accents : « télé » se trouve en tapant « tele »
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// lettres du mot présentes dans l'ordre (« flm » trouve « films »)
function subsequence(needle: string, hay: string): boolean {
  let i = 0
  for (const c of hay) if (c === needle[i]) i++
  return i === needle.length
}

/** 0 = ne correspond pas. Tous les mots saisis doivent correspondre. */
export function score(query: string, cmd: Pick<Command, 'label' | 'group' | 'keywords'>): number {
  const label = fold(cmd.label)
  const rest = fold(`${cmd.group} ${cmd.keywords ?? ''}`)
  let total = 0
  for (const word of fold(query).split(/\s+/).filter(Boolean)) {
    const words = label.split(/[\s:·/&-]+/)
    let s = 0
    if (words.includes(word)) s = 110          // mot entier : « tele » vise « mode télé » avant « téléchargements »
    else if (label.startsWith(word)) s = 100
    else if (words.some((w) => w.startsWith(word))) s = 80
    else if (label.includes(word)) s = 60
    else if (rest.includes(word)) s = 40
    // approximatif : dans UN mot du libellé, pas à cheval sur toute la phrase
    else if (word.length >= 2 && words.some((w) => subsequence(word, w))) s = 20
    if (s === 0) return 0
    total += s
  }
  return total
}

/** Saisie vide : favoris d'abord (dans l'ordre choisi), puis l'ordre déclaré. */
export function rank(commands: Command[], query: string, favs: string[]): Command[] {
  if (!query.trim()) {
    const byId = new Map(commands.map((c) => [c.id, c]))
    const first = favs.map((id) => byId.get(id)).filter((c): c is Command => Boolean(c))
    return [...first, ...commands.filter((c) => !favs.includes(c.id))]
  }
  return commands
    .map((c, i) => ({ c, i, s: score(query, c) + (favs.includes(c.id) ? 15 : 0) }))
    .filter((x) => x.s > (favs.includes(x.c.id) ? 15 : 0))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c)
}

export function toggleFav(favs: string[], id: string): string[] {
  return favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]
}

// ---- store des favoris (partagé entre la palette et l'accueil) ----
let favs: string[] | null = null
const subs = new Set<() => void>()

export function getFavs(): string[] {
  if (favs === null) {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(FAVS_STORAGE) ?? '[]')
      favs = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
    } catch { favs = [] }
  }
  return favs
}

export function setFavs(next: string[]): void {
  favs = next
  try { localStorage.setItem(FAVS_STORAGE, JSON.stringify(next)) } catch { /* stockage indisponible : favoris de session */ }
  subs.forEach((f) => f())
}

export function subscribeFavs(fn: () => void): () => void {
  subs.add(fn)
  return () => { subs.delete(fn) }
}
