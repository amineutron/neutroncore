// CI/PR et dépendances/vulnérabilités : types de l'API et logique pure (filtres, tris, phrases).

export type Gravite = 'critique' | 'haute' | 'moyenne' | 'inconnue' | 'basse' | 'info'
export const GRAVITES: Gravite[] = ['critique', 'haute', 'moyenne', 'inconnue', 'basse', 'info']
export const TON_GRAVITE: Record<Gravite, 'crit' | 'warn' | 'rose' | ''> = { critique: 'crit', haute: 'crit', moyenne: 'warn', inconnue: 'rose', basse: '', info: '' }
export type EtatRun = 'ok' | 'echec' | 'en_cours' | 'annule' | 'neutre'

export type Pr = {
  numero: number; titre: string; branche: string; url: string; brouillon: boolean; conflit: boolean; maj: string
  auteur: string; revue: string; controles: 'ok' | 'echec' | 'attente' | 'aucun'; dependabot: boolean; ecosysteme: string
}
export type Run = { id: number; workflow: string; titre: string; branche: string; evenement: string; etat: EtatRun; url: string; le: string; duree_s: number | null }
export type Workflow = { workflow: string; dernier: Run; serie: EtatRun[]; taux_ok: number | null; duree_moy_s: number | null; echecs_ailleurs: number }
export type Alerte = { paquet: string; ecosysteme: string; gravite: Gravite; resume: string; corrige_en: string; url: string }
export type DepotCi = {
  depot: string; github: string; principale?: string; erreur?: string
  prs: Pr[] | null; dependabot: Pr[]; workflows?: Workflow[] | null; runs_recents?: Run[]
  alertes: { total: number; par_gravite: Partial<Record<Gravite, number>>; alertes: Alerte[] } | null
}
export type ResumeCi = {
  depots: number; prs: number; prs_controles_en_echec: number; prs_en_conflit: number; dependabot_prs: number
  builds_en_echec: number; builds_en_cours: number; alertes: number; alertes_graves: number; illisibles: number
}
export type ReleveCi = { depots: DepotCi[]; resume: ResumeCi; releve_le: string; duree_s?: number; erreur?: string; tentative_le?: string }

export type Correctif = { disponible: boolean; version: string; majeur: boolean; via: string }
export type Vuln = {
  paquet: string; gravite: Gravite; direct: boolean; titres: string[]; via: string[]; intervalle: string
  correctif: Correctif; url: string; version?: string; identifiant?: string
}
export type Audit = { erreur: string; vulns: Vuln[]; par_gravite: Partial<Record<Gravite, number>>; total?: number; absent?: boolean }
export type ProjetDeps = { projet: string; npm: Audit | null; pip: Audit | null }
export type ReleveDeps = {
  projets: ProjetDeps[]; decouverts: string[]; releve_le: string; duree_s?: number; erreur?: string; tentative_le?: string
  resume: { projets: number; vulns: number; par_gravite: Partial<Record<Gravite, number>>; avec_correctif: number; sans_correctif: number
    projets_touches: number; illisibles: number; pip_audit_absent: boolean }
}
export type EtatCiDeps = {
  ci: ReleveCi | null; deps: ReleveDeps | null; en_cours: Partial<Record<'ci' | 'deps', number>>
  reglages: { exclus: string[]; depots_ci: string[] }
}

// ---- CI ----

export type FiltresCi = { seulementProblemes: boolean; sansBrouillons: boolean; dependabotSeul: boolean; masquerSains: boolean }
export const FILTRES_CI: FiltresCi = { seulementProblemes: false, sansBrouillons: false, dependabotSeul: false, masquerSains: false }

/** Une PR demande-t-elle de l'attention ? (contrôles en échec, conflit, ou approuvée et prête) */
export function prAttention(p: Pr): 'crit' | 'warn' | 'ok' | '' {
  if (p.controles === 'echec' || p.conflit) return 'crit'
  if (p.controles === 'attente' || p.revue === 'changes_requested') return 'warn'
  if (p.controles === 'ok' && !p.brouillon && (p.revue === 'approved' || p.dependabot)) return 'ok'
  return ''
}

export function filtrerPrs(prs: Pr[], f: FiltresCi): Pr[] {
  return prs.filter((p) => (!f.sansBrouillons || !p.brouillon) && (!f.dependabotSeul || p.dependabot) && (!f.seulementProblemes || prAttention(p) === 'crit' || prAttention(p) === 'warn'))
}

/** Un dépôt est « sain » : rien en échec, rien en conflit, aucune alerte, lisible. */
export function depotSain(d: DepotCi): boolean {
  return !d.erreur && (d.workflows ?? []).every((w) => w.dernier.etat !== 'echec')
    && (d.prs ?? []).every((p) => prAttention(p) !== 'crit') && !(d.alertes?.total)
}

export function trierDepotsCi(depots: DepotCi[]): DepotCi[] {
  const poids = (d: DepotCi) => (d.workflows ?? []).filter((w) => w.dernier.etat === 'echec').length * 100
    + (d.prs ?? []).filter((p) => prAttention(p) === 'crit').length * 10 + (d.alertes?.total ? 5 : 0) + (d.erreur ? 1 : 0)
  return [...depots].sort((a, b) => poids(b) - poids(a) || a.depot.localeCompare(b.depot))
}

export function fmtDuree(s: number | null | undefined): string {
  if (s == null) return '-'
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m} min ${String(s % 60).padStart(2, '0')}` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

export function phraseResumeCi(r: ResumeCi): string {
  const p = (n: number, un: string, plus: string) => `${n} ${n === 1 ? un : plus}`
  const m: string[] = []
  if (r.builds_en_echec) m.push(p(r.builds_en_echec, 'build en échec', 'builds en échec'))
  if (r.prs_controles_en_echec) m.push(p(r.prs_controles_en_echec, 'PR aux contrôles en échec', 'PR aux contrôles en échec'))
  if (r.prs_en_conflit) m.push(p(r.prs_en_conflit, 'PR en conflit', 'PR en conflit'))
  if (r.alertes_graves) m.push(p(r.alertes_graves, 'alerte grave', 'alertes graves'))
  return m.length ? m.join(', ') : 'tout est vert'
}

// ---- dépendances ----

export type FiltresDeps = { gravites: Gravite[]; avecCorrectif: boolean; directes: boolean; projet: string }
export const FILTRES_DEPS: FiltresDeps = { gravites: [], avecCorrectif: false, directes: false, projet: '' }
export type LigneVuln = Vuln & { projet: string; source: 'npm' | 'pip' }

export function aplatir(projets: ProjetDeps[]): LigneVuln[] {
  return projets.flatMap((p) => (['npm', 'pip'] as const).flatMap((s) => (p[s]?.vulns ?? []).map((v) => ({ ...v, projet: p.projet, source: s }))))
}

/** `gravites` vide = toutes. Tri : plus grave d'abord, puis directes, puis nom. */
export function filtrerVulns(lignes: LigneVuln[], f: FiltresDeps): LigneVuln[] {
  return lignes
    .filter((v) => (!f.gravites.length || f.gravites.includes(v.gravite)) && (!f.avecCorrectif || v.correctif.disponible)
      && (!f.directes || v.direct) && (!f.projet || v.projet === f.projet))
    .sort((a, b) => GRAVITES.indexOf(a.gravite) - GRAVITES.indexOf(b.gravite) || Number(b.direct) - Number(a.direct) || a.paquet.localeCompare(b.paquet))
}

export function phraseCorrectif(c: Correctif): { texte: string; tone: 'ok' | 'warn' | '' } {
  if (!c.disponible) return { texte: 'pas de correctif', tone: '' }
  const v = c.version ? ` ${c.version}` : ''
  if (c.majeur) return { texte: `mise à jour majeure${v} (peut casser)`, tone: 'warn' }
  return { texte: c.version ? `corrigé en ${c.version}` : 'correctif disponible', tone: 'ok' }
}

/** Commande à lancer à la main (jamais lancée par l'app). */
export function commandeConseillee(source: 'npm' | 'pip', v: Vuln): string {
  if (!v.correctif.disponible) return ''
  if (source === 'pip') return `pip install -U "${v.paquet}${v.correctif.version ? `>=${v.correctif.version}` : ''}"`
  return v.correctif.majeur ? `npm install ${v.correctif.via || v.paquet}@${v.correctif.version || 'latest'}` : 'npm audit fix'
}

export function projetsDeps(projets: ProjetDeps[]): string[] {
  return projets.map((p) => p.projet).sort()
}

// ---- filtres mémorisés ----

export function lireStocke<T extends object>(cle: string, defaut: T, stockage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): T {
  try {
    const brut = stockage?.getItem(cle)
    const v = brut ? JSON.parse(brut) : null
    if (!v || typeof v !== 'object' || Array.isArray(v)) return defaut
    // on ne garde que les clés connues, du bon type
    const sortie = { ...defaut } as Record<string, unknown>
    for (const k of Object.keys(defaut)) if (typeof v[k] === typeof (defaut as Record<string, unknown>)[k] && Array.isArray(v[k]) === Array.isArray((defaut as Record<string, unknown>)[k])) sortie[k] = v[k]
    return sortie as T
  } catch { return defaut }
}

export function ecrireStocke(cle: string, valeur: object, stockage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try { stockage?.setItem(cle, JSON.stringify(valeur)) } catch { /* stockage indisponible : le filtre reste valable pour la session */ }
}
