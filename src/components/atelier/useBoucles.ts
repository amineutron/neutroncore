import { apiGet } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { sessionDuProjet, type Boucle, type Recente } from '../../lib/atelierSessions'
import type { LiveSession } from '../../lib/sessions'

export type Launch = { numero: number; started: number; cwd: string; modele: string }
type Carte = { cwd: string; vivantes: Record<string, string>; recentes: Recente[] }
const DEMARRAGE_S = 90      // après un lancement, on attend la session ce temps-là avant de conclure qu'elle n'est pas venue

// Les sessions de boucle du projet 3D et le modèle sur lequel chacune travaille. Lu une fois pour tout
// l'écran : la bulle (conversation) et le bandeau d'avancement montrent la même chose.
export function useBoucles(modele: string, launch: Launch | null) {
  const depuis = launch ? Date.now() / 1000 - launch.started : Infinity
  const attendue = launch?.modele === modele && depuis < DEMARRAGE_S
  const sessions = usePoll<{ sessions: LiveSession[] }>(() => apiGet('/launcher/sessions?others=1'), 5000)
  const carte = usePoll<Carte>(() => apiGet('/modelisation/sessions'), 6000)
  const vivantes = carte.data?.vivantes ?? {}
  const lives = (sessions.data?.sessions ?? []).filter((s) => s.sessionId in vivantes)
  const boucles: Boucle[] = lives.map((s) => ({ sessionId: s.sessionId, modele: vivantes[s.sessionId] ?? '', startedAt: s.startedAt, waiting: s.waiting, status: s.status }))
  // dans les dix minutes qui suivent un lancement, seule la session ouverte par ce lancement compte
  const duProjet = sessionDuProjet(boucles, modele, launch?.modele === modele && depuis < 600 ? launch.started * 1000 : null)
  return {
    lives, boucles, duProjet, session: lives.find((s) => s.sessionId === duProjet?.sessionId) ?? null,
    // lancée d'ici il y a peu et pas encore visible : elle démarre ; au-delà du délai sans session : elle n'est pas venue
    attendue: attendue && !duProjet, perdue: launch?.modele === modele && !duProjet && depuis >= DEMARRAGE_S && depuis < 600,
    recentes: carte.data?.recentes ?? [], cwd: carte.data?.cwd ?? '',
    refresh: () => { sessions.refresh(); carte.refresh() },
  }
}
export type Boucles = ReturnType<typeof useBoucles>
