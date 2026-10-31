// Sorties de démo : réglages (mémorisés en mémoire jusqu'au rechargement) et occurrences d'agenda de catégorie « sorties ».
// À fusionner dans la réponse de GET /agenda quand la case est cochée (voir INTEGRATION.md).
import type { MockHandler } from '../router'
import { SORTIES_DEFAULTS, type SortiesSettings } from '../../lib/sorties'
import { dayAt, localStamp } from './time'

let settings: SortiesSettings = { ...SORTIES_DEFAULTS }

function occ(id: string, title: string, offsetDays: number, hh: number, description: string, extra: Record<string, unknown> = {}) {
  const start = localStamp(dayAt(offsetDays, hh))
  return {
    id: `${id}@${start}`, event_id: id, source: 'auto' as const, title, category: 'sorties', start, end: start, recurrence: 'none' as const,
    event_start: start, duration_min: 0, description, notify: false, rappel: null, unit: null, log: null,
    status: offsetDays < 0 ? 'past' : 'upcoming', run: null, can_retry: false, can_dismiss: false, can_restore: false, ...extra,
  }
}

export const sortiesDemo = () => [
  occ('sortie-ep-1', 'Serie fictive S02E05', 1, 21, 'Le pont', { all_day: false }),
  occ('sortie-ep-2', 'Serie fictive S02E06', 8, 21, 'Le retour', { all_day: false }),
  occ('sortie-film-9-num', 'Film fictif (numérique)', 3, 0, 'Film fictif (2026) : sortie numérique', { all_day: true }),
  occ('sortie-film-9-cine', 'Autre film fictif (en salle)', 5, 0, 'Autre film fictif (2026) : sortie en salle', { all_day: true }),
]

export const sorties: [string, string, MockHandler][] = [
  ['GET', '/sorties/reglages', () => ({ settings, ntfy_configure: true })],
  ['PUT', '/sorties/reglages', ({ body }) => { settings = { ...settings, ...(body as Partial<SortiesSettings>) }; return { settings, ntfy_configure: true } }],
  ['POST', '/sorties/rappels/verifier', () => ({ sent: 0, reason: 'rappel désactivé' })],
  ['GET', '/sorties', () => ({ settings, occurrences: sortiesDemo(), errors: [] })],
]
