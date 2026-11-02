// Securite de demonstration : donnees inventees (aucune valeur de secret, aucun vrai chemin prive).
import type { MockHandler } from '../router'

const maintenant = () => Date.now() / 1000

const ENTREES = [
  { d: 40, niveau: 3, unite: 'subtitle-ai.service', message: 'timeout apres 30 s sur la requete 4412' },
  { d: 130, niveau: 3, unite: 'subtitle-ai.service', message: 'timeout apres 45 s sur la requete 4409' },
  { d: 400, niveau: 4, unite: 'lyra-control-api.service', message: 'qBittorrent : reponse lente (2300 ms)' },
  { d: 900, niveau: 6, unite: 'lyra-daemon.service', message: 'session demarree' },
  { d: 1500, niveau: 3, unite: 'subtitle-ai.service', message: 'timeout apres 31 s sur la requete 4377' },
]

// ---- rotation generique (donnees inventees ; aucune valeur de secret) ----------------------------------------
const J = 86400
const CATALOGUE_ROT = {
  sondes: {
    http_basic: { libelle: 'adresse protégée par identifiant et mot de passe (HTTP basic)', champs: ['url', 'utilisateur', 'attendu'] },
    http_bearer: { libelle: 'adresse protégée par un jeton (en-tête Authorization)', champs: ['url', 'attendu'] },
    http_formulaire: { libelle: 'formulaire de connexion web (POST)', champs: ['url', 'utilisateur', 'champ_utilisateur', 'champ_secret', 'attendu'] },
  },
  adaptateurs: {
    qbittorrent: { libelle: "qBittorrent (change le mot de passe de l'interface web)", pousse: true },
    assiste: { libelle: "assistée : l'app prépare le nouveau secret, tu l'appliques toi-même", pousse: false },
  },
  consommateurs: { blob_cred: 'fichier .cred chiffré', unite: 'service utilisateur relancé' },
  periode_min: 1, periode_max: 365,
}
type ElRot = Record<string, unknown> & { id: string; nom: string; adaptateur: string }
const suiviRot = (reussie: number | null, periode: number | null, etat: string, sonde: unknown = null) => ({
  derniere_reussite: reussie, dernier_echec: null, prochaine: periode && reussie ? reussie + periode * J : null, etat, sonde,
})
const etatRot: { elements: ElRot[] } = {
  elements: [
    { id: 'qbittorrent', nom: 'qBittorrent (interface web)', coffre: { id: '', nom: 'media-server/qbittorrent' }, periode_jours: 30, adaptateur: 'qbittorrent',
      sonde: null, consommateurs: [{ type: 'blob_cred', chemin: '~/.config/lyra-control/qbt-password.cred', nom: 'qbt-password' }], auto_reel: false, gere_ailleurs: true,
      mode: 'planifiée', en_cours: false, dernier: null, suivi: suiviRot(maintenant() - 18 * J, 30, 'ok', { quand: maintenant() - 2 * J, ok: true }) },
    { id: 'nas', nom: 'NAS du salon', coffre: { id: 'it-nas', nom: 'NAS du salon' }, periode_jours: 90, adaptateur: 'assiste',
      sonde: null, consommateurs: [], auto_reel: false, gere_ailleurs: false, mode: 'assistée', en_cours: false, dernier: null,
      suivi: suiviRot(maintenant() - 88 * J, 90, 'bientot') },
  ],
}
const ETAPES_ROT = ['contrôle préalable (ancien secret accepté)', 'génération du nouveau secret', 'nouvelle version mise en attente dans le coffre',
  'application sur le service', 'vérification avec le nouveau secret', 'mise à jour des consommateurs', 'promotion dans le coffre (ancien conservé)', 'relance des services déclarés']
const passageRot = (id: string, reel: boolean) => {
  const assistee = etatRot.elements.find((e) => e.id === id)?.adaptateur === 'assiste'
  const statut = !reel ? 'simulee_ok' : assistee ? 'en_attente_utilisateur' : 'reussie'
  const ids = ['controle', 'generation', 'attente', 'application', 'verification', 'consommateurs', 'promotion', 'relances']
  const etapes = ids.map((i, n) => ({
    id: i, libelle: ETAPES_ROT[n], detail: !reel && n > 0 ? 'essai à blanc : non exécuté' : '',
    etat: n === 0 ? 'ok' : !reel ? 'simule' : assistee && n > 2 ? 'saute' : n >= 5 ? 'saute' : 'ok',
  }))
  const resume = !reel ? 'le contrôle passe ; une rotation réelle peut être lancée'
    : assistee ? 'nouveau secret prêt dans le coffre ; applique-le puis termine la rotation' : 'rotation réussie et vérifiée'
  return { element: id, debut: maintenant() - 2, fin: maintenant(), reel, statut, resume, etapes, declencheur: 'manuel' }
}
const ITEMS_ROT = [
  { id: 'it-nas', nom: 'NAS du salon', identifiant: 'admin', dossier: 'maison', modifie: '2026-07-22T10:00:00Z' },
  { id: 'it-box', nom: 'Box internet', identifiant: 'admin', dossier: 'maison', modifie: '2026-03-02T09:00:00Z' },
  { id: 'it-forge', nom: 'Forge locale', identifiant: 'amine', dossier: 'dev', modifie: '2026-09-10T18:30:00Z' },
  { id: 'it-qbt', nom: 'media-server/qbittorrent', identifiant: 'admin', dossier: 'media', modifie: '2026-10-02T04:31:00Z' },
]

const securiteRotation: [string, string, MockHandler][] = [
  ['GET', '/rotation', () => ({ elements: etatRot.elements, coffre: { disponible: true, raison: '' }, catalogue: CATALOGUE_ROT })],
  ['GET', '/rotation/inventaire', ({ query }) => {
    const q = (query.get('q') ?? '').toLowerCase(), d = query.get('dossier') ?? ''
    const pris = new Map(etatRot.elements.map((e) => [(e.coffre as { id: string }).id, e.id]))
    pris.set('it-qbt', 'qbittorrent')
    const items = ITEMS_ROT.filter((i) => (!q || `${i.nom} ${i.identifiant}`.toLowerCase().includes(q)) && (!d || i.dossier === d))
      .map((i) => ({ ...i, planifie: pris.has(i.id), element: pris.get(i.id) ?? '' }))
    return { disponible: true, raison: '', dossiers: ['dev', 'maison', 'media'], items }
  }],
  ['POST', '/rotation/elements', ({ body }) => {
    const b = (body ?? {}) as Record<string, unknown>
    const id = String(b.nom ?? 'element').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'element'
    const el = {
      ...b, id, auto_reel: false, gere_ailleurs: false, en_cours: false, dernier: null, sonde: b.sonde ?? null, consommateurs: b.consommateurs ?? [],
      mode: b.adaptateur === 'assiste' ? 'assistée' : b.periode_jours ? 'planifiée' : 'manuelle',
      suivi: { ...suiviRot(null, null, b.periode_jours ? 'ok' : 'manuelle'), prochaine: b.periode_jours ? maintenant() + Number(b.periode_jours) * J : null },
    } as unknown as ElRot
    etatRot.elements = [...etatRot.elements, el]
    return el
  }],
  ['POST', '/rotation/elements/:id/verifier', ({ params }) => passageRot(params.id, false)],
  ['POST', '/rotation/elements/:id/tourner', ({ params }) => passageRot(params.id, true)],
  ['POST', '/rotation/elements/:id/terminer', ({ params }) => ({ ...passageRot(params.id, true), statut: 'reussie', resume: 'rotation assistée terminée' })],
  ['POST', '/rotation/elements/:id/auto-reel', ({ params, body }) => {
    etatRot.elements = etatRot.elements.map((e) => (e.id === params.id ? { ...e, auto_reel: Boolean((body as { actif?: boolean })?.actif) } : e))
    return etatRot.elements.find((e) => e.id === params.id)
  }],
  ['DELETE', '/rotation/elements/:id', ({ params }) => {
    etatRot.elements = etatRot.elements.filter((e) => e.id !== params.id)
    return { ok: true }
  }],
  ['GET', '/rotation/historique', ({ query }) => {
    const id = query.get('element') ?? ''
    return { passages: [{ ...passageRot(id, false), fin: maintenant() - 2 * J }, { ...passageRot(id, true), fin: maintenant() - 18 * J, statut: 'reussie' }] }
  }],
]

export const securite: [string, string, MockHandler][] = [
  ...securiteRotation,
  ['GET', '/securite/secrets', () => ({
    vaultwarden: { actif: true, etat: 'active', sous_etat: 'running', installe: true, relances: 0, depuis: 'Mon 2026-10-19 18:17:42', resultat: 'success' },
    rotations: [{ nom: 'qbt-password.cred', libelle: 'qBittorrent (rotation mensuelle)', age_jours: 18, periode_jours: 30, reste_jours: 11, etat: 'ok' }],
    resume: { en_dur: 2, rotations_dues: 0, rotations_proches: 0, vaultwarden_actif: true, gravite: 'warn' },
    scan_il_y_a_s: 42,
  })],
  ['GET', '/securite/secrets/scan', () => {
    const t = [
      { depot: 'MCP/tracking', chemin: 'poller.py', ligne: 12, motif: 'affectation en dur', emplacement: 'MCP/tracking/poller.py:12' },
      { depot: 'MCP/tracking', chemin: 'poller.py', ligne: 13, motif: 'affectation en dur', emplacement: 'MCP/tracking/poller.py:13' },
    ]
    return { depots: [{ depot: 'MCP/tracking', fichiers: 31, trouvailles: t }, { depot: 'neutroncore', fichiers: 222, trouvailles: [] }], trouvailles: t }
  }],
  ['GET', '/securite/journal/unites', () => ({
    unites: [
      { id: '@user', portee: 'user', libelle: 'toutes (session utilisateur)' },
      { id: '@system', portee: 'system', libelle: 'toutes (systeme)' },
      { id: 'lyra-control-api.service', portee: 'user', libelle: 'lyra-control-api' },
      { id: 'subtitle-ai.service', portee: 'user', libelle: 'subtitle-ai' },
      { id: 'borg-backup.service', portee: 'system', libelle: 'borg-backup' },
    ],
    priorites: ['urgence', 'alerte', 'critique', 'erreur', 'avertissement', 'notice', 'info', 'debug'],
    plages: ['15m', '1h', '6h', '24h', '7j', '30j'], limite_max: 1000,
  })],
  ['GET', '/securite/journal', ({ query }) => {
    const mot = (query.get('recherche') ?? '').toLowerCase()
    const entrees = ENTREES.filter((e) => e.message.toLowerCase().includes(mot)).map((e) => ({
      t: maintenant() - e.d, niveau: e.niveau, unite: e.unite, message: e.message, quand: new Date((maintenant() - e.d) * 1000).toISOString().replace('T', ' ').slice(0, 19),
    }))
    const timeouts = entrees.filter((e) => e.message.startsWith('timeout'))
    return {
      unite: query.get('unite') ?? '@user', total: entrees.length, decompte: { erreur: timeouts.length, avertissement: 1, info: 1 },
      groupes: timeouts.length ? [{ unite: 'subtitle-ai.service', modele: 'timeout apres # s sur la requete #', exemple: timeouts[0].message, niveau: 3, nombre: timeouts.length, premier: timeouts[timeouts.length - 1].t, dernier: timeouts[0].t }] : [],
      entrees, erreur: '',
    }
  }],
]
