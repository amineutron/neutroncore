// Bibliotheque d'images : recherche reactive (a chaque lettre), filtres, groupes par
// distribution, surbrillance. Pur et teste (vmLibrary.test.ts). Le catalogue vient de
// GET /vms-console/library ; la recherche se fait cote client, instantanement.

export type Fmt = 'iso' | 'cloud' | 'vb'
export type Ui = 'aucune' | 'GNOME' | 'KDE Plasma' | 'Xfce' | 'Sway'
export type LibEntry = {
  id: string; dist: string; nom: string; ver: string; fmt: Fmt; mb: number; ram: number; disk: number
  tags: string[]; ui: Ui; pk: string; os: string; src: string; desc: string; pour: string
  cached: boolean; deployable: boolean; reason: string
}

export const FMT_LABEL: Record<Fmt, string> = { iso: 'ISO d\'installation', cloud: 'image prête (qcow2)', vb: 'image virt-builder' }
export const FMT_TIME: Record<Fmt, string> = { iso: '10 à 15 min', cloud: '30 s', vb: '1 min' }
export const FILTERS = ['tout', 'léger', 'sans interface', 'avec interface', 'images prêtes', 'virt-builder', 'iso', 'serveur', 'bureau'] as const
export type LibFilter = typeof FILTERS[number]

/** Minuscules sans accents, pour comparer « leger » a « léger ». */
export const normalize = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const hayCache = new WeakMap<LibEntry, string>()
function hay(e: LibEntry): string {
  let h = hayCache.get(e)
  if (h === undefined) {
    h = normalize([e.nom, e.ver, e.tags.join(' '), e.ui === 'aucune' ? 'sans interface' : `avec interface ${e.ui}`, e.pk, e.desc, e.pour, e.src, FMT_LABEL[e.fmt]].join(' '))
    hayCache.set(e, h)
  }
  return h
}

/** Mots de la requete (normalises) ; une requete vide ne filtre rien. */
export const terms = (q: string): string[] => normalize(q).split(/\s+/).filter(Boolean)

export function matchesQuery(e: LibEntry, q: string): boolean {
  const t = terms(q)
  if (!t.length) return true
  const h = hay(e)
  return t.every((k) => h.includes(k))
}

export function matchesFilter(e: LibEntry, f: LibFilter): boolean {
  switch (f) {
    case 'tout': return true
    case 'sans interface': return e.ui === 'aucune'
    case 'avec interface': return e.ui !== 'aucune'
    case 'images prêtes': return e.fmt === 'cloud'
    case 'virt-builder': return e.fmt === 'vb'
    case 'iso': return e.fmt === 'iso'
    default: return e.tags.includes(f)
  }
}

export type Group = { dist: string; vars: LibEntry[] }

/** Distributions (ordre du catalogue) avec leurs editions qui passent filtre ET recherche. */
export function search(entries: LibEntry[], q: string, f: LibFilter): Group[] {
  const order: string[] = []
  const by = new Map<string, LibEntry[]>()
  for (const e of entries) {
    if (!by.has(e.dist)) { by.set(e.dist, []); order.push(e.dist) }
    if (matchesFilter(e, f) && matchesQuery(e, q)) by.get(e.dist)?.push(e)
  }
  return order.map((dist) => ({ dist, vars: by.get(dist) ?? [] })).filter((g) => g.vars.length > 0)
}

/** Edition affichee d'un groupe : celle choisie si elle correspond encore, sinon la premiere. */
export function selected(g: Group, choice: string | undefined): LibEntry {
  return g.vars.find((v) => v.id === choice) ?? g.vars[0]
}

export type Seg = { text: string; hit: boolean }

/** Decoupe un texte en segments, ceux qui contiennent un mot de la requete etant marques (sans accents ni casse). */
export function highlight(text: string, q: string): Seg[] {
  const t = terms(q)
  if (!t.length || !text) return [{ text, hit: false }]
  const n = normalize(text)
  const mark = new Array<boolean>(text.length).fill(false)
  for (const k of t) {
    let i = n.indexOf(k)
    while (i >= 0) {
      for (let j = i; j < i + k.length; j++) mark[j] = true
      i = n.indexOf(k, i + k.length)
    }
  }
  const out: Seg[] = []
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1]
    if (last && last.hit === mark[i]) last.text += text[i]
    else out.push({ text: text[i], hit: mark[i] })
  }
  return out
}

export const sizeText = (mb: number): string => (mb >= 1000 ? `${(Math.round(mb / 100) / 10).toLocaleString('fr-FR')} Go` : `${mb} Mo`)

/** Interface graphique ? Conditionne barre, raccourcis et lanceur de « mon environnement ». */
export const hasUi = (e: Pick<LibEntry, 'ui'>): boolean => e.ui !== 'aucune'
