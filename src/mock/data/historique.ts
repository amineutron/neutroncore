// Historique des sessions Claude Code de démo : journal, usage, tarif (modifiable en mémoire).
import type { MockHandler } from '../router'
import { jourLocal, type Tarifs } from '../../lib/historique'

const J = (ago: number): Date => { const d = new Date(); d.setDate(d.getDate() - ago); return d }
const at = (ago: number, h: number, m = 0): number => { const d = J(ago); d.setHours(h, m, 0, 0); return Math.floor(d.getTime() / 1000) }

const SESSIONS = [
  { id: 'demo-a', title: 'mode démo', projet: 'neutroncore', ago: 0, h: 9, fichiers: 14, commandes: 41, commits: 2, prompts: 6, tokens: 4_200_000 },
  { id: 'demo-b', title: 'audit des MCP', projet: 'lyra', ago: 1, h: 14, fichiers: 5, commandes: 22, commits: 1, prompts: 4, tokens: 1_900_000 },
  { id: 'demo-c', title: 'sauvegardes borg', projet: 'fedora-setup', ago: 3, h: 21, fichiers: 3, commandes: 17, commits: 0, prompts: 3, tokens: 800_000 },
].map((s) => ({
  id: s.id, title: s.title, projet: s.projet, cwd: `/home/user/dev/${s.projet}`, debut: at(s.ago, s.h), fin: at(s.ago, s.h + 2), jours: [jourLocal(J(s.ago))],
  fichiers: s.fichiers, commandes: s.commandes, commits: s.commits, prompts: s.prompts, sous_agents: s.id === 'demo-a' ? 2 : 0, tokens: s.tokens,
}))

const EVENTS = [
  [0, 'prompt', 'Ajoute un mode démo à l’app, avec des données fictives.'], [60, 'edit', 'src/mock/routes.ts'],
  [75, 'cmd', 'npm run build'], [90, 'write', 'src/mock/data/historique.ts'], [110, 'commit', 'feat: demo mode with fake data'],
] as const

let tarifs: Tarifs = {
  devise: 'USD', regles: [{ motif: 'opus', entree: 5, sortie: 25, lecture: 0.5, ecriture: 6.25, ecriture_1h: 10 }],
  defaut: { entree: 3, sortie: 15, lecture: 0.3, ecriture: 3.75, ecriture_1h: 6 },
}

function ligne(cle: string, k: number) {
  return { cle, entree: 900 * k, sortie: 52_000 * k, lecture: 9_000_000 * k, ecriture: 400_000 * k, cout: 1.4 * k, messages: 60 * k }
}

export const historique: [string, string, MockHandler][] = [
  ['GET', '/journal/etat', () => ({
    indexation: { en_cours: false, total: 12, faits: 12, duree_s: 0.4, premiere_indexation_s: 2.1, erreur: '' },
    sessions: SESSIONS.length, projets: [...new Set(SESSIONS.map((s) => s.projet))].sort(),
    premier_jour: jourLocal(J(30)), dernier_jour: jourLocal(J(0)),
  })],
  ['GET', '/journal/sessions', ({ query }) => {
    const q = (query.get('q') ?? '').toLowerCase()
    const p = query.get('projet')
    return { sessions: SESSIONS.filter((s) => (!p || s.projet === p) && (!q || s.title.includes(q) || 'build'.includes(q))) }
  }],
  ['GET', '/journal/sessions/:id', ({ params }) => {
    const s = SESSIONS.find((x) => x.id === params.id) ?? SESSIONS[0]
    const evenements = EVENTS.map(([m, kind, text]) => ({ at: s.debut + m * 60, kind, text, agent: false }))
    return { session: s, total: evenements.length, evenements, tronque: false }
  }],
  ['GET', '/journal/usage', () => {
    const par_jour = Array.from({ length: 14 }, (_, i) => ligne(jourLocal(J(13 - i)), 1 + ((i * 7) % 5)))
    const total = par_jour.reduce((a, l) => ({ entree: a.entree + l.entree, sortie: a.sortie + l.sortie, lecture: a.lecture + l.lecture,
      ecriture: a.ecriture + l.ecriture, cout: a.cout + l.cout, messages: a.messages + l.messages }),
    { entree: 0, sortie: 0, lecture: 0, ecriture: 0, cout: 0, messages: 0 })
    return { devise: tarifs.devise, total, par_jour, par_projet: [ligne('neutroncore', 30), ligne('lyra', 12), ligne('fedora-setup', 3)],
      par_modele: [ligne('claude-opus-demo', 40), ligne('claude-haiku-demo', 5)],
      par_session: SESSIONS.map((s, i) => ({ id: s.id, titre: s.title, ...ligne(s.id, 6 - i * 2) })), modeles_sans_regle: [], tarif_renseigne: true }
  }],
  ['GET', '/journal/tarifs', () => tarifs],
  ['PUT', '/journal/tarifs', ({ body }) => { tarifs = body as Tarifs; return tarifs }],
  ['POST', '/journal/reindexer', () => ({ ok: true })],
]
