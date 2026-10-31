// Qualité : santé des tests (historique, tendance, instables, bench) et dette technique (logique pure).

export type Tone = 'ok' | 'warn' | 'crit' | ''

export type Tendance = { etat: 'plus_lent' | 'plus_rapide' | 'stable' | 'insuffisant'; variation_pct: number; mediane: number; derniere: number; points: number[] }
export type RunSante = {
  id: string; suite: string; label: string; source: string; started: number; duree: number; ok: boolean; rc: number | null
  commit: string; dirty: boolean; passed: number; failed: number; errors: number; skipped: number; resume: string; echecs: string[]
}
export type LigneSuite = {
  suite: string; label: string; runs: number; taux_reussite: number; instable: boolean; echecs_en_cours: string[]
  tendance: Tendance; dernier: Pick<RunSante, 'id' | 'started' | 'duree' | 'ok' | 'commit' | 'dirty' | 'passed' | 'failed' | 'errors' | 'skipped' | 'resume'>
}
export type ReglagesSante = { fenetre: number; seuil_tendance: number; seuil_bench: number; ignorer_dirty: boolean }
export type VueSante = { suites: LigneSuite[]; reglages: ReglagesSante; total_runs: number }
export type TestInstable = { test: string; echecs: number; runs: number; bascules: number; meme_commit: boolean; dernier_echec: number }
export type CommitConnu = { commit: string; runs: number; ok: number; dernier: number; sale: boolean }
export type DetailSuite = {
  suite: string; label: string; runs: RunSante[]; tendance: Tendance
  instabilite: { instable: boolean; bascules: number; meme_commit: string[]; taux_reussite: number; runs: number }
  instables: TestInstable[]; commits: CommitConnu[]
}
export type Comparaison = {
  suite: string; resultat: 'regression' | 'corrige' | 'identique'
  a: Pick<RunSante, 'id' | 'started' | 'duree' | 'ok' | 'commit' | 'dirty'>; b: Pick<RunSante, 'id' | 'started' | 'duree' | 'ok' | 'commit' | 'dirty'>
  duree: { a: number; b: number; ecart_s: number; variation_pct: number; verdict: 'plus_lent' | 'plus_rapide' | 'equivalent' }
  comptes: Record<'passed' | 'failed' | 'errors' | 'skipped', { a: number; b: number; ecart: number }>
  nouveaux_echecs: string[]; corriges: string[]; toujours_en_echec: string[]
  commits?: { a: { commit: string; runs: number; ok: number; duree_mediane: number }; b: { commit: string; runs: number; ok: number; duree_mediane: number } }
}

export type Marqueur = 'TODO' | 'FIXME' | 'HACK' | 'XXX' | 'DETTE'
export type ElementDette = {
  id: string; depot: string; fichier: string; ligne: number; marqueur: Marqueur; source: 'code' | 'claude'; texte: string
  age_jours: number | null; score: number; niveau: 'haute' | 'moyenne' | 'basse'; raisons: string[]; ignore: boolean
}
export type ReleveDette = {
  elements: ElementDette[]; depots: { depot: string; nb: number; erreur?: string }[]; releve_le: string
  resume: { total: number; ignores: number; par_marqueur: Record<string, number>; par_niveau: Record<string, number>; par_depot: Record<string, number>; plus_ancien_jours: number | null; illisibles: number }
  reglages: { marqueurs: string[]; claude_md: boolean; depots: string[] | null; ignores: string[]; depots_effectifs: string[] }
}

// ---- mise en forme ----

export function fmtDuree(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '?'
  if (s < 10) return `${s.toFixed(1).replace('.', ',')} s`
  const total = Math.round(s)
  if (total < 60) return `${total} s`
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`
}

export function ageTexte(jours: number | null): string {
  if (jours === null) return 'âge inconnu'
  if (jours < 1) return 'récent'
  if (jours < 60) return `${jours} j`
  if (jours < 730) return `${Math.round(jours / 30)} mois`
  return `${Math.round(jours / 365)} ans`
}

export function etiquetteTendance(t: Tendance): { texte: string; tone: Tone } {
  if (t.etat === 'insuffisant') return { texte: 'pas assez de runs', tone: '' }
  const v = `${t.variation_pct > 0 ? '+' : ''}${Math.round(t.variation_pct)} %`
  if (t.etat === 'plus_lent') return { texte: `plus lent ${v}`, tone: 'warn' }
  if (t.etat === 'plus_rapide') return { texte: `plus rapide ${v}`, tone: 'ok' }
  return { texte: 'durée stable', tone: '' }
}

/** Points « x,y » d'une courbe dans un cadre w x h (une valeur seule donne un trait plat). */
export function pointsCourbe(valeurs: number[], w: number, h: number, marge = 2): string {
  if (valeurs.length === 0) return ''
  const min = Math.min(...valeurs)
  const max = Math.max(...valeurs)
  const pas = valeurs.length > 1 ? (w - 2 * marge) / (valeurs.length - 1) : 0
  return valeurs
    .map((v, i) => {
      const y = max === min ? h / 2 : h - marge - ((v - min) / (max - min)) * (h - 2 * marge)
      return `${(marge + i * pas).toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function commitCourt(c: string): string {
  return c ? c.slice(0, 7) : 'commit inconnu'
}

/** Phrase de synthèse d'un bench. */
export function phraseBench(c: Comparaison): string {
  const d = c.duree
  const duree =
    d.verdict === 'equivalent' ? `durée équivalente (${fmtDuree(d.a)} contre ${fmtDuree(d.b)})`
      : `${d.verdict === 'plus_lent' ? 'plus lent' : 'plus rapide'} de ${fmtDuree(Math.abs(d.ecart_s))} (${d.variation_pct > 0 ? '+' : ''}${d.variation_pct} %)`
  const res = c.resultat === 'regression' ? 'régression : la batterie passait, elle échoue'
    : c.resultat === 'corrige' ? 'corrigé : la batterie échouait, elle passe' : 'même résultat global'
  const nb = c.nouveaux_echecs.length
  return `${res} ; ${duree}${nb ? ` ; ${nb} nouve${nb > 1 ? 'aux' : 'l'} échec${nb > 1 ? 's' : ''}` : ''}.`
}

// ---- dette ----

export type FiltreDette = { niveaux: string[]; marqueurs: string[]; depot: string; recherche: string; ignores: boolean }
export const FILTRE_DETTE_DEFAUT: FiltreDette = { niveaux: [], marqueurs: [], depot: '', recherche: '', ignores: false }

/** Filtre sans modifier la liste d'origine. Un filtre vide ne retient rien de côté ; `ignores` montre les éléments mis de côté. */
export function filtrerDette(elements: ElementDette[], f: FiltreDette): ElementDette[] {
  const q = f.recherche.trim().toLowerCase()
  return elements.filter((e) =>
    e.ignore === f.ignores &&
    (f.niveaux.length === 0 || f.niveaux.includes(e.niveau)) &&
    (f.marqueurs.length === 0 || f.marqueurs.includes(e.marqueur)) &&
    (!f.depot || e.depot === f.depot) &&
    (!q || `${e.texte} ${e.fichier} ${e.depot}`.toLowerCase().includes(q)),
  )
}

export type GroupeFichier = { cle: string; depot: string; fichier: string; elements: ElementDette[]; score: number }

/** Regroupe par fichier ; les fichiers les plus chargés d'abord (somme des scores). */
export function grouperParFichier(elements: ElementDette[]): GroupeFichier[] {
  const par = new Map<string, GroupeFichier>()
  for (const e of elements) {
    const cle = `${e.depot}/${e.fichier}`
    const g = par.get(cle) ?? { cle, depot: e.depot, fichier: e.fichier, elements: [], score: 0 }
    par.set(cle, { ...g, elements: [...g.elements, e], score: g.score + e.score })
  }
  return [...par.values()].sort((a, b) => b.score - a.score || a.cle.localeCompare(b.cle))
}

export function basculer(liste: string[], valeur: string): string[] {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur]
}

export function toneNiveau(n: ElementDette['niveau']): Tone {
  return n === 'haute' ? 'crit' : n === 'moyenne' ? 'warn' : ''
}

// ---- préférences (localStorage, jamais bloquant) ----

export function lirePref<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle)
    if (brut === null) return defaut
    const lu: unknown = JSON.parse(brut)
    const objet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
    if (objet(defaut)) return (objet(lu) ? { ...defaut, ...lu } : defaut) as T      // les clés ajoutées plus tard gardent leur défaut
    return typeof lu === typeof defaut && Array.isArray(lu) === Array.isArray(defaut) ? (lu as T) : defaut
  } catch {
    return defaut
  }
}

export function ecrirePref(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur))
  } catch {
    /* stockage indisponible : la préférence ne survit pas, rien d'autre */
  }
}
