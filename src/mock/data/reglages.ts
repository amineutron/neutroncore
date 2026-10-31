// Démo : sauvegarde / restauration des réglages et journal d'audit (données fictives, rien n'est écrit).
import type { MockHandler } from '../router'

const il = (min: number) => new Date(Date.now() - min * 60_000).toISOString().replace(/\.\d+Z$/, 'Z')

const ENTREES = [
  { ts: il(3), ip: '127.0.0.1', reseau: 'ce pc', kind: 'action', methode: 'ACTION', action: '/tv/source?source=hdmi1', detail: '', status: 200, ok: true, sensible: false },
  { ts: il(14), ip: '<IP_TAILSCALE>', reseau: 'tailnet', kind: 'action', methode: 'ACTION', action: '/notifications (vidé)', detail: '', status: 200, ok: true, sensible: true },
  { ts: il(31), ip: '<IP_TAILSCALE>', reseau: 'tailnet', kind: 'action', methode: 'ACTION', action: '/ressources/ollama/decharger a:1', detail: '', status: 200, ok: true, sensible: true },
  { ts: il(58), ip: '192.0.2.44', reseau: 'autre', kind: 'auth', methode: 'AUTH', action: '/launcher/sessions', detail: 'AUTH_FAIL:INVALID_TOKEN', status: 401, ok: false, sensible: true },
  { ts: il(95), ip: '127.0.0.1', reseau: 'ce pc', kind: 'ecriture', methode: 'POST', action: '/camera/demarrer', detail: '', status: 200, ok: true, sensible: false },
  { ts: il(240), ip: '127.0.0.1', reseau: 'ce pc', kind: 'action', methode: 'ACTION', action: '/services/vms/test/force_stop', detail: 'moteur indisponible', status: 500, ok: false, sensible: true },
  { ts: il(600), ip: '<IP_TAILSCALE>', reseau: 'tailnet', kind: 'ecriture', methode: 'PUT', action: '/camera/reglages', detail: '', status: 200, ok: true, sensible: false },
]

const SECTIONS = [
  { id: 'automatisations', libelle: 'automatisations', statut: 'different', erreurs: [], diff: [
    { chemin: 'automations.a1.cooldown_min', genre: 'change', avant: 10, apres: 30 },
    { chemin: 'automations.b2', genre: 'ajoute', avant: null, apres: '{"nom":"couper la tv la nuit"}' }] },
  { id: 'camera', libelle: 'camera (fond, detourage)', statut: 'identique', erreurs: [], diff: [] },
  { id: 'lumiere', libelle: 'lumiere 3d (pad, sets, reglages communs)', statut: 'invalide', erreurs: ['spatial.json : `scenes` doit etre de type array'], diff: [] },
]

export const reglages: [string, string, MockHandler][] = [
  ['GET', '/reglages/inventaire', () => ({
    version: 1, local_exclus: ['neutroncore_api_key'],
    sections: [],
    entrees: [
      { nom: 'automations.json', classe: 'configuration', raison: 'historique et reperes d\'execution exclus', section: 'automatisations' },
      { nom: 'camera.json', classe: 'configuration', raison: 'camera (fond, detourage)', section: 'camera' },
      { nom: 'notifications.json', classe: 'etat jetable', raison: 'fil de notifications', section: null },
      { nom: 'qbt-password.cred', classe: 'secret', raison: 'nom de secret : jamais exporte', section: null },
    ],
  })],
  ['POST', '/reglages/export', ({ body }) => ({
    format: 'neutroncore-reglages', version: 1, cree_le: il(0), local: (body as { local?: Record<string, string> }).local ?? {},
    sections: { camera: { fond: { mode: 'aucun' }, cadence: 60 } }, absentes: [], masques: [], avertissements: [],
  })],
  ['POST', '/reglages/import/apercu', () => ({ valide: true, erreurs: [], sections: SECTIONS, local: null })],
  ['POST', '/reglages/import/appliquer', () => ({
    succes: false, erreurs: [], sauvegarde: null, local: {}, avertissements_local: [],
    resultats: [{ id: 'demo', ok: false, message: 'mode démo : rien n’est écrit' }],
  })],
  ['GET', '/reglages/sauvegardes', () => ({ sauvegardes: [
    { nom: '20261019-221500', motif: 'avant import', cree_le: '2026-10-19T22:15:00', sections: ['automatisations', 'camera'] },
  ] })],
  ['POST', '/reglages/sauvegardes/:nom/restaurer', () => ({ succes: false, erreurs: [], sauvegarde: null, resultats: [{ id: 'demo', ok: false, message: 'mode démo' }] })],
  ['GET', '/audit/journal', ({ query }) => {
    const kinds = (query.get('kinds') ?? '').split(',').filter(Boolean)
    const res = query.get('resultat')
    const texte = (query.get('texte') ?? '').toLowerCase()
    const entrees = ENTREES.filter((e) =>
      (!kinds.length || kinds.includes(e.kind)) && (res !== 'ok' || e.ok) && (res !== 'echec' || !e.ok) &&
      (query.get('sensible') !== '1' || e.sensible) && (!texte || e.action.toLowerCase().includes(texte)))
    return {
      entrees, tronque: false, partiel: false, octets_lus: 0, taille: 0,
      resume: {
        total: entrees.length, echecs: entrees.filter((e) => !e.ok).length, sensibles: entrees.filter((e) => e.sensible).length,
        par_kind: { action: entrees.filter((e) => e.kind === 'action').length, ecriture: entrees.filter((e) => e.kind === 'ecriture').length, auth: entrees.filter((e) => e.kind === 'auth').length },
        top_actions: [],
      },
    }
  }],
]
