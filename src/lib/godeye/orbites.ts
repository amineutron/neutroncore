// God Eye : position des satellites à partir des éléments orbitaux TLE (SGP4 via satellite.js 5, sans WASM).
import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, twoline2satrec, type SatRec } from 'satellite.js'
import type { GroupeSat, Satellite } from './modele'
import type { Tle } from './sources'

export type Orbite = { id: string; nom: string; groupe: GroupeSat; satrec: SatRec }

/** Prépare les orbites ; un jeu dont les éléments sont inutilisables est ignoré. */
export function creerOrbites(tles: readonly Tle[], groupe: GroupeSat): Orbite[] {
  const sortie: Orbite[] = []
  for (const t of tles) {
    try {
      const satrec = twoline2satrec(t.l1, t.l2)
      if (satrec.error) continue
      sortie.push({ id: t.l1.slice(2, 7).trim() || t.nom, nom: t.nom, groupe, satrec })
    } catch { /* éléments invalides : cet objet n'est pas affiché */ }
  }
  return sortie
}

export function positionA(o: Orbite, date: Date): Satellite | null {
  const pv = propagate(o.satrec, date)
  const { position, velocity } = pv
  if (typeof position === 'boolean' || typeof velocity === 'boolean' || !position || !velocity) return null
  const geo = eciToGeodetic(position, gstime(date))
  const lat = degreesLat(geo.latitude), lon = degreesLong(geo.longitude)
  if (!Number.isFinite(lat + lon + geo.height)) return null
  return { id: o.id, nom: o.nom, groupe: o.groupe, lon, lat, altKm: geo.height, vitesseKms: Math.hypot(velocity.x, velocity.y, velocity.z) }
}

export function positions(orbites: readonly Orbite[], date: Date): Satellite[] {
  const sortie: Satellite[] = []
  for (const o of orbites) {
    const p = positionA(o, date)
    if (p) sortie.push(p)
  }
  return sortie
}

/** Trace au sol sur `minutes` minutes à partir de `debut`, coupée aux passages de l'antiméridien (un tronçon par morceau). */
export function trace(o: Orbite, debut: Date, minutes = 100, pasMin = 1): [number, number][][] {
  const morceaux: [number, number][][] = []
  let courant: [number, number][] = []
  let dernier: number | null = null
  for (let m = 0; m <= minutes; m += pasMin) {
    const p = positionA(o, new Date(debut.getTime() + m * 60_000))
    if (!p) continue
    if (dernier !== null && Math.abs(p.lon - dernier) > 180) { morceaux.push(courant); courant = [] }
    courant.push([p.lon, p.lat])
    dernier = p.lon
  }
  if (courant.length) morceaux.push(courant)
  return morceaux
}
