// Démo : zones surveillées de God Eye, retenues en mémoire jusqu'au rechargement (même contrat que l'API).
import type { MockHandler } from '../router'
import { erreursZone, lireZone, ZONES_MAX, type Zone, type ZoneBrouillon } from '../../lib/godeye/zones'

const zones: Zone[] = [
  { id: 'demozone01', nom: 'détroit du pas de calais', forme: 'cercle', centre: { lat: 51.0, lon: 1.5 }, rayon_km: 90, objets: ['navire', 'avion'], actif: true, notifier: true },
  { id: 'demozone02', nom: 'ceinture de feu japon', forme: 'rect', centre: { lat: 36, lon: 140 }, bbox: { s: 30, w: 135, n: 42, e: 146 }, objets: ['seisme'], actif: true, notifier: false },
]

const enregistrer: MockHandler = ({ params, body }) => {
  const id = params.id === 'new' ? `demo${Math.random().toString(36).slice(2, 10)}` : params.id
  const existe = zones.some((z) => z.id === id)
  if (!existe && zones.length >= ZONES_MAX) throw new Error(`limite de ${ZONES_MAX} zones atteinte`)
  const brouillon = { ...(body as ZoneBrouillon), id }
  const err = erreursZone(brouillon)
  if (err.length) throw new Error(err[0])
  const z = lireZone(brouillon)
  if (!z) throw new Error('zone invalide')
  const i = zones.findIndex((x) => x.id === id)
  if (i >= 0) zones[i] = z
  else zones.push(z)
  return z
}

export const zonesRoutes: [string, string, MockHandler][] = [
  ['GET', '/godeye/zones', () => ({ zones })],
  ['PUT', '/godeye/zones/:id', enregistrer],
  ['DELETE', '/godeye/zones/:id', ({ params }) => {
    const i = zones.findIndex((z) => z.id === params.id)
    if (i >= 0) zones.splice(i, 1)
    return { success: true }
  }],
]
