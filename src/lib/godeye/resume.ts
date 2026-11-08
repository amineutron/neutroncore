// God Eye : résumé du matin (GET /godeye/resume). Logique pure testée dans resume.test.ts.
export type Resume = {
  depuis: string | null
  seismes: { total: number; max: { mag: number; lieu: string } | null }
  evenements: { total: number; parType: { type: string; n: number }[] }
  suivis: { nom: string; distanceKm: number }[]
  zones: { nom: string; entrees: number }[]
}

const nb = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

export function lireResume(brut: unknown): Resume | null {
  if (!brut || typeof brut !== 'object') return null
  const o = brut as Record<string, unknown>
  const se = rec(o.seismes), ev = rec(o.evenements)
  const m = rec(se.max)
  const parType = Object.entries(rec(ev.par_type)).map(([type, n]) => ({ type, n: nb(n) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)
  const liste = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(rec) : [])
  return {
    depuis: typeof o.depuis === 'string' ? o.depuis : null,
    seismes: { total: nb(se.total), max: typeof m.mag === 'number' ? { mag: m.mag, lieu: typeof m.lieu === 'string' ? m.lieu : '' } : null },
    evenements: { total: nb(ev.total), parType },
    suivis: liste(o.suivis).filter((s) => typeof s.nom === 'string').map((s) => ({ nom: String(s.nom), distanceKm: nb(s.distance_km) })),
    zones: liste(o.zones).filter((z) => typeof z.nom === 'string').map((z) => ({ nom: String(z.nom), entrees: nb(z.entrees) })),
  }
}

const pluriel = (n: number, un: string, plu: string): string => `${n} ${n > 1 ? plu : un}`

/** Phrases du résumé, une par ligne ; « rien » quand tout est vide. */
export function phrases(r: Resume, heures = 24): string[] {
  const lignes: string[] = []
  const periode = heures === 24 ? 'en 24 h' : `en ${heures} h`
  if (r.seismes.total > 0) {
    const fort = r.seismes.max ? ` ; le plus fort : magnitude ${r.seismes.max.mag.toFixed(1)}${r.seismes.max.lieu ? `, ${r.seismes.max.lieu}` : ''}` : ''
    lignes.push(`${pluriel(r.seismes.total, 'séisme', 'séismes')} ${periode}${fort}`)
  }
  if (r.evenements.total > 0) {
    const detail = r.evenements.parType.slice(0, 3).map((x) => `${x.n} ${x.type}`).join(', ')
    lignes.push(`${pluriel(r.evenements.total, 'événement', 'événements')} ${periode}${detail ? ` (${detail})` : ''}`)
  }
  for (const s of r.suivis) lignes.push(`${s.nom} : ${s.distanceKm < 1 ? 'à moins de 1 km' : `${Math.round(s.distanceKm)} km parcourus`} depuis le début du suivi`)
  for (const z of r.zones) if (z.entrees > 0) lignes.push(`zone ${z.nom} : ${pluriel(z.entrees, 'entrée', 'entrées')}`)
  return lignes.length ? lignes : ['rien de notable depuis la dernière fois']
}
