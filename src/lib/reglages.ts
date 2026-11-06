// Sauvegarde / restauration des réglages et vue du journal d'audit : logique pure (testée).
// Les règles d'exclusion de secrets sont rejouées côté API : ici elles évitent seulement d'envoyer inutilement.

export const LOCAL_PREFIXE = 'neutroncore_'
export const LOCAL_EXCLUS: ReadonlySet<string> = new Set([
  'neutroncore_api_key', 'neutroncore_last_visit', 'neutroncore_force_intro', 'neutroncore_tour_v1',
  'neutroncore_audio_warned', 'neutroncore_atelier_ouvrir', 'neutroncore_avant_import',
])
export const CLE_AVANT_IMPORT = 'neutroncore_avant_import'
export const CLE_ONGLET = 'neutroncore_reglages2_tab'
export const CLE_FILTRES_AUDIT = 'neutroncore_audit_filtres'
export const TAILLE_MAX_DOC = 8_000_000

const SECRET = /(api[_-]?key|token|jeton|secret|passw|credential|bearer|hmac|ntfy)/i

type Magasin = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

// --- réglages du navigateur -------------------------------------------------

export function cleExportable(cle: string): boolean {
  return cle.startsWith(LOCAL_PREFIXE) && !LOCAL_EXCLUS.has(cle) && !SECRET.test(cle) && cle.length <= 80
}

export function collecterLocal(m: Magasin): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < m.length; i++) {
    const k = m.key(i)
    if (k && cleExportable(k)) {
      const v = m.getItem(k)
      if (v !== null) out[k] = v
    }
  }
  return out
}

/** Écrit les valeurs reçues ; renvoie ce qu'il y avait avant (null = absent) pour pouvoir annuler. */
export function appliquerLocal(m: Magasin, valeurs: Record<string, string>): Record<string, string | null> {
  const avant: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(valeurs)) {
    if (!cleExportable(k) || typeof v !== 'string') continue
    avant[k] = m.getItem(k)
    m.setItem(k, v)
  }
  m.setItem(CLE_AVANT_IMPORT, JSON.stringify(avant))
  return avant
}

export function lireAvantImport(m: Magasin): Record<string, string | null> | null {
  try {
    const brut = m.getItem(CLE_AVANT_IMPORT)
    if (!brut) return null
    const o = JSON.parse(brut) as unknown
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null
    const out: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(o)) if (cleExportable(k) && (v === null || typeof v === 'string')) out[k] = v
    return Object.keys(out).length ? out : null
  } catch { return null }
}

export function annulerLocal(m: Magasin): number {
  const avant = lireAvantImport(m)
  if (!avant) return 0
  for (const [k, v] of Object.entries(avant)) {
    if (v === null) m.removeItem(k)
    else m.setItem(k, v)
  }
  m.removeItem(CLE_AVANT_IMPORT)
  return Object.keys(avant).length
}

// --- document ---------------------------------------------------------------

export type Ecart = { chemin: string; genre: 'ajoute' | 'retire' | 'change'; avant: unknown; apres: unknown }
export type SectionApercu = { id: string; libelle: string; statut: 'nouveau' | 'identique' | 'different' | 'invalide' | 'inconnue'; erreurs: string[]; diff: Ecart[] }
export type Apercu = {
  valide: boolean; erreurs: string[]; sections: SectionApercu[]
  local: { statut: 'identique' | 'different'; nombre: number; avertissements: string[]; diff: Ecart[] } | null
}
export type Resultat = { id: string; ok: boolean; message: string }
export type Sauvegarde = { nom: string; motif: string; cree_le: string; sections: string[] }
export type Document = { format: string; version: number; cree_le?: string; local?: Record<string, string>; sections?: Record<string, unknown>; masques?: string[] }

/** Lit un fichier choisi par l'utilisateur ; ne fait aucune confiance à son contenu. */
export function lireDocument(texte: string): { doc: Document | null; erreur: string } {
  if (texte.length > TAILLE_MAX_DOC) return { doc: null, erreur: 'fichier trop volumineux' }
  let o: unknown
  try { o = JSON.parse(texte) } catch { return { doc: null, erreur: 'ce fichier n’est pas du JSON' } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { doc: null, erreur: 'document inattendu' }
  const d = o as Record<string, unknown>
  if (d.format !== 'neutroncore-reglages') return { doc: null, erreur: 'ce n’est pas un export de réglages neutroncore' }
  if (typeof d.version !== 'number') return { doc: null, erreur: 'version manquante' }
  return { doc: d as unknown as Document, erreur: '' }
}

export function nomFichierExport(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `neutroncore-reglages-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`
}

/** Sections cochées au départ : tout ce qui change et qui est valide. */
export function sectionsParDefaut(a: Apercu): string[] {
  return a.sections.filter((s) => s.statut === 'nouveau' || s.statut === 'different').map((s) => s.id)
}

export function motStatut(s: SectionApercu['statut']): string {
  return { nouveau: 'nouveau fichier', identique: 'identique', different: 'différent', invalide: 'invalide', inconnue: 'inconnue' }[s]
}

export function motEcart(e: Ecart): string {
  const v = (x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x))
  if (e.genre === 'ajoute') return `+ ${e.chemin} : ${v(e.apres)}`
  if (e.genre === 'retire') return `- ${e.chemin} : ${v(e.avant)}`
  return `~ ${e.chemin} : ${v(e.avant)} -> ${v(e.apres)}`
}

/** Date lisible de l'API (« 2026-10-19T23:02:17Z » ou sans Z) en heure locale courte. */
export function dateLisible(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// --- journal d'audit ----------------------------------------------------------

export type Kind = 'action' | 'ecriture' | 'auth'
export type Periode = '1h' | '24h' | '7j' | '30j' | 'tout'
export type Filtres = { texte: string; kinds: Kind[]; resultat: 'tous' | 'ok' | 'echec'; periode: Periode; ip: string; sensible: boolean }
export type EntreeAudit = {
  ts: string; ip: string; reseau: string; kind: Kind; methode: string; action: string; detail: string; status: number; ok: boolean; sensible: boolean
}
export type ReponseAudit = {
  entrees: EntreeAudit[]; tronque: boolean; partiel: boolean; octets_lus: number; taille: number
  resume: { total: number; par_kind: Record<Kind, number>; echecs: number; sensibles: number; top_actions: { action: string; n: number }[] }
}

export const KINDS: { id: Kind; label: string; aide: string }[] = [
  { id: 'action', label: 'actions', aide: 'actions confirmées ou lancées depuis l’app (arrêts, suppressions, réglages...)' },
  { id: 'ecriture', label: 'écritures', aide: 'requêtes POST, PUT, DELETE' },
  { id: 'auth', label: 'accès refusés', aide: 'clé absente ou fausse, adresse non autorisée' },
]
export const PERIODES: { id: Periode; label: string; sec: number }[] = [
  { id: '1h', label: '1 h', sec: 3600 }, { id: '24h', label: '24 h', sec: 86400 }, { id: '7j', label: '7 j', sec: 604800 },
  { id: '30j', label: '30 j', sec: 2592000 }, { id: 'tout', label: 'tout', sec: 0 },
]

export const FILTRES_DEFAUT: Filtres = { texte: '', kinds: [], resultat: 'tous', periode: '24h', ip: '', sensible: false }

/** Filtres relus du stockage : toute valeur inattendue retombe sur le défaut. */
export function filtresValides(brut: unknown): Filtres {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>
  const kinds = Array.isArray(o.kinds) ? KINDS.map((k) => k.id).filter((k) => (o.kinds as unknown[]).includes(k)) : []
  return {
    texte: typeof o.texte === 'string' ? o.texte.slice(0, 100) : '',
    kinds,
    resultat: o.resultat === 'ok' || o.resultat === 'echec' ? o.resultat : 'tous',
    periode: PERIODES.some((p) => p.id === o.periode) ? (o.periode as Periode) : FILTRES_DEFAUT.periode,
    ip: typeof o.ip === 'string' ? o.ip.slice(0, 64) : '',
    sensible: o.sensible === true,
  }
}

export function lireFiltres(m: Pick<Storage, 'getItem'>): Filtres {
  try { return filtresValides(JSON.parse(m.getItem(CLE_FILTRES_AUDIT) ?? '{}')) } catch { return { ...FILTRES_DEFAUT } }
}

export function ecrireFiltres(m: Pick<Storage, 'setItem'>, f: Filtres): void {
  try { m.setItem(CLE_FILTRES_AUDIT, JSON.stringify(f)) } catch { /* stockage indisponible : filtres non retenus */ }
}

/** Paramètres de requête (le même jeu sert au tableau et au CSV). */
export function filtresVersQuery(f: Filtres, maintenant: Date, limite?: number): string {
  const q = new URLSearchParams()
  if (f.texte.trim()) q.set('texte', f.texte.trim())
  if (f.kinds.length) q.set('kinds', f.kinds.join(','))
  if (f.resultat !== 'tous') q.set('resultat', f.resultat)
  const sec = PERIODES.find((p) => p.id === f.periode)?.sec ?? 0
  if (sec) q.set('depuis', new Date(maintenant.getTime() - sec * 1000).toISOString().replace(/\.\d+Z$/, 'Z'))
  if (f.ip.trim()) q.set('ip', f.ip.trim())
  if (f.sensible) q.set('sensible', '1')
  if (limite) q.set('limite', String(limite))
  return q.toString()
}

export function filtresActifs(f: Filtres): number {
  return (f.texte.trim() ? 1 : 0) + (f.kinds.length ? 1 : 0) + (f.resultat !== 'tous' ? 1 : 0) + (f.periode !== 'tout' ? 1 : 0) + (f.ip.trim() ? 1 : 0) + (f.sensible ? 1 : 0)
}

export function motResultat(e: EntreeAudit): string {
  return e.ok ? 'réussi' : e.kind === 'auth' ? 'refusé' : 'échec'
}
