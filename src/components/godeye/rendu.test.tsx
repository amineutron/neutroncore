// God Eye : tests de rendu légers (renderToString, sans navigateur ni jsdom). On vérifie que chaque composant se rend
// sans exception, avec ses textes clés et ses boutons, et qu'aucune valeur brute (undefined, NaN) ne fuit dans le HTML.
// Limite : renderToString n'exécute ni effets ni gestes ; les états qui en dépendent sont couverts par les tests de logique.
import type { ReactElement } from 'react'
import { renderToString as rendreBrut } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// useReglagesCarte n'a pas de getServerSnapshot (inutile dans le navigateur) : on le remplace par les valeurs d'origine pour le rendu serveur.
vi.mock('../../lib/godeye/carteStore', async (importOriginal) => {
  const m = await importOriginal<typeof import('../../lib/godeye/carteStore')>()
  const { REGLAGES_CARTE_DEFAUT } = await import('../../lib/godeye/apparence')
  return { ...m, useReglagesCarte: () => REGLAGES_CARTE_DEFAUT }
})

/** React sépare les textes dynamiques par des commentaires `<!-- -->` : on les retire pour chercher des phrases entières. */
const renderToString = (el: ReactElement): string => rendreBrut(el).replaceAll('<!-- -->', '').replaceAll('&#x27;', '\'')
import { ELEMENTS, ELEMENTS_DEFAUT } from '../../lib/godeye/elements'
import { FILTRES_DEFAUT } from '../../lib/godeye/filtres'
import { pastille, type Pastille } from '../../lib/godeye/fraicheur'
import { DONNEES_VIDES, type Avion, type Donnees, type Navire, type Objet, type Satellite } from '../../lib/godeye/modele'
import type { Suivi } from '../../lib/godeye/suivi'
import { ZONES_MAX, zoneVide, type Zone } from '../../lib/godeye/zones'
import { Fiche } from './Fiche'
import { Fraicheur } from './Fraicheur'
import { PanneauReglages } from './PanneauReglages'
import { Recherche } from './Recherche'
import { Resume } from './Resume'
import { Suivis } from './Suivis'
import { ZoneEditeur } from './ZoneEditeur'
import { Zones } from './Zones'
import type { EtatZones } from './useZones'

const sansValeurBrute = (html: string): void => {
  expect(html).not.toContain('undefined')
  expect(html).not.toContain('NaN')
  expect(html).not.toContain('[object')
}
const boutons = (html: string): string[] => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/gs)].map((m) => m[1].replace(/<[^>]+>/g, '').trim())

const MAINTENANT = Date.UTC(2026, 10, 8, 12, 0, 0)
const noop = (): void => {}

// ---------- PanneauReglages ----------
describe('PanneauReglages', () => {
  const rendre = (elements = ELEMENTS_DEFAUT): string => renderToString(<PanneauReglages f={FILTRES_DEFAUT} onChange={noop} elements={elements} onElements={noop} />)
  it('affiche les sections, un interrupteur par élément et les boutons de remise', () => {
    const html = rendre()
    for (const t of ['depuis combien de temps', 'éléments affichés', 'carte', 'historique', 'rotation automatique', 'remettre les durées d\'origine', 'tout réafficher', 'tout depuis', 'séismes']) expect(html).toContain(t)
    for (const e of ELEMENTS) expect(html).toContain(e.nom)
    sansValeurBrute(html)
  })
  it('compte les éléments masqués et active « tout réafficher »', () => {
    const html = rendre({ ...ELEMENTS_DEFAUT, halos: false, pictos: false })
    expect(html).toContain('2 masqués')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>tout réafficher/)
  })
  it('« tout réafficher » est grisé quand rien n\'est masqué', () => {
    expect(rendre()).toMatch(/<button[^>]*disabled=""[^>]*>tout réafficher/)
  })
})

// ---------- Zones / ZoneEditeur ----------
const zone = (i: number, p: Partial<Zone> = {}): Zone => ({
  id: `z${i}`, nom: `zone numéro ${i}`, forme: 'cercle', centre: { lat: 50, lon: 2 }, rayon_km: 80, objets: ['navire', 'avion'], actif: true, notifier: false, ...p,
})
const etat = (zones: Zone[], p: Partial<EtatZones> = {}): EtatZones => ({
  zones, chargees: true, erreur: '', occupe: false, brouillon: null, setBrouillon: noop,
  enregistrer: async () => true, basculer: async () => {}, supprimer: async () => true,
  dessinees: zones, complet: zones.length >= ZONES_MAX, ...p,
})
const centre = () => ({ lat: 48, lon: 2 })

describe('Zones', () => {
  it('liste vide : message d\'invite et bouton de création actif', () => {
    const html = renderToString(<Zones etat={etat([])} centreVue={centre} />)
    expect(html).toContain('0 / 10 zones')
    expect(html).toContain('Aucune zone surveillée')
    expect(boutons(html)).toContain('nouvelle zone')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>nouvelle zone/)
    sansValeurBrute(html)
  })
  it('deux zones : nom, résumé, interrupteurs et actions', () => {
    const html = renderToString(<Zones etat={etat([zone(1), zone(2, { actif: false, notifier: true, forme: 'rect', bbox: { s: 30, w: 135, n: 42, e: 146 }, rayon_km: undefined })])} centreVue={centre} />)
    expect(html).toContain('2 / 10 zones')
    expect(html).toContain('zone numéro 1')
    expect(html).toContain('zone numéro 2')
    expect(html).toContain('active')
    expect(html).toContain('en pause')
    expect(html).toContain('muette')
    expect(html).toContain('notifie')
    expect(boutons(html).filter((b) => b === 'modifier')).toHaveLength(2)
    expect(boutons(html).filter((b) => b === 'supprimer')).toHaveLength(2)
    expect(html).not.toContain('Aucune zone surveillée')
    sansValeurBrute(html)
  })
  it('limite 10 / 10 : création désactivée et explication', () => {
    const dix = Array.from({ length: ZONES_MAX }, (_, i) => zone(i))
    const html = renderToString(<Zones etat={etat(dix)} centreVue={centre} />)
    expect(html).toContain('10 / 10 zones')
    expect(html).toContain('Limite atteinte')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>nouvelle zone/)
    sansValeurBrute(html)
  })
  it('erreur et chargement', () => {
    expect(renderToString(<Zones etat={etat([], { erreur: 'zones indisponibles (hors ligne)' })} centreVue={centre} />)).toContain('zones indisponibles')
    expect(renderToString(<Zones etat={etat([], { chargees: false })} centreVue={centre} />)).toContain('chargement des zones')
  })
})

describe('ZoneEditeur', () => {
  it('ne rend rien sans brouillon', () => {
    expect(renderToString(<ZoneEditeur etat={etat([])} centreVue={centre} />)).toBe('')
  })
  it('nouvelle zone cercle valide : champs, forme, objets et bouton créer', () => {
    const b = { ...zoneVide(48.85, 2.35), nom: 'port' }
    const html = renderToString(<ZoneEditeur etat={etat([], { brouillon: b })} centreVue={centre} />)
    for (const t of ['nouvelle zone', 'cercle', 'rectangle', 'placer au centre de la vue', 'latitude', 'longitude', 'rayon', 'objets surveillés', 'annuler', 'créer la zone']) expect(html).toContain(t)
    expect(html).not.toContain('role="alert"')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>créer la zone/)
    sansValeurBrute(html)
  })
  it('nom vide : erreurs affichées et création bloquée', () => {
    const html = renderToString(<ZoneEditeur etat={etat([], { brouillon: zoneVide() })} centreVue={centre} />)
    expect(html).toContain('role="alert"')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>créer la zone/)
    sansValeurBrute(html)
  })
  it('zone rectangle existante : bords et bouton enregistrer', () => {
    const z = zone(1, { forme: 'rect', bbox: { s: 30, w: 135, n: 42, e: 146 }, rayon_km: undefined })
    const html = renderToString(<ZoneEditeur etat={etat([z], { brouillon: z })} centreVue={centre} />)
    for (const t of ['modifier la zone', 'nord', 'sud', 'ouest', 'est', 'refaire le rectangle autour du centre', 'enregistrer']) expect(html).toContain(t)
    sansValeurBrute(html)
  })
})

// ---------- Fraicheur ----------
describe('Fraicheur', () => {
  const base = { charge: true, erreur: '', maj: MAINTENANT - 5_000 }
  const verte = pastille({ couche: 'avions', actif: true, etat: base, maintenant: MAINTENANT })
  const orange = pastille({ couche: 'avions', actif: true, etat: { ...base, maj: MAINTENANT - 600_000 }, maintenant: MAINTENANT })
  const rouge = pastille({ couche: 'navires', actif: true, etat: { ...base, erreur: 'HTTP 500' }, maintenant: MAINTENANT })
  const coupee = pastille({ couche: 'seismes', actif: false, etat: base, maintenant: MAINTENANT })
  it('les trois tons produisent leur classe et leur texte', () => {
    expect([verte.ton, orange.ton, rouge.ton]).toEqual(['ok', 'warn', 'crit'])
    const html = renderToString(<Fraicheur pastilles={[verte, orange, rouge]} />)
    expect(html).toContain('ge-fr ok')
    expect(html).toContain('ge-fr warn perime')
    expect(html).toContain('ge-fr crit perime')
    expect(html).toContain('il y a 5 s')
    expect(html).toContain('en retard')
    expect(html).toContain('source en panne')
    expect(html).toContain('<b>avions</b>')
    expect(html).toContain('<b>navires</b>')
    sansValeurBrute(html)
  })
  it('une couche coupée est masquée ; rien d\'allumé = rien rendu', () => {
    expect(renderToString(<Fraicheur pastilles={[coupee, verte]} />)).not.toContain('séismes')
    expect(renderToString(<Fraicheur pastilles={[coupee]} />)).toBe('')
    expect(renderToString(<Fraicheur pastilles={[] as Pastille[]} />)).toBe('')
  })
})

// ---------- Resume ----------
describe('Resume', () => {
  it('rendu serveur (sans effet) : aucune exception, rien d\'affiché avant l\'arrivée des données', () => {
    expect(renderToString(<Resume heures={12} />)).toBe('')
  })
})

// ---------- Fiche ----------
const avion: Avion = { id: '3944ee', indicatif: 'AFR1234', immat: 'F-HBNA', type: 'A320', alt: 36000, sol: false, vitesse: 452, cap: 78, lat: 47.1, lon: 4.2, squawk: '1000', urgence: false, militaire: false, helico: false }
const navire: Navire = { id: '230123456', vitesse: 12.4, cap: 80, lat: 59.9, lon: 24.2, statut: 0, t: null }
const sat: Satellite = { id: '25544', nom: 'ISS (ZARYA)', groupe: 'stations', lon: 10, lat: 20, altKm: 420, vitesseKms: 7.66 }
const donnees: Donnees = { ...DONNEES_VIDES, avions: [avion], navires: [navire], satellites: [sat], releveAvions: MAINTENANT - 4000, releveNavires: MAINTENANT - 30_000 }
const objet = (p: Partial<Objet>): Objet => ({ id: 'x:1', couche: 'avions', lon: 0, lat: 0, ton: 'info', rayon: 4, titre: 'objet', detail: '', ...p })
const propsFiche = (o: Objet, suivi: Suivi | null = null) => ({
  objet: o, donnees, maintenant: MAINTENANT, suivi, centre: false,
  onMarquer: noop, onRetirer: noop, onCentrer: noop, onGarderAuCentre: noop, onFermer: noop,
})

describe('Fiche', () => {
  it('avion : lignes de vol, boutons de suivi', () => {
    const html = renderToString(<Fiche {...propsFiche(objet({ id: 'avi:3944ee', couche: 'avions', titre: 'AFR1234', lat: 47.1, lon: 4.2 }))} />)
    for (const t of ['avion', 'AFR1234', 'A320 (F-HBNA)', 'altitude', 'vitesse', 'cap', 'adsb.lol', 'position', 'centrer', 'garder au centre', 'marquer', 'fermer']) expect(html).toContain(t)
    expect(html).toContain('trace de ses positions depuis la sélection')
    sansValeurBrute(html)
  })
  it('navire : MMSI et statut', () => {
    const html = renderToString(<Fiche {...propsFiche(objet({ id: 'nav:230123456', couche: 'navires', titre: 'navire 230123456', lat: 59.9, lon: 24.2 }))} />)
    for (const t of ['navire', 'MMSI', '230123456', 'en route au moteur', 'nœuds', 'Digitraffic', 'marquer']) expect(html).toContain(t)
    sansValeurBrute(html)
  })
  it('satellite : orbite et trace permanente', () => {
    const html = renderToString(<Fiche {...propsFiche(objet({ id: 'sat:25544', couche: 'satellites', titre: 'ISS (ZARYA)', lat: 20, lon: 10 }))} />)
    for (const t of ['satellite', 'ISS (ZARYA)', 'numéro NORAD', 'station spatiale', 'km/s', 'trace des dernières minutes affichée en permanence', 'marquer']) expect(html).toContain(t)
    sansValeurBrute(html)
  })
  it('objet déjà marqué : « ne plus marquer » et nombre de positions', () => {
    const suivi: Suivi = { id: '3944ee', type: 'avion', nom: 'AFR1234', depuis: MAINTENANT - 120_000, points: [{ t: MAINTENANT - 60_000, lon: 4, lat: 47 }, { t: MAINTENANT, lon: 4.2, lat: 47.1 }] }
    const html = renderToString(<Fiche {...propsFiche(objet({ id: 'avi:3944ee', couche: 'avions', titre: 'AFR1234' }), suivi)} />)
    expect(html).toContain('ne plus marquer')
    expect(html).toContain('2 positions enregistrées')
    expect(boutons(html)).not.toContain('marquer')
    sansValeurBrute(html)
  })
  it('séisme : pas de boutons de suivi, lien source', () => {
    const html = renderToString(<Fiche {...propsFiche(objet({ id: 'sei:1', couche: 'seismes', titre: 'M 5.6', detail: 'Îles Kouriles', t: MAINTENANT - 3_600_000, lien: 'https://example.org/q' }))} />)
    expect(html).toContain('séisme')
    expect(html).toContain('Îles Kouriles')
    expect(boutons(html)).not.toContain('garder au centre')
    expect(html).toContain('rel="noopener noreferrer"')
    sansValeurBrute(html)
  })
})

// ---------- Recherche ----------
describe('Recherche', () => {
  it('requête vide : champ, filtres par type et invite (le texte saisi vit dans un état interne)', () => {
    const html = renderToString(<Recherche donnees={donnees} onChoisir={noop} />)
    expect(html).toContain('aria-label="chercher"')
    for (const t of ['avions', 'navires', 'satellites', 'séismes', 'événements', 'actualités', 'pays']) expect(html).toContain(t)
    expect(html).toContain('Taper au moins 2 lettres')
    expect(html).not.toContain('aucun résultat')
    sansValeurBrute(html)
  })
})

// ---------- Suivis ----------
describe('Suivis', () => {
  it('liste vide : invite', () => {
    const html = renderToString(<Suivis suivis={[]} maintenant={MAINTENANT} onVoir={noop} onRetirer={noop} />)
    expect(html).toContain('Aucun objet marqué')
    expect(html).not.toContain('<button')
    sansValeurBrute(html)
  })
  it('deux lignes : nom, positions, distance et retrait', () => {
    const suivis: Suivi[] = [
      { id: '3944ee', type: 'avion', nom: 'AFR1234', depuis: MAINTENANT - 600_000, points: [{ t: 1, lon: 0, lat: 0 }, { t: 2, lon: 1, lat: 0 }] },
      { id: '25544', type: 'satellite', nom: 'ISS (ZARYA)', depuis: MAINTENANT - 60_000, points: [{ t: 1, lon: 0, lat: 0 }] },
    ]
    const html = renderToString(<Suivis suivis={suivis} maintenant={MAINTENANT} onVoir={noop} onRetirer={noop} />)
    expect(html).toContain('2 / 20 objets marqués')
    expect(html).toContain('AFR1234')
    expect(html).toContain('ISS (ZARYA)')
    expect(html).toContain('2 positions')
    expect(html).toContain('1 position')
    expect(html).toContain('111 km')
    expect(boutons(html).filter((b) => b === 'retirer')).toHaveLength(2)
    expect(html).toContain('aria-label="ne plus marquer AFR1234"')
    sansValeurBrute(html)
  })
})
