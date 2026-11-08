// Démo de God Eye : objets marqués, retenus en mémoire jusqu'au rechargement. Chaque lecture ajoute une position fictive
// (le serveur réel en échantillonne une par minute), pour que la trace se voie en démo.
import type { MockHandler } from '../router'

type Point = { t: string; lat: number; lon: number; alt?: number }
type SuiviDemo = { id: string; type: 'avion' | 'navire' | 'satellite'; nom: string; depuis: string; points: Point[] }
const suivis: SuiviDemo[] = []
const TYPES = ['avion', 'navire', 'satellite']

const lire: MockHandler = () => {
  const t = new Date().toISOString()
  for (const s of suivis) {
    const p = s.points[s.points.length - 1]
    if (p) s.points.push({ t, lat: p.lat + 0.12, lon: p.lon + 0.35 })
    if (s.points.length > 2000) s.points.shift()
  }
  return { suivis }
}

const ajouter: MockHandler = ({ body }) => {
  const b = (body ?? {}) as { id?: unknown; type?: unknown; nom?: unknown; lat?: unknown; lon?: unknown }
  if (typeof b.id !== 'string' || !b.id || typeof b.type !== 'string' || !TYPES.includes(b.type)) throw new Error('suivi invalide')
  if (suivis.length >= 20) throw new Error('20 suivis au plus')
  const t = new Date().toISOString()
  const point = { t, lat: typeof b.lat === 'number' ? b.lat : 45, lon: typeof b.lon === 'number' ? b.lon : 5 }
  const reste = suivis.filter((s) => !(s.id === b.id && s.type === b.type))
  suivis.length = 0
  suivis.push(...reste, { id: b.id, type: b.type as SuiviDemo['type'], nom: typeof b.nom === 'string' && b.nom ? b.nom : b.id, depuis: t, points: [point] })
  return { suivis }
}

export const godeyeSuivis: [string, string, MockHandler][] = [
  ['GET', '/godeye/suivis', lire],
  ['POST', '/godeye/suivis', ajouter],
  ['DELETE', '/godeye/suivis/:id', ({ params }) => {
    const reste = suivis.filter((s) => s.id !== params.id)
    suivis.length = 0
    suivis.push(...reste)
    return { suivis }
  }],
]
