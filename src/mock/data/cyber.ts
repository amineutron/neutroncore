// Flux cyber de démonstration : avis inventés, aucune source réelle ni lampe. Les réglages se modifient
// et sont retenus jusqu'au rechargement. Non enregistré : voir INTEGRATION.md.
import type { MockHandler } from '../router'
import type { Avis, ConfigLumiere, ReglagesCyber } from '../../lib/cyber'

const now = () => Date.now() / 1000
const il = (h: number) => now() - h * 3600

let items: Avis[] = [
  { id: 'certfr-2026-ale-004', source: 'certfr', kind: 'alerte', title: 'Alerte : vulnérabilité critique dans un pare-feu (démo)', summary: 'Exploitation active constatée.', url: '', published: il(2), level: 'crit', matched: [], seen_at: il(2), lu: false },
  { id: 'certfr-2026-avi-0123', source: 'certfr', kind: 'avis', title: 'Multiples vulnérabilités dans Mozilla Firefox (démo)', summary: 'Exécution de code arbitraire à distance.', url: '', published: il(6), level: 'warn', matched: ['firefox'], seen_at: il(6), lu: false },
  { id: 'certfr-2026-avi-0122', source: 'certfr', kind: 'avis', title: 'Vulnérabilité dans le noyau Linux (démo)', summary: 'Élévation de privilèges.', url: '', published: il(30), level: 'info', matched: [], seen_at: il(30), lu: true },
  { id: 'shodan-demo-ports', source: 'shodan', kind: 'exposition', title: 'shodan : 1 port inattendu sur votre ip publique', summary: 'ports : 8080', url: '', published: il(12), level: 'warn', matched: [], seen_at: il(12), lu: false },
]
let lumiere: ConfigLumiere = {
  actif: false, niveau_min: 'crit', lampes: [], bri_max_pct: 40, duree_s: 120, silence: { debut: '23:00', fin: '07:00' },
  cooldown_s: 1800, confirmations: 2, couleurs: { warn: '#f6a01a', crit: '#e8243c' },
}
let reglages: Omit<ReglagesCyber, 'lumiere'> = { veille: ['Firefox'], ip_publique: '', ports_attendus: [], fenetre_h: 24 }

const niveau = () => (items.some((a) => !a.lu && a.level === 'crit') ? 'crit' : items.some((a) => !a.lu && a.level === 'warn') ? 'warn' : items.some((a) => !a.lu) ? 'info' : 'ok')

export const cyber: [string, string, MockHandler][] = [
  ['GET', '/cyber/reglages', () => ({ ...reglages, lumiere })],
  ['PUT', '/cyber/reglages', ({ body }) => {
    const b = (body ?? {}) as Partial<ReglagesCyber>
    const { lumiere: l, ...reste } = b
    reglages = { ...reglages, ...reste }
    if (l) lumiere = { ...lumiere, ...l }
    return { ...reglages, lumiere }
  }],
  ['GET', '/cyber/lampes', () => ({ lampes: [{ id: '1', name: 'salon plafond', reachable: true }, { id: '3', name: 'bureau', reachable: true }, { id: '4', name: 'ruban tv', reachable: false }] })],
  ['GET', '/cyber/lumiere', () => ({ config: lumiere, phase: 'repos', niveau_applique: '', niveau_courant: niveau(), restauration_en_attente: false, rampe_en_cours: false, journal: [] })],
  ['POST', '/cyber/lumiere/simuler', ({ body }) => {
    const b = (body ?? {}) as { niveau?: string; heure?: string; rampe?: boolean }
    const h = Number((b.heure ?? '12:00').slice(0, 2))
    const raison = lumiere.lampes.length === 0 ? 'aucune_lampe' : b.rampe ? 'rampe' : h >= 23 || h < 7 ? 'silence' : b.niveau === 'crit' ? 'nouveau' : 'sous_seuil'
    const ok = raison === 'nouveau'
    return { decision: { action: ok ? 'appliquer' : 'rien', raison, niveau: ok ? 'crit' : '' }, ordres: ok ? lumiere.lampes.map((id) => ({ outil: 'hue.set_color_rgb', arguments: { light_id: Number(id) } })) : [] }
  }],
  ['POST', '/cyber/lus', ({ body }) => {
    const ids = (body as { ids?: string[] | null })?.ids
    items = items.map((a) => (ids == null || ids.includes(a.id) ? { ...a, lu: true } : a))
    return { success: true }
  }],
  ['POST', '/cyber/sonder', () => ({ ajoutes: 0, erreurs: {}, sources: ['certfr'] })],
  ['GET', '/cyber', () => ({
    items, total: items.length, niveau: niveau(), non_lus: items.filter((a) => !a.lu).length,
    sources: [
      { source: 'certfr', active: true, raison: '', dernier: il(0.3), erreur: '', periode_s: 3600 },
      { source: 'shodan', active: false, raison: 'variable SHODAN_API_KEY absente', dernier: null, erreur: '', periode_s: 21600 },
      { source: 'greynoise', active: false, raison: 'variable GREYNOISE_API_KEY absente', dernier: null, erreur: '', periode_s: 21600 },
    ],
  })],
]
