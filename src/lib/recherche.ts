// Recherche globale : types de GET /recherche, regroupement, filtres de sources, cible d'un résultat,
// surlignage (logique pure, testée). Le rendu est dans components/GlobalSearch.tsx.
import { fold, rank, type Command } from './palette'

export type SourceId = 'films' | 'sessions' | 'automatisations' | 'projets' | 'notifications' | 'docs'
export type Hit = {
  source: SourceId; id: string; titre: string; detail: string; score: number
  ecran: string; ref: string; niveau: string
}
export type SourceEtat = { n: number; ms: number; etat: 'ok' | 'delai' | 'erreur'; label: string; erreur?: string }
export type Reponse = { q: string; resultats: Hit[]; sources: Record<string, SourceEtat> }
export type Groupe = { source: SourceId; label: string; hits: Hit[] }

export const SOURCES: { id: SourceId; label: string }[] = [
  { id: 'films', label: 'films et séries' },
  { id: 'sessions', label: 'sessions claude' },
  { id: 'automatisations', label: 'automatisations' },
  { id: 'projets', label: 'projets' },
  { id: 'notifications', label: 'notifications' },
  { id: 'docs', label: 'docs claude.md' },
]
const IDS = SOURCES.map((s) => s.id)
export const MIN_Q = 2
export const FILTRES_CLE = 'neutroncore_search_sources'
export const MAX_COMMANDES = 6

/** Regroupe en gardant l'ordre du classement : le groupe du meilleur résultat vient en premier. */
export function grouper(hits: Hit[], sources: Record<string, SourceEtat> = {}): Groupe[] {
  const groupes: Groupe[] = []
  for (const h of hits) {
    let g = groupes.find((x) => x.source === h.source)
    if (!g) {
      g = { source: h.source, label: sources[h.source]?.label ?? SOURCES.find((s) => s.id === h.source)?.label ?? h.source, hits: [] }
      groupes.push(g)
    }
    g.hits.push(h)
  }
  return groupes
}

/** Sources lentes ou en panne, en une phrase chacune (le reste des résultats reste valable). */
export function problemes(sources: Record<string, SourceEtat>): string[] {
  return Object.values(sources).filter((s) => s.etat !== 'ok')
    .map((s) => `${s.label} : ${s.etat === 'delai' ? 'délai dépassé' : (s.erreur ?? 'indisponible')}`)
}

// ---- filtres de sources, retenus entre deux ouvertures ----

export function lireFiltres(raw: string | null): SourceId[] {
  try {
    const v: unknown = JSON.parse(raw ?? 'null')
    const ok = Array.isArray(v) ? IDS.filter((id) => v.includes(id)) : []
    return ok.length > 0 ? ok : [...IDS]
  } catch { return [...IDS] }
}

export function basculerSource(actives: SourceId[], id: SourceId): SourceId[] {
  const next = actives.includes(id) ? actives.filter((x) => x !== id) : IDS.filter((x) => x === id || actives.includes(x))
  return next.length > 0 ? next : actives          // au moins une source reste cochée
}

export const parametreSources = (actives: SourceId[]): string => (actives.length === IDS.length ? '' : `&sources=${actives.join(',')}`)

// ---- ce qui se passe au clic ----

export type Cible =
  | { type: 'ecran'; ecran: string; session?: string }
  | { type: 'notifs' }
  | { type: 'copier'; texte: string }

/** `ecrans` = identifiants d'écran connus de l'application (une valeur inconnue de l'API est ignorée). */
export function cible(h: Hit, ecrans: string[]): Cible {
  if (h.source === 'docs') return { type: 'copier', texte: h.ref }
  if (h.source === 'notifications' && !ecrans.includes(h.ecran)) return { type: 'notifs' }
  if (ecrans.includes(h.ecran)) return { type: 'ecran', ecran: h.ecran, ...(h.source === 'sessions' ? { session: h.ref } : {}) }
  return { type: 'notifs' }
}

/** Identifiants d'écran déduits des commandes de la palette (« go:films » -> films). */
export const ecransDe = (commands: Command[]): string[] => commands.filter((c) => c.id.startsWith('go:')).map((c) => c.id.slice(3))

/** Les commandes de la palette qui correspondent, favoris d'abord (même classement que Ctrl+K). */
export function commandesTrouvees(commands: Command[], q: string, favs: string[], max = MAX_COMMANDES): Command[] {
  return q.trim().length < MIN_Q ? [] : rank(commands, q, favs).slice(0, max)
}

// ---- surlignage ----

export type Morceau = { t: string; hit: boolean }

export function surligner(texte: string, q: string): Morceau[] {
  const mots = fold(q).split(/\s+/).filter(Boolean)
  const pli = fold(texte)
  if (mots.length === 0 || pli.length !== texte.length) return [{ t: texte, hit: false }]
  const marque = new Array<boolean>(texte.length).fill(false)
  for (const m of mots) {
    for (let i = pli.indexOf(m); i >= 0; i = pli.indexOf(m, i + m.length)) marque.fill(true, i, i + m.length)
  }
  const out: Morceau[] = []
  for (let i = 0; i < texte.length; i++) {
    const last = out[out.length - 1]
    if (last && last.hit === marque[i]) last.t += texte[i]
    else out.push({ t: texte[i], hit: marque[i] })
  }
  return out
}

// ---- résultats vus comme des commandes de palette (clavier, Entrée et rendu gratuits) ----

export type Actions = {
  allerA: (ecran: string, session?: string) => void
  ouvrirNotifs: () => void
  copier: (texte: string) => void
}
/** Command + extrait (le champ `detail` rejoint le type Command à l'intégration, voir INTEGRATION.md). */
export type CommandeResultat = Command & { detail: string }

/** Un résultat devient une commande : le libellé est le titre, le groupe le nom de la source. */
export function hitsEnCommandes(hits: Hit[], ecrans: string[], actions: Actions, sources: Record<string, SourceEtat> = {}): CommandeResultat[] {
  return hits.map((h) => {
    const c = cible(h, ecrans)
    return {
      id: `hit:${h.id}`, label: h.titre, group: sources[h.source]?.label ?? SOURCES.find((s) => s.id === h.source)?.label ?? h.source,
      detail: h.detail, nav: c.type !== 'copier',
      run: () => {
        if (c.type === 'ecran') actions.allerA(c.ecran, c.session)
        else if (c.type === 'notifs') actions.ouvrirNotifs()
        else actions.copier(c.texte)
      },
    }
  })
}
