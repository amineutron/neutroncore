// God Eye : types des couches et des objets affichés (logique pure, testée dans filtres.test.ts).
import type { Seisme } from '../vueMonde'

export type CoucheId = 'seismes' | 'avions' | 'satellites' | 'navires' | 'evenements' | 'infos' | 'cyber'
export const COUCHES: { id: CoucheId; nom: string; source: string }[] = [
  { id: 'infos', nom: 'actualités', source: 'flux de presse et de veille' },
  { id: 'seismes', nom: 'séismes', source: 'USGS' },
  { id: 'avions', nom: 'avions', source: 'adsb.lol' },
  { id: 'satellites', nom: 'satellites', source: 'CelesTrak' },
  { id: 'navires', nom: 'navires', source: 'Digitraffic (Baltique)' },
  { id: 'evenements', nom: 'événements', source: 'NASA EONET' },
  { id: 'cyber', nom: 'cyber', source: 'CERT-FR' },
]

export type Ton = 'ok' | 'warn' | 'crit' | 'info'

export type Avion = {
  id: string; indicatif: string; immat: string; type: string; alt: number; sol: boolean
  vitesse: number; cap: number; lat: number; lon: number; squawk: string; urgence: boolean; militaire: boolean
}
export type Navire = { id: string; vitesse: number; cap: number; lat: number; lon: number; statut: number | null; t: number | null }
export type Satellite = { id: string; nom: string; groupe: GroupeSat; lon: number; lat: number; altKm: number; vitesseKms: number }
export type Evenement = { id: string; titre: string; categorie: string; lon: number; lat: number; t: number; lien: string }

export type Theme = 'guerre' | 'diplomatie' | 'economie' | 'cyber' | 'securite' | 'catastrophe' | 'monde'
export const THEMES: { id: Theme; nom: string; lettre: string }[] = [
  { id: 'guerre', nom: 'guerre', lettre: 'G' },
  { id: 'diplomatie', nom: 'diplomatie', lettre: 'D' },
  { id: 'economie', nom: 'économie', lettre: 'E' },
  { id: 'cyber', nom: 'cyber', lettre: 'C' },
  { id: 'securite', nom: 'sécurité', lettre: 'S' },
  { id: 'catastrophe', nom: 'catastrophes', lettre: 'N' },
  { id: 'monde', nom: 'monde', lettre: '.' },
]
export type NiveauInfo = 'info' | 'warn' | 'crit'
export type Info = {
  id: string; titre: string; resume: string; lien: string; source: string; sourceNom: string; t: number
  theme: Theme; niveau: NiveauInfo; pays: string | null; lat: number | null; lon: number | null
}
export type SourceInfo = { id: string; nom: string; ok: boolean; n: number }
export type Marche = { symbole: string; nom: string; prix: number; variation_pct: number; devise: string }
export type Faille = { cve: string; editeur: string; produit: string; nom: string; ajoutee: string; rancongiciel: boolean; lien: string }

export type GroupeSat = 'stations' | 'visual' | 'weather' | 'gps-ops' | 'galileo' | 'geo' | 'starlink'
export const GROUPES_SAT: { id: GroupeSat; nom: string }[] = [
  { id: 'stations', nom: 'stations (ISS, Tiangong)' },
  { id: 'visual', nom: '100 plus brillants' },
  { id: 'weather', nom: 'météo' },
  { id: 'gps-ops', nom: 'GPS' },
  { id: 'galileo', nom: 'Galileo' },
  { id: 'geo', nom: 'géostationnaires' },
  { id: 'starlink', nom: 'Starlink (600 premiers)' },
]

export const CATEGORIES_EVENEMENT: { id: string; nom: string; ton: Ton }[] = [
  { id: 'wildfires', nom: 'incendies', ton: 'crit' },
  { id: 'volcanoes', nom: 'volcans', ton: 'crit' },
  { id: 'severeStorms', nom: 'tempêtes', ton: 'warn' },
  { id: 'floods', nom: 'inondations', ton: 'warn' },
  { id: 'drought', nom: 'sécheresses', ton: 'info' },
  { id: 'landslides', nom: 'glissements', ton: 'warn' },
  { id: 'seaLakeIce', nom: 'glaces', ton: 'info' },
  { id: 'tempExtremes', nom: 'températures extrêmes', ton: 'warn' },
  { id: 'dustHaze', nom: 'poussières, brume', ton: 'info' },
  { id: 'snow', nom: 'neige', ton: 'info' },
]

export type Donnees = {
  seismes: Seisme[]; avions: Avion[]; navires: Navire[]; satellites: Satellite[]; evenements: Evenement[]; infos: Info[]
  /** Heure (ms) à laquelle la liste d'avions / de navires a été relevée : sert à extrapoler leur position. */
  releveAvions: number; releveNavires: number
}
export const DONNEES_VIDES: Donnees = { seismes: [], avions: [], navires: [], satellites: [], evenements: [], infos: [], releveAvions: 0, releveNavires: 0 }

/** Ce que la carte dessine : un point, sa nature, son importance. Produit par `appliquer` (filtres compris). */
export type Objet = {
  id: string; couche: CoucheId; lon: number; lat: number
  /** Cap en degrés (avions, navires) ; absent pour les autres. */
  cap?: number
  ton: Ton
  /** Rayon en pixels pour les ronds ; demi-taille pour les icônes. */
  rayon: number
  titre: string; detail: string
  /** Horodatage (ms) de l'observation, quand la source en donne un. */
  t?: number
  lien?: string
  /** Sous-type utile au dessin (catégorie d'événement, avion militaire...). */
  sorte?: string
}

export type Boite = { sud: number; ouest: number; nord: number; est: number }
