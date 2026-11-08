// God Eye : lignes de la fiche détail d'un objet (logique pure, testée dans fiche.test.ts).
import { ageTexte } from '../vueMonde'
import type { Donnees, Objet } from './modele'

export type LigneFiche = { k: string; v: string }
const STATUTS_AIS: Record<number, string> = { 0: 'en route au moteur', 1: 'à l\'ancre', 2: 'sans maîtrise', 3: 'manœuvre limitée', 5: 'à quai', 7: 'à la pêche', 8: 'à la voile' }
const GROUPES: Record<string, string> = { stations: 'station spatiale', visual: 'brillant', weather: 'météo', military: 'militaire', science: 'science', planet: 'imagerie', geo: 'géostationnaire' }

export const coordTexte = (lat: number, lon: number): string =>
  `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'E' : 'O'}`

/** Source et ancienneté de la donnée : un relevé périodique (avions, navires), un calcul (satellites), une date (séismes, événements). */
function sourceEtAge(o: Objet, d: Donnees, maintenant: number): { source: string; age: string } {
  switch (o.couche) {
    case 'avions': return { source: 'adsb.lol', age: d.releveAvions ? ageTexte(d.releveAvions, maintenant) : 'inconnu' }
    case 'navires': return { source: 'Digitraffic', age: o.t ? ageTexte(o.t, maintenant) : d.releveNavires ? ageTexte(d.releveNavires, maintenant) : 'inconnu' }
    case 'satellites': return { source: 'CelesTrak (orbite calculée)', age: 'calculée à l\'instant' }
    case 'seismes': return { source: 'USGS', age: o.t ? ageTexte(o.t, maintenant) : 'inconnu' }
    case 'evenements': return { source: 'NASA EONET / GDACS', age: o.t ? ageTexte(o.t, maintenant) : 'inconnu' }
    default: return { source: o.detail, age: o.t ? ageTexte(o.t, maintenant) : 'inconnu' }
  }
}

/** Lignes clé / valeur d'un objet : vitesse, altitude, cap, source, âge de la donnée, coordonnées. */
export function lignesFiche(o: Objet, d: Donnees, maintenant: number): LigneFiche[] {
  const id = o.id.slice(o.id.indexOf(':') + 1)
  const l: LigneFiche[] = []
  if (o.couche === 'avions') {
    const v = d.avions.find((a) => a.id === id)
    if (v) {
      l.push({ k: 'type', v: `${v.type || 'inconnu'}${v.immat ? ` (${v.immat})` : ''}` })
      l.push({ k: 'altitude', v: v.sol ? 'au sol' : `${Math.round(v.alt).toLocaleString('fr-FR')} ft` })
      l.push({ k: 'vitesse', v: `${Math.round(v.vitesse)} kt (${Math.round(v.vitesse * 1.852)} km/h)` })
      l.push({ k: 'cap', v: `${Math.round(v.cap)}°` })
      if (v.urgence) l.push({ k: 'urgence', v: `squawk ${v.squawk}` })
      l.push({ k: 'code ICAO', v: v.id.toUpperCase() })
    }
  } else if (o.couche === 'navires') {
    const n = d.navires.find((a) => a.id === id)
    if (n) {
      l.push({ k: 'vitesse', v: `${n.vitesse.toFixed(1)} nœuds` })
      l.push({ k: 'cap', v: `${Math.round(n.cap)}°` })
      if (n.statut !== null) l.push({ k: 'statut', v: STATUTS_AIS[n.statut] ?? `code ${n.statut}` })
      l.push({ k: 'MMSI', v: n.id })
    }
  } else if (o.couche === 'satellites') {
    const s = d.satellites.find((a) => a.id === id)
    if (s) {
      l.push({ k: 'altitude', v: `${Math.round(s.altKm).toLocaleString('fr-FR')} km` })
      l.push({ k: 'vitesse', v: `${s.vitesseKms.toFixed(2)} km/s` })
      l.push({ k: 'groupe', v: GROUPES[s.groupe] ?? s.groupe })
      l.push({ k: 'numéro NORAD', v: s.id })
    }
  } else if (o.detail) l.push({ k: 'détail', v: o.detail })
  const { source, age } = sourceEtAge(o, d, maintenant)
  l.push({ k: 'source', v: source }, { k: 'donnée', v: age }, { k: 'position', v: coordTexte(o.lat, o.lon) })
  return l
}
