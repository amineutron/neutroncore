// Notes rapides : logique pure (saisie en une ligne, filtres retenus).

export type Note = { id: string; texte: string; projet: string; epingle: boolean; cree: number; modifie: number; source: string }
export type ListeNotes = {
  notes: Note[]; total: number; projets: { projet: string; notes: number }[]; epinglees: number; corbeille: number
}

/** « #lyra acheter un micro » -> projet « lyra » ; sinon le projet choisi dans le sélecteur. Texte vide = null. */
export function lireSaisie(saisie: string, projetChoisi: string): { texte: string; projet: string } | null {
  const m = saisie.trim().match(/^#([\w.-]{1,60})\s+([\s\S]+)$/u)
  const texte = (m ? m[2] : saisie).trim()
  if (!texte) return null
  return { texte, projet: m ? m[1] : projetChoisi }
}

export type FiltresNotes = { projet: string | null; epinglees: boolean }   // projet null = tous, '' = sans projet
const CLE = 'neutroncore_notes_filtres'
export const FILTRES_NOTES_DEFAUT: FiltresNotes = { projet: null, epinglees: false }

export function lireFiltresNotes(brut: string | null): FiltresNotes {
  try {
    const d = JSON.parse(brut ?? '{}') as Partial<FiltresNotes>
    return { projet: typeof d.projet === 'string' ? d.projet : null, epinglees: d.epinglees === true }
  } catch {
    return FILTRES_NOTES_DEFAUT
  }
}

export function chargerFiltresNotes(): FiltresNotes {
  try { return lireFiltresNotes(localStorage.getItem(CLE)) } catch { return FILTRES_NOTES_DEFAUT }
}

export function sauverFiltresNotes(f: FiltresNotes): void {
  try { localStorage.setItem(CLE, JSON.stringify(f)) } catch { /* stockage indisponible */ }
}

/** Chaîne de requête de GET /notes. */
export function requeteNotes(q: string, f: FiltresNotes): string {
  const p = new URLSearchParams()
  if (q.trim()) p.set('q', q.trim())
  if (f.projet !== null) p.set('projet', f.projet)
  if (f.epinglees) p.set('epingle', 'true')
  const s = p.toString()
  return s ? `?${s}` : ''
}

/** « il y a 3 min », « hier », « 12 oct. » */
export function quand(ts: number, maintenantMs: number = Date.now()): string {
  const s = maintenantMs / 1000 - ts
  if (s < 60) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  if (s < 172800) return 'hier'
  return new Date(ts * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
