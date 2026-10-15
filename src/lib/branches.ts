// Branches et PR des projets suivis : types et mise en phrases (logique pure).

export type Branche = { nom: string; le: string; avance: number; poussee: boolean; conflit: boolean; etat: 'pr' | 'incluse' | 'sans_pr' | 'fusionnee'; pr: number | null }
export type Pr = { numero: number; titre: string; branche: string; url: string; conflit: boolean; brouillon: boolean; maj: string }
export type Depot = {
  depot: string; erreur?: string; github?: string; principale?: string; courante?: string; modifies?: number
  branches: Branche[]; prs: Pr[] | null; sessions: { dossier: string; branche: string }[]
}
export type EtatBranches = {
  depots: Depot[]; par_session: boolean; dernier_rappel: string; releve_le: string
  resume: { sans_pr: number; conflits: number; fusionnees: number; prs: number; illisibles: number; phrase: string }
}

/** Ce qu'il y a à faire d'une branche, en clair. */
export function conseil(b: Branche): { texte: string; tone: 'ok' | 'warn' | 'crit' | '' } {
  if (b.conflit) return { texte: b.pr ? `PR #${b.pr} en conflit avec la branche principale` : 'en conflit avec la branche principale', tone: 'crit' }
  if (b.etat === 'pr') return { texte: `en PR #${b.pr}`, tone: 'ok' }
  if (b.etat === 'incluse') return { texte: `déjà dans la PR #${b.pr} : à supprimer une fois fusionnée`, tone: '' }
  if (b.etat === 'fusionnee') return { texte: 'déjà fusionnée : à supprimer', tone: '' }
  return { texte: b.poussee ? `${b.avance} commit${b.avance > 1 ? 's' : ''}, poussée, sans PR` : `${b.avance} commit${b.avance > 1 ? 's' : ''}, jamais poussée`, tone: 'warn' }
}

/** Un dépôt demande-t-il de l'attention (pour le déplier d'office) ? */
export function aTraiter(d: Depot): boolean {
  return Boolean(d.erreur) || d.branches.some((b) => b.conflit || b.etat === 'sans_pr' || b.etat === 'fusionnee')
}

/** Les dépôts à traiter d'abord, puis par nom. */
export function trierDepots(depots: Depot[]): Depot[] {
  return [...depots].sort((a, b) => Number(aTraiter(b)) - Number(aTraiter(a)) || a.depot.localeCompare(b.depot))
}
