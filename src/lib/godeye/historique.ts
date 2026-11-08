// God Eye : complète les séismes et événements des flux avec l'historique gardé par le serveur (48 h).
// Utile quand une source est tombée ou quand l'âge demandé dépasse ce que le flux courant couvre. Logique pure.
import type { Seisme } from '../vueMonde'
import type { Evenement } from './modele'

export type Historique = { seismes: Seisme[]; evenements: Evenement[] }
export const HISTORIQUE_VIDE: Historique = { seismes: [], evenements: [] }

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Relit GET /godeye/historique ; les entrées incomplètes sont ignorées. Les dates peuvent être en ms ou en ISO. */
export function lireHistorique(brut: unknown): Historique {
  const o = (brut && typeof brut === 'object' ? brut : {}) as { seismes?: unknown; evenements?: unknown }
  const temps = (v: unknown): number | null => {
    if (num(v)) return v < 1e12 ? v * 1000 : v
    if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : null }
    return null
  }
  const seismes: Seisme[] = []
  for (const s of Array.isArray(o.seismes) ? o.seismes : []) {
    const x = (s ?? {}) as Record<string, unknown>
    const t = temps(x.t)
    if (typeof x.id === 'string' && num(x.lat) && num(x.lon) && num(x.mag) && t !== null) {
      seismes.push({ id: x.id, mag: x.mag, lieu: typeof x.lieu === 'string' ? x.lieu : '', lat: x.lat, lon: x.lon, prof: num(x.prof) ? x.prof : 0, t })
    }
  }
  const evenements: Evenement[] = []
  for (const e of Array.isArray(o.evenements) ? o.evenements : []) {
    const x = (e ?? {}) as Record<string, unknown>
    const t = temps(x.t)
    if (typeof x.id === 'string' && typeof x.titre === 'string' && num(x.lat) && num(x.lon) && t !== null) {
      evenements.push({ ...(x as unknown as Evenement), t })
    }
  }
  return { seismes, evenements }
}

const parId = <T extends { id: string }>(vivants: readonly T[], archives: readonly T[], plusAncienQue: number, t: (x: T) => number): T[] => {
  const vus = new Set(vivants.map((x) => x.id))
  return [...vivants, ...archives.filter((x) => !vus.has(x.id) && t(x) >= plusAncienQue)]
}

/** Ajoute à ce que les flux donnent ce que l'historique garde en plus, sur les `heures` dernières heures (le flux gagne en cas de doublon). */
export function completer<T extends { seismes: Seisme[]; evenements: Evenement[] }>(donnees: T, h: Historique, maintenant: number, heures: number): T {
  if (!h.seismes.length && !h.evenements.length) return donnees
  const depuis = maintenant - heures * 3_600_000
  return { ...donnees, seismes: parId(donnees.seismes, h.seismes, depuis, (s) => s.t), evenements: parId(donnees.evenements, h.evenements, depuis, (e) => e.t) }
}

/** Faut-il interroger l'historique ? Une source en erreur, ou une durée plus longue que ce que le flux courant garantit. */
export function besoinHistorique(p: { seismes: boolean; evenements: boolean; erreurSeismes: boolean; erreurEvenements: boolean; heuresDemandees: number; heuresHistorique: number }): boolean {
  if (!p.seismes && !p.evenements) return false
  if ((p.seismes && p.erreurSeismes) || (p.evenements && p.erreurEvenements)) return true
  return p.heuresDemandees > 24 && p.heuresHistorique > 24
}
