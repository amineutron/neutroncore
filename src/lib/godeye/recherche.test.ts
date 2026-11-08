import { describe, expect, it } from 'vitest'
import { DONNEES_VIDES, type Donnees } from './modele'
import { chercher, scoreTexte } from './recherche'

const d: Donnees = {
  ...DONNEES_VIDES,
  avions: [
    { id: '3944ee', indicatif: 'AFR1234', immat: 'F-HBNA', type: 'A320', alt: 36000, sol: false, vitesse: 450, cap: 78, lat: 47, lon: 4, squawk: '1000', urgence: false, militaire: false, helico: false },
    { id: '4b1814', indicatif: 'SWR88', immat: 'HB-JNA', type: 'A220', alt: 31000, sol: false, vitesse: 430, cap: 250, lat: 46, lon: 8, squawk: '2301', urgence: false, militaire: false, helico: false },
  ],
  navires: [{ id: '230123456', vitesse: 12, cap: 80, lat: 59, lon: 24, statut: 0, t: null }],
  satellites: [{ id: '25544', nom: 'ISS (ZARYA)', groupe: 'stations', lon: 10, lat: 20, altKm: 420, vitesseKms: 7.6 }],
  seismes: [{ id: 's1', mag: 5.2, lieu: '10 km de Séville, Espagne', lon: -6, lat: 37, prof: 10, t: 0 }],
  evenements: [{ id: 'e1', titre: 'Incendie de forêt, Californie', categorie: 'wildfires', lon: -120, lat: 38, t: 0, lien: '', pays: 'États-Unis' }],
  infos: [{ id: 'i1', titre: 'Sommet à Oslo', resume: '', lien: '', source: 'x', sourceNom: 'X', t: 0, theme: 'diplomatie', niveau: 'info', pays: 'Norvège', lat: 60, lon: 10 }],
}

describe('scoreTexte', () => {
  it.each([['AFR1234', 'afr1234', 100], ['AFR1234', 'afr', 80], ['ISS (ZARYA)', 'zar', 60], ['Séville', 'vill', 40], ['abc', 'xyz', 0]])('%s / %s', (c, q, s) => {
    expect(scoreTexte(c, q)).toBe(s)
  })
})

describe('chercher', () => {
  it('ignore une requête trop courte', () => expect(chercher(d, 'a')).toEqual([]))
  it('trouve un avion par indicatif, ICAO ou immatriculation', () => {
    expect(chercher(d, 'afr12')[0].objetId).toBe('avi:3944ee')
    expect(chercher(d, '4b18')[0].objetId).toBe('avi:4b1814')
    expect(chercher(d, 'hb-jna')[0].objetId).toBe('avi:4b1814')
  })
  it('trouve navire par MMSI, satellite par nom, séisme sans tenir compte des accents', () => {
    expect(chercher(d, '2301')[0].type).toBe('navire')
    expect(chercher(d, 'zarya')[0].objetId).toBe('sat:25544')
    expect(chercher(d, 'seville')[0].type).toBe('seisme')
  })
  it('trouve événements, actualités et pays (sans objet sur la carte)', () => {
    expect(chercher(d, 'incendie')[0].type).toBe('evenement')
    expect(chercher(d, 'oslo')[0].type).toBe('actualite')
    const pays = chercher(d, 'norv')[0]
    expect(pays.type).toBe('pays')
    expect(pays.objetId).toBeNull()
    expect(pays.detail).toBe('1 actualité')
  })
  it('filtre par type', () => {
    expect(chercher(d, 'a22', new Set(['navire']))).toEqual([])
    expect(chercher(d, 'a22', new Set(['avion']))).toHaveLength(1)
  })
  it('classe le meilleur score en premier', () => {
    const r = chercher({ ...d, avions: [...d.avions, { ...d.avions[0], id: 'zzz', indicatif: 'XAFR', immat: '', type: '' }] }, 'afr')
    expect(r[0].titre).toBe('AFR1234')
  })
  it('limite le nombre par type', () => {
    const sats = Array.from({ length: 50 }, (_, i) => ({ ...d.satellites[0], id: String(i), nom: `STARLINK-${i}` }))
    expect(chercher({ ...d, satellites: sats }, 'starlink')).toHaveLength(12)
  })
})
