// Réseau de démonstration : appareils fictifs (adresses de documentation), tailnet inventé,
// débit qui varie un peu. Nommer / oublier un appareil est retenu jusqu'au rechargement.
import type { Appareil, EtatReseau, Liens, Point, Tailnet } from '../../lib/reseau'
import type { MockHandler } from '../router'

const now = () => Date.now() / 1000
const A = (mac: string, ip: string, fabricant: string, p: Partial<Appareil> = {}): Appareil => ({
  mac, ip, fabricant, present: true, etat: 'REACHABLE', connu: false, nom: '', etiquette: '', passerelle: false,
  premiere_vue: now() - 86400 * 30, derniere_vue: now(), aleatoire: false, ...p,
})

let appareils: Appareil[] = [
  A('02:00:5e:00:00:01', '192.0.2.1', 'Fabricant Box', { connu: true, nom: 'box internet', etiquette: 'box', passerelle: true }),
  A('02:00:5e:00:00:10', '192.0.2.20', 'Fabricant Télé', { connu: true, nom: 'tv du salon', etiquette: 'tv' }),
  A('02:00:5e:00:00:11', '192.0.2.21', 'Fabricant Ampli', { connu: true, nom: 'ampli', etiquette: 'enceinte', present: false, etat: '', derniere_vue: now() - 3 * 3600 }),
  A('02:00:5e:00:00:30', '192.0.2.40', 'Fabricant Lampes', { connu: true, nom: 'pont hue', etiquette: 'lampe' }),
  A('02:00:5e:00:00:50', '192.0.2.77', '', { aleatoire: true, premiere_vue: now() - 600 }),
  A('02:00:5e:00:00:51', '192.0.2.78', 'Fabricant Inconnu SA', { premiere_vue: now() - 4000 }),
]
let reglages: EtatReseau['reglages'] = { alerte: true, cible_internet: '', ignorer_interfaces: [] }

const resume = (): EtatReseau['resume'] => {
  const presents = appareils.filter((a) => a.present)
  return { presents: presents.length, inconnus: presents.filter((a) => !a.connu).length, connus_absents: appareils.filter((a) => a.connu && !a.present).length, total: appareils.length }
}

const tailnet: Tailnet = {
  etat: 'running', nom: 'exemple.ts.net', en_ligne: 2,
  pairs: [
    { nom: 'pc-bureau', os: 'linux', en_ligne: true, derniere_vue: null, ips: ['100.64.0.1'], relais: '', direct: true, sortie: false, soi: true, etiquettes: [], actif: true },
    { nom: 'serveur-maison', os: 'linux', en_ligne: true, derniere_vue: null, ips: ['100.64.0.2'], relais: '', direct: true, sortie: true, soi: false, etiquettes: [], actif: false },
    { nom: 'telephone', os: 'android', en_ligne: false, derniere_vue: now() - 5400, ips: ['100.64.0.3'], relais: 'par', direct: false, sortie: false, soi: false, etiquettes: [], actif: false },
  ],
}

const historique: Point[] = Array.from({ length: 60 }, (_, i) => ({
  t: now() - (60 - i) * 5, rx: 20000 + 15000 * Math.abs(Math.sin(i / 7)), tx: 6000 + 4000 * Math.abs(Math.cos(i / 5)),
  passerelle_ms: 1.1 + (i % 7) * 0.05, internet_ms: 8 + (i % 11) * 0.4,
}))

export const reseau: [string, string, MockHandler][] = [
  ['GET', '/reseau', (): EtatReseau => ({ appareils, resume: resume(), reglages, interface: 'eth0', oui_charge: true, cible_internet_defaut: 'exemple.org' })],
  ['PUT', '/reseau/connus/:mac', ({ params, body }) => {
    const b = body as { nom?: string; etiquette?: string }
    appareils = appareils.map((a) => (a.mac === params.mac ? { ...a, connu: true, nom: b.nom ?? '', etiquette: b.etiquette ?? '' } : a))
    return { success: true }
  }],
  ['DELETE', '/reseau/connus/:mac', ({ params }) => {
    appareils = appareils.map((a) => (a.mac === params.mac ? { ...a, connu: false, nom: '', etiquette: '' } : a))
    return { success: true }
  }],
  ['PUT', '/reseau/reglages', ({ body }) => { reglages = { ...reglages, ...(body as object) }; return { success: true, reglages } }],
  ['GET', '/reseau/tailnet', () => tailnet],
  ['GET', '/reseau/liens', (): Liens => {
    const h = historique.slice(1).concat({ ...historique[historique.length - 1], t: now(), rx: 20000 + Math.random() * 30000, tx: 6000 + Math.random() * 6000 })
    historique.splice(0, historique.length, ...h)
    const p = h[h.length - 1]
    return {
      interface: 'eth0', debit: { rx: p.rx, tx: p.tx }, cible_internet: 'exemple.org', historique: h,
      passerelle: { min: 1.0, moy: p.passerelle_ms, max: 1.4, gigue: 0.1, perte: 0 },
      internet: { min: 7.5, moy: p.internet_ms, max: 11.2, gigue: 0.9, perte: 0 },
    }
  }],
]
