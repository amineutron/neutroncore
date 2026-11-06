// Données de démo de God Eye : avions, navires et vues enregistrées passent par l'API ; séismes, satellites et
// événements sont lus directement par le navigateur, donc remplacés ici par des jeux fictifs (aucune requête en démo).
import type { MockHandler } from '../router'
import type { Evenement } from '../../lib/godeye/modele'

const avions = [
  { id: '3944ee', indicatif: 'AFR1234', immat: 'F-HBNA', type: 'A320', alt: 36000, sol: false, vitesse: 452, cap: 78, lat: 47.1, lon: 4.2, squawk: '1000', urgence: false, militaire: false },
  { id: '4b1814', indicatif: 'SWR88', immat: 'HB-JNA', type: 'A220', alt: 31000, sol: false, vitesse: 430, cap: 250, lat: 46.3, lon: 8.4, squawk: '2301', urgence: false, militaire: false },
  { id: '3f5407', indicatif: 'GAF741', immat: '15+10', type: 'A21N', alt: 37000, sol: false, vitesse: 467, cap: 63, lat: 52.9, lon: 12.6, squawk: '6234', urgence: false, militaire: true },
  { id: 'ae1449', indicatif: 'RCH5040', immat: '05-5139', type: 'C17', alt: 28000, sol: false, vitesse: 440, cap: 95, lat: 49.2, lon: -2.1, squawk: '6230', urgence: false, militaire: true },
  { id: '06a1b2', indicatif: 'QTR77', immat: 'A7-BEQ', type: 'B77W', alt: 39000, sol: false, vitesse: 510, cap: 120, lat: 41.4, lon: 28.7, squawk: '7700', urgence: true, militaire: false },
  { id: 'a0b1c2', indicatif: 'DAL401', immat: 'N301DN', type: 'B764', alt: 34000, sol: false, vitesse: 480, cap: 70, lat: 45.0, lon: -40.0, squawk: '1000', urgence: false, militaire: false },
]
const navires = [
  { id: '230123456', vitesse: 12.4, cap: 80, lat: 59.9, lon: 24.2, statut: 0, t: null },
  { id: '230987654', vitesse: 0.2, cap: 0, lat: 60.15, lon: 24.95, statut: 5, t: null },
  { id: '276001234', vitesse: 17.8, cap: 250, lat: 59.5, lon: 22.8, statut: 0, t: null },
]
const vues: { id: string; nom: string; filtres: unknown; camera: unknown; at: number }[] = [
  { id: 'demovue0001', nom: 'ciel europe', at: 0, camera: { cx: 10, cy: 48, zoom: 4 },
    filtres: { couches: { seismes: false, avions: true, satellites: false, navires: false, evenements: false, cyber: false }, avions: { altMin: 25000 } } },
]

export const evenementsDemo = (maintenant = Date.now()): Evenement[] => [
  { id: 'EONET_d1', titre: 'Incendie de forêt, Californie', categorie: 'wildfires', lon: -120.4, lat: 38.3, t: maintenant - 86_400_000, lien: '' },
  { id: 'EONET_d2', titre: 'Volcan Etna, Italie', categorie: 'volcanoes', lon: 15.0, lat: 37.75, t: maintenant - 3 * 86_400_000, lien: '' },
  { id: 'EONET_d3', titre: 'Tempête tropicale, Atlantique', categorie: 'severeStorms', lon: -45.0, lat: 18.0, t: maintenant - 2 * 86_400_000, lien: '' },
  { id: 'EONET_d4', titre: 'Inondations, Bangladesh', categorie: 'floods', lon: 90.4, lat: 23.8, t: maintenant - 6 * 86_400_000, lien: '' },
]

/** Éléments orbitaux de l'ISS (jeu d'exemple connu) : un seul objet suffit à montrer la couche en démo. */
export const tleDemo = (): string => `ISS (ZARYA)
1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537
`

const HEURE = 3_600_000
/** Actualités fictives, au format de GET /godeye/infos (thèmes, niveaux et lieux variés pour montrer les filtres). */
export function infosDemo(maintenant = Date.now()) {
  const a = (id: string, titre: string, source: string, h: number, theme: string, niveau: string, pays: string | null, lat: number | null, lon: number | null) => ({
    id, titre, resume: '', lien: `https://exemple.org/${id}`, source, source_nom: source, t: maintenant - h * HEURE, theme, niveau, pays, lat, lon,
  })
  return {
    infos: [
      a('d1', 'Frappes de missiles sur Kharkiv : plusieurs morts', 'lemonde', 1, 'guerre', 'crit', 'Ukraine', 49.0, 32.0),
      a('d2', 'Sommet à Oslo : nouveau cycle de négociations', 'guardian', 2, 'diplomatie', 'info', 'Ukraine', 49.0, 32.0),
      a('d3', 'Nouvelles sanctions de l\'UE contre l\'Iran', 'france24', 3, 'diplomatie', 'warn', 'Iran', 32.4, 53.7),
      a('d4', 'La BCE maintient ses taux directeurs', 'ecb', 4, 'economie', 'info', 'Francfort (BCE)', 50.11, 8.68),
      a('d5', 'Rançongiciel : un hôpital paralysé en Allemagne', 'bleeping', 5, 'cyber', 'warn', 'Allemagne', 51.2, 10.4),
      a('d6', 'Exercice naval chinois près de Taïwan', 'usni', 6, 'guerre', 'warn', 'Taiwan', 23.7, 121.0),
      a('d7', 'Le pétrole recule après la réunion de l\'OPEP', 'cnbc', 7, 'economie', 'info', null, null, null),
      a('d8', 'Inondations meurtrières au Bangladesh', 'reliefweb', 8, 'catastrophe', 'crit', 'Bangladesh', 23.7, 90.4),
      a('d9', 'Manifestations et couvre-feu à Port-au-Prince', 'aljazeera', 9, 'securite', 'warn', 'Haiti', 19.0, -72.3),
    ],
    flux: ['lemonde', 'guardian', 'france24', 'ecb', 'bleeping', 'usni', 'cnbc', 'reliefweb', 'aljazeera'].map((id) => ({ id, nom: id, ok: true, n: 1, erreur: '' })),
    t: maintenant,
  }
}

const marches = [
  { symbole: '^GSPC', nom: 'S&P 500', prix: 7711.6, variation_pct: 0.27, devise: 'USD' },
  { symbole: '^FCHI', nom: 'CAC 40', prix: 7838.5, variation_pct: -0.38, devise: 'EUR' },
  { symbole: 'CL=F', nom: 'Petrole WTI', prix: 98.1, variation_pct: -0.42, devise: 'USD' },
  { symbole: 'GC=F', nom: 'Or', prix: 4138.9, variation_pct: -0.51, devise: 'USD' },
  { symbole: 'BTC-USD', nom: 'Bitcoin', prix: 82723.6, variation_pct: 1.07, devise: 'USD' },
  { symbole: '^VIX', nom: 'VIX (volatilite)', prix: 17.7, variation_pct: -3.9, devise: '' },
]
const failles = {
  total: 1748,
  recentes: [
    { cve: 'CVE-2026-0001', editeur: 'Exemple', produit: 'Passerelle VPN', nom: 'Contournement d\'authentification', ajoutee: '2026-10-16', rancongiciel: true, lien: 'https://nvd.nist.gov/vuln/detail/CVE-2026-0001' },
    { cve: 'CVE-2026-0002', editeur: 'Demo', produit: 'Serveur web', nom: 'Traversée de répertoire', ajoutee: '2026-10-15', rancongiciel: false, lien: 'https://nvd.nist.gov/vuln/detail/CVE-2026-0002' },
  ],
}

const enregistrer: MockHandler = ({ body }) => {
  const b = (body ?? {}) as { id?: string; nom?: string; filtres?: unknown; camera?: unknown }
  const nom = String(b.nom ?? '').trim().slice(0, 40)
  if (!nom) throw new Error('nom de vue requis')
  const id = b.id ?? `demo${Math.random().toString(36).slice(2, 10)}`
  const reste = vues.filter((v) => v.id !== id && v.nom.toLowerCase() !== nom.toLowerCase())
  vues.length = 0
  vues.push(...reste, { id, nom, filtres: b.filtres ?? {}, camera: b.camera ?? null, at: Date.now() / 1000 })
  return { vues, id }
}

export const godeye: [string, string, MockHandler][] = [
  ['GET', '/godeye/avions', () => ({ avions, couvre: 'démo', t: Date.now(), tronque: false, source: 'démo' })],
  ['GET', '/godeye/navires', () => ({ navires, couvre: 'démo', t: Date.now(), tronque: false, source: 'démo' })],
  ['GET', '/godeye/infos', () => infosDemo()],
  ['GET', '/godeye/marches', () => ({ marches, t: Date.now(), source: 'démo' })],
  ['GET', '/godeye/failles', () => ({ ...failles, source: 'démo', t: Date.now() })],
  ['GET', '/godeye/vues', () => ({ vues })],
  ['PUT', '/godeye/vues', enregistrer],
  ['DELETE', '/godeye/vues/:id', ({ params }) => {
    const reste = vues.filter((v) => v.id !== params.id)
    vues.length = 0
    vues.push(...reste)
    return { vues }
  }],
]
