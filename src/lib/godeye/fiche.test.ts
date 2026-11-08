import { describe, expect, it } from 'vitest'
import { lignesFiche } from './fiche'
import { DONNEES_VIDES, type Donnees, type Objet } from './modele'

const d: Donnees = {
  ...DONNEES_VIDES, releveAvions: 1_000_000,
  avions: [{ id: '3944ee', indicatif: 'AFR1', immat: 'F-X', type: 'A320', alt: 36000, sol: false, vitesse: 450, cap: 78, lat: 47, lon: 4, squawk: '7700', urgence: true, militaire: false, helico: false }],
  navires: [{ id: '2301', vitesse: 12.4, cap: 80, lat: 59, lon: 24, statut: 5, t: null }],
}
const obj = (id: string, couche: Objet['couche']): Objet => ({ id, couche, lon: 4, lat: 47, ton: 'info', rayon: 5, titre: 't', detail: 'dét' })

describe('lignesFiche', () => {
  it('avion : vitesse, altitude, cap, urgence, source, âge, position', () => {
    const l = lignesFiche(obj('avi:3944ee', 'avions'), d, 1_000_000 + 120_000)
    const m = Object.fromEntries(l.map((x) => [x.k, x.v]))
    expect(m.vitesse).toContain('450 kt')
    expect(m.cap).toBe('78°')
    expect(m.urgence).toBe('squawk 7700')
    expect(m.source).toBe('adsb.lol')
    expect(m['donnée']).toBe('il y a 2 min')
    expect(m.position).toContain('47.000° N')
  })
  it('navire : statut lisible', () => {
    expect(lignesFiche(obj('nav:2301', 'navires'), d, 0).find((x) => x.k === 'statut')?.v).toBe('à quai')
  })
  it('objet inconnu des données : source et position quand même', () => {
    const l = lignesFiche(obj('avi:zzz', 'avions'), d, 0)
    expect(l.map((x) => x.k)).toEqual(['source', 'donnée', 'position'])
  })
})
