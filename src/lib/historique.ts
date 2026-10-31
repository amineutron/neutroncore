// Historique des sessions Claude Code : journal et cout. Types, filtres memorises et calculs purs.

export type Kind = 'prompt' | 'edit' | 'write' | 'cmd' | 'commit' | 'agent'
export const KINDS: { id: Kind; label: string }[] = [
  { id: 'prompt', label: 'demandes' }, { id: 'edit', label: 'fichiers édités' }, { id: 'write', label: 'fichiers écrits' },
  { id: 'cmd', label: 'commandes' }, { id: 'commit', label: 'commits' }, { id: 'agent', label: 'sous-agents' },
]

export type Etat = {
  indexation: { en_cours: boolean; total: number; faits: number; duree_s: number | null; premiere_indexation_s: number | null; erreur: string }
  sessions: number; projets: string[]; premier_jour: string | null; dernier_jour: string | null
}
export type SessionVue = {
  id: string; title: string; projet: string; cwd: string; debut: number; fin: number; jours: string[]
  fichiers: number; commandes: number; commits: number; prompts: number; sous_agents: number; tokens: number
  correspondances?: number; extraits?: string[]
}
export type Evenement = { at: number; kind: Kind; text: string; agent: boolean }
export type DetailSession = { session: SessionVue; total: number; evenements: Evenement[]; tronque: boolean }

export type Cumul = { entree: number; sortie: number; lecture: number; ecriture: number; cout: number; messages: number }
export type Ligne = Cumul & { cle: string }
export type RapportUsage = {
  devise: string; total: Cumul | Record<string, never>; par_jour: Ligne[]; par_projet: Ligne[]; par_modele: Ligne[]
  par_session: (Cumul & { id: string; titre: string })[]; modeles_sans_regle: string[]; tarif_renseigne: boolean
}
export type Taux = { entree: number; sortie: number; lecture: number; ecriture: number; ecriture_1h: number }
export type Regle = Taux & { motif: string }
export type Tarifs = { devise: string; regles: Regle[]; defaut: Taux }

// --- filtres memorises ---------------------------------------------------------

export type Periode = '7' | '30' | '90' | 'tout'
export type Mode = 'cout' | 'hors_cache' | 'tout'
export type Filtres = {
  onglet: 'journal' | 'cout'; projet: string; jour: string; q: string
  natures: Kind[]; periode: Periode; mode: Mode
}
export const FILTRES_DEFAUT: Filtres = {
  onglet: 'journal', projet: '', jour: '', q: '', natures: KINDS.map((k) => k.id), periode: '30', mode: 'hors_cache',
}
export const CLE_FILTRES = 'neutroncore_historique_filtres'

/** Relit les filtres ; toute valeur inattendue retombe sur le defaut (jamais d'exception). */
export function lireFiltres(raw: string | null): Filtres {
  let o: Partial<Filtres> = {}
  try { o = raw ? (JSON.parse(raw) as Partial<Filtres>) : {} } catch { /* corps illisible */ }
  const d = FILTRES_DEFAUT
  const ids = KINDS.map((k) => k.id)
  const natures = Array.isArray(o.natures) ? o.natures.filter((n): n is Kind => ids.includes(n)) : d.natures
  return {
    onglet: o.onglet === 'cout' ? 'cout' : 'journal',
    projet: typeof o.projet === 'string' ? o.projet.slice(0, 80) : '',
    jour: typeof o.jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.jour) ? o.jour : '',
    q: typeof o.q === 'string' ? o.q.slice(0, 100) : '',
    natures: natures.length ? natures : d.natures,
    periode: (['7', '30', '90', 'tout'] as string[]).includes(o.periode as string) ? (o.periode as Periode) : d.periode,
    mode: (['cout', 'hors_cache', 'tout'] as string[]).includes(o.mode as string) ? (o.mode as Mode) : d.mode,
  }
}

/** Bornes de jours (AAAA-MM-JJ) d'une periode, jusqu'a `aujourdhui` inclus. */
export function bornes(periode: Periode, aujourdhui: Date): { debut: string; fin: string } {
  const fin = jourLocal(aujourdhui)
  if (periode === 'tout') return { debut: '', fin }
  const d = new Date(aujourdhui)
  d.setDate(d.getDate() - (Number(periode) - 1))
  return { debut: jourLocal(d), fin }
}

export function jourLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// --- formats --------------------------------------------------------------------

export function fmtTokens(n: number): string {
  if (n < 1000) return String(Math.round(n))
  if (n < 1e6) return `${(n / 1e3).toFixed(n < 1e4 ? 1 : 0)} k`
  if (n < 1e9) return `${(n / 1e6).toFixed(n < 1e7 ? 2 : 1)} M`
  return `${(n / 1e9).toFixed(2)} Md`
}

export function fmtCout(n: number, devise: string): string {
  const v = n < 10 ? n.toFixed(2) : n.toFixed(n < 1000 ? 1 : 0)
  return `${v} ${devise}`
}

export function fmtHeure(ts: number): string {
  const d = new Date(ts * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fmtJour(j: string): string {
  const [y, m, d] = j.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase()
}

/** Duree de la premiere indexation / progression, en clair. */
export function phraseIndexation(i: Etat['indexation']): string {
  if (i.erreur) return `indexation interrompue : ${i.erreur}`
  if (i.en_cours) return `indexation des transcripts : ${i.faits} / ${i.total}`
  if (i.duree_s !== null) return `index à jour (dernier passage ${i.duree_s} s)`
  return 'indexation en attente'
}

// --- graphique ------------------------------------------------------------------

export type Serie = { cle: string; nom: string; valeurs: number[] }
export type Graphique = { jours: string[]; series: Serie[]; max: number }

/** Complete les jours sans activite entre le premier et le dernier (axe regulier). */
export function remplirJours(lignes: Ligne[]): string[] {
  if (!lignes.length) return []
  const [a, b] = [lignes[0].cle, lignes[lignes.length - 1].cle]
  const out: string[] = []
  const d = new Date(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)))
  for (let i = 0; i < 800 && jourLocal(d) <= b; i++) {
    out.push(jourLocal(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

const DEFS: Record<Mode, { cle: keyof Cumul; nom: string }[]> = {
  cout: [{ cle: 'cout', nom: 'coût estimé' }],
  hors_cache: [{ cle: 'entree', nom: 'entrée' }, { cle: 'sortie', nom: 'sortie' }],
  tout: [{ cle: 'entree', nom: 'entrée' }, { cle: 'sortie', nom: 'sortie' }, { cle: 'lecture', nom: 'cache lu' }, { cle: 'ecriture', nom: 'cache écrit' }],
}

/** Series empilees par jour selon le mode (cout, tokens hors cache, tokens avec cache). */
export function graphique(lignes: Ligne[], mode: Mode): Graphique {
  const jours = remplirJours(lignes)
  const par = new Map(lignes.map((l) => [l.cle, l]))
  const series = DEFS[mode].map((def) => ({
    cle: def.cle, nom: def.nom, valeurs: jours.map((j) => (par.get(j)?.[def.cle] as number | undefined) ?? 0),
  }))
  const max = Math.max(0, ...jours.map((_, i) => series.reduce((s, x) => s + x.valeurs[i], 0)))
  return { jours, series, max }
}

// --- edition du tarif (copies, jamais de mutation) -----------------------------------

export const TAUX_VIDE: Taux = { entree: 0, sortie: 0, lecture: 0, ecriture: 0, ecriture_1h: 0 }

export function ajouterRegle(t: Tarifs, motif = ''): Tarifs {
  return { ...t, regles: [...t.regles, { motif, ...TAUX_VIDE }] }
}
export function modifierRegle(t: Tarifs, i: number, patch: Partial<Regle>): Tarifs {
  return { ...t, regles: t.regles.map((r, k) => (k === i ? { ...r, ...patch } : r)) }
}
export function retirerRegle(t: Tarifs, i: number): Tarifs {
  return { ...t, regles: t.regles.filter((_, k) => k !== i) }
}
export function modifierDefaut(t: Tarifs, patch: Partial<Taux>): Tarifs {
  return { ...t, defaut: { ...t.defaut, ...patch } }
}

/** Texte saisi -> nombre >= 0 (virgule acceptee) ; illisible = 0. */
export function lireTaux(texte: string): number {
  const n = Number(texte.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Un modele qui n'a pas de regle propre : il est facture au tarif par defaut (peut-etre 0). */
export function avertissementTarif(r: RapportUsage): string {
  if (!r.tarif_renseigne) return 'aucun tarif renseigné : le coût reste à 0. Renseigne-le dans « tarif » ci-dessous.'
  if (r.modeles_sans_regle.length) return `sans règle de tarif (tarif par défaut) : ${r.modeles_sans_regle.join(', ')}`
  return ''
}
