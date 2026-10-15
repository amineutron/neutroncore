// Atelier 3D : les sessions de boucle d'agents et le projet sur lequel chacune travaille (logique pure).

export type Boucle = { sessionId: string; modele: string; startedAt: number; waiting: boolean; status: string }
export type Recente = { sessionId: string; modele: string; updatedAt: number; title: string }

// le registre de Claude Code écrit « busy » pendant un tour ; « idle », ou « shell » quand il ne reste
// qu'une commande de fond (la visionneuse), veulent dire que l'agent a rendu la main
const auTravail = (status: string) => status === 'busy' || status === 'running'

/** État lisible d'une session de boucle. */
export function etatBoucle(b: Pick<Boucle, 'waiting' | 'status'> | null, demarre = false): { texte: string; tone: '' | 'busy' | 'wait' } {
  if (!b) return { texte: demarre ? 'démarre…' : 'au repos', tone: '' }
  if (b.waiting) return { texte: 'attend ta réponse', tone: 'wait' }
  return auTravail(b.status) ? { texte: 'travaille', tone: 'busy' } : { texte: 'en pause', tone: '' }
}

/** Sessions du projet affiché d'abord, puis celles qui attendent une réponse, puis les plus récentes. */
export function trierBoucles(boucles: Boucle[], modele: string): Boucle[] {
  return [...boucles].sort((a, b) => Number(b.modele === modele) - Number(a.modele === modele) || Number(b.waiting) - Number(a.waiting) || b.startedAt - a.startedAt)
}

/** Session à montrer : celle qu'on a choisie si elle vit encore, sinon la plus récente du projet affiché.
 * Rend null si ce projet n'a pas de session : on ne montre pas d'office la conversation d'un autre projet. */
export function boucleAffichee(boucles: Boucle[], modele: string, choisie: string | null): Boucle | null {
  return boucles.find((b) => b.sessionId === choisie) ?? trierBoucles(boucles.filter((b) => b.modele === modele), modele)[0] ?? null
}

/** Dernière session terminée de ce projet, à reprendre. */
export function derniereRecente(recentes: Recente[], modele: string): Recente | null {
  return [...recentes].filter((r) => r.modele === modele).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
}

/** Combien de sessions d'AUTRES projets attendent une réponse (signalé sur la languette). */
export function autresEnAttente(boucles: Boucle[], modele: string): number {
  return boucles.filter((b) => b.modele !== modele && b.waiting).length
}

export type Avancement = { phase: 'demarre' | 'travaille' | 'attend' | 'pause' | 'perdue' | 'finie'; etape: number }
/** Ce que le bandeau d'avancement montre, ou null s'il n'y a rien à montrer (aucune boucle pour ce projet).
 * `etape` : indice de l'étape en cours (0 = recherche … 4 = à toi de décider) ; une étape inconnue compte pour la première. */
export function avancement(o: { session: Pick<Boucle, 'waiting' | 'status'> | null; attendue: boolean; perdue: boolean; etape: number }): Avancement | null {
  if (!o.session) return o.attendue ? { phase: 'demarre', etape: 0 } : o.perdue ? { phase: 'perdue', etape: 0 } : null
  const etape = Math.max(0, o.etape)
  if (o.session.waiting) return { phase: 'attend', etape }
  // la session vit encore mais la boucle a rendu son verdict : elle attend tes décisions
  if (etape >= 4) return { phase: 'finie', etape }
  // l'agent a rendu la main sans que l'attente ait été signalée (ou l'API a redémarré et l'a oubliée)
  return { phase: auTravail(o.session.status) ? 'travaille' : 'pause', etape }
}

/** La session du projet à montrer. Juste après un lancement (`lanceLe`, en ms), une session plus ancienne
 * du même projet n'est pas celle qu'on attend : on rend null tant que la nouvelle n'est pas apparue. */
export function sessionDuProjet(boucles: Boucle[], modele: string, lanceLe: number | null): Boucle | null {
  const duModele = boucles.filter((b) => b.modele === modele).sort((a, b) => b.startedAt - a.startedAt)
  if (lanceLe === null) return duModele[0] ?? null
  return duModele.find((b) => b.startedAt >= lanceLe - 5000) ?? null
}

/** Clé de session : le projet à ouvrir quand on arrive dans l'atelier depuis l'accueil. */
export const PROJET_ATELIER = 'neutroncore_atelier_ouvrir'
export const PHASE_LABEL: Record<Avancement['phase'], string> = { demarre: 'démarre…', travaille: 'au travail', attend: 'attend ta réponse', pause: 'en pause', perdue: 'n’a pas démarré', finie: 'terminé' }

export type Courant = { numero?: number; etape?: string; attente?: unknown }
export type LigneBoucle = { sessionId: string; modele: string; numero: number | null; etape: number; phase: Avancement['phase']; courant: Courant | null; dit: string; age_s: number; sessions: number }
/** Les boucles ouvertes, une ligne par projet qui a une session : celles qui attendent d'abord, puis celles
 * qui travaillent, puis le reste. `etapeDe` traduit le nom d'étape du pipeline en indice. */
export function bouclesEnCours(
  vivantes: Record<string, string>, courants: Record<string, Courant>,
  sessions: { sessionId: string; waiting: boolean; status: string; startedAt: number; last_claude?: string; age_s?: number }[],
  etapeDe: (etape: string | undefined) => number,
): LigneBoucle[] {
  const rang: Record<Avancement['phase'], number> = { attend: 0, finie: 1, travaille: 2, demarre: 3, pause: 4, perdue: 5 }
  return sessions.flatMap((s) => {
    const modele = vivantes[s.sessionId]
    if (!modele) return []
    const courant = courants[modele] ?? null
    const a = avancement({ session: s, attendue: false, perdue: false, etape: etapeDe(courant?.etape) })
    if (!a) return []
    const dit = (s.last_claude ?? '').replace(/[*_`#]+/g, '').replace(/\s+/g, ' ').trim()
    return [{ sessionId: s.sessionId, modele, numero: courant?.numero ?? null, etape: a.etape, phase: a.phase, courant, dit, age_s: s.age_s ?? 0, startedAt: s.startedAt }]
  }).sort((a, b) => rang[a.phase] - rang[b.phase] || b.startedAt - a.startedAt)
    // un projet peut avoir plusieurs sessions ouvertes : on en montre une, la plus urgente, et on dit combien il y en a
    .filter((l, i, tout) => tout.findIndex((x) => x.modele === l.modele) === i)
    .map(({ startedAt: _debut, ...l }) => ({ ...l, sessions: Object.values(vivantes).filter((m) => m === l.modele).length }))
}
