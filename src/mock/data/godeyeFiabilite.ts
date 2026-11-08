// Démo : réglages côté serveur, fraîcheur, historique et résumé de God Eye (tout est inventé).
import type { MockHandler } from '../router'
import { seismesDemo } from './vueMonde'

let reglages: Record<string, unknown> = { elements: {}, filtres: {}, historique_heures: 24, rotation: { actif: false, secondes: 20, etapes: [{ type: 'monde' }] } }

const iso = (ms: number): string => new Date(ms).toISOString()

export const godeyeFiabilite: [string, string, MockHandler][] = [
  ['GET', '/godeye/reglages', () => reglages],
  ['PUT', '/godeye/reglages', ({ body }) => { reglages = { ...reglages, ...((body as Record<string, unknown> | null) ?? {}) }; return reglages }],
  ['GET', '/godeye/fraicheur', () => {
    const t = Date.now()
    const c = (age: number) => ({ maj: iso(t - age * 1000), age_s: age, ok: true, perime: false })
    return { couches: { seismes: c(95), infos: c(140), evenements: c(600), avions: c(8), navires: c(40), satellites: c(900) } }
  }],
  ['GET', '/godeye/historique', ({ query }) => {
    const h = Math.min(48, Math.max(1, Number(query.get('heures')) || 24))
    const depuis = Date.now() - h * 3_600_000
    return { evenements: [], seismes: seismesDemo().filter((s) => s.t >= depuis) }
  }],
  ['GET', '/godeye/resume', ({ query }) => ({
    depuis: iso(Date.now() - (Number(query.get('heures')) || 24) * 3_600_000),
    seismes: { total: 14, max: { mag: 5.6, lieu: 'Îles Kouriles' } },
    evenements: { total: 6, par_type: { incendie: 3, tempete: 2, volcan: 1 } },
    suivis: [{ nom: 'ISS (ZARYA)', distance_km: 18_240 }],
    zones: [{ nom: 'Baltique', entrees: 2 }],
  })],
]
