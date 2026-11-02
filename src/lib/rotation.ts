// Rotation générique de mots de passe : types, vocabulaire et validation de l'assistant. Logique pure, sans React.
// Aucune valeur de secret ne transite par ici : l'API ne renvoie que des métadonnées et des étapes.

export type SondeType = 'http_basic' | 'http_bearer' | 'http_formulaire'
export type Sonde = { type: SondeType; url: string; attendu?: number; utilisateur?: string; champ_utilisateur?: string; champ_secret?: string }
export type Consommateur = { type: 'blob_cred'; chemin: string; nom: string } | { type: 'unite'; nom: string }
export type Adaptateur = 'qbittorrent' | 'assiste'
export type EtatSuivi = 'ok' | 'bientot' | 'due' | 'echec' | 'manuelle' | 'en_attente'
export type Statut =
  | 'reussie' | 'reussie_avertissement' | 'echec_annulee' | 'echec_critique' | 'refusee'
  | 'simulee_ok' | 'simulee_echec' | 'en_attente_utilisateur' | 'abandonnee'

export type Etape = { id: string; libelle: string; etat: 'ok' | 'echec' | 'saute' | 'simule'; detail: string }
export type Passage = { element: string; debut: number; fin: number; reel: boolean; statut: Statut; resume: string; etapes: Etape[]; declencheur?: string }
export type Suivi = {
  derniere_reussite: number | null; dernier_echec: number | null; prochaine: number | null
  etat: EtatSuivi; sonde: { quand: number; ok: boolean } | null
}
export type Element = {
  id: string; nom: string; coffre: { id: string; nom: string }; periode_jours: number | null; adaptateur: Adaptateur
  sonde: Sonde | null; consommateurs: Consommateur[]; auto_reel: boolean; gere_ailleurs: boolean
  mode: 'planifiée' | 'manuelle' | 'assistée'; suivi: Suivi; en_cours: boolean
  dernier: { statut: Statut; resume: string; fin: number; reel: boolean } | null
}
export type Catalogue = {
  sondes: Record<string, { libelle: string; champs: string[] }>
  adaptateurs: Record<string, { libelle: string; pousse: boolean }>
  consommateurs: Record<string, string>
  periode_min: number; periode_max: number
}
export type Liste = { elements: Element[]; coffre: { disponible: boolean; raison: string }; catalogue: Catalogue }
export type ItemCoffre = { id: string; nom: string; identifiant: string; dossier: string; modifie: string; planifie: boolean; element: string }
export type Inventaire = { disponible: boolean; raison: string; dossiers: string[]; items: ItemCoffre[] }

const JOUR = 86400

export function jours(secondes: number): number {
  return Math.round(secondes / JOUR)
}

export function phraseProchaine(s: Suivi, maintenant: number): string {
  if (s.etat === 'en_attente') return 'nouveau secret prêt, à appliquer puis terminer'
  if (s.prochaine === null) return 'à la demande (pas de périodicité)'
  const reste = Math.ceil((s.prochaine - maintenant) / JOUR)
  if (reste < 0) return `due depuis ${-reste} j`
  if (reste === 0) return "due aujourd'hui"
  return `dans ${reste} j`
}

export function phraseDate(t: number | null, maintenant: number): string {
  if (t === null) return 'jamais'
  const j = Math.floor((maintenant - t) / JOUR)
  return j <= 0 ? "aujourd'hui" : j === 1 ? 'hier' : `il y a ${j} j`
}

export function tonEtat(e: EtatSuivi): 'ok' | 'warn' | 'crit' | undefined {
  return e === 'due' || e === 'echec' ? 'crit' : e === 'bientot' || e === 'en_attente' ? 'warn' : e === 'ok' ? 'ok' : undefined
}

export const LIBELLE_ETAT: Record<EtatSuivi, string> = {
  ok: 'à jour', bientot: 'bientôt', due: 'due', echec: 'dernier passage en échec', manuelle: 'manuelle', en_attente: 'à terminer',
}

export const LIBELLE_STATUT: Record<Statut, string> = {
  reussie: 'rotation réussie', reussie_avertissement: 'réussie, à relancer à la main',
  echec_annulee: 'échec, ancien secret rétabli', echec_critique: 'échec, intervention manuelle',
  refusee: 'refusée au contrôle', simulee_ok: 'vérification réussie', simulee_echec: 'vérification en échec',
  en_attente_utilisateur: 'prête, à appliquer', abandonnee: 'abandonnée',
}

export function tonStatut(s: Statut): 'ok' | 'warn' | 'crit' {
  if (s === 'echec_critique' || s === 'simulee_echec' || s === 'refusee') return 'crit'
  if (s === 'echec_annulee' || s === 'reussie_avertissement' || s === 'en_attente_utilisateur' || s === 'abandonnee') return 'warn'
  return 'ok'
}

export function phraseSonde(el: Element): string {
  if (el.adaptateur === 'assiste' && !el.sonde) return 'aucune sonde : rotation assistée'
  if (!el.suivi.sonde) return 'jamais vérifiée'
  return el.suivi.sonde.ok ? 'service joignable avec l\'ancien secret' : 'sonde en échec'
}

export function phraseMode(el: Element): string {
  if (el.gere_ailleurs) return 'faite par le planificateur mensuel de media-server ; tu peux la vérifier ou la forcer ici'
  if (el.mode === 'assistée') return "l'app prépare le secret, tu l'appliques toi-même"
  if (el.mode === 'manuelle') return 'à lancer à la main'
  return el.auto_reel ? `tous les ${el.periode_jours} j, rotation réelle automatique` : `tous les ${el.periode_jours} j, l'app vérifie et te prévient`
}

// ---- assistant ----------------------------------------------------------------------------------

export type Brouillon = {
  item: ItemCoffre | null
  nom: string
  adaptateur: Adaptateur
  periodique: boolean
  periode: number
  sondeType: '' | SondeType
  sondeUrl: string
  sondeUtilisateur: string
  sondeAttendu: number
  blobs: { chemin: string; nom: string }[]
  unites: string[]
}

export const BROUILLON_VIDE: Brouillon = {
  item: null, nom: '', adaptateur: 'assiste', periodique: true, periode: 90,
  sondeType: '', sondeUrl: '', sondeUtilisateur: '', sondeAttendu: 200, blobs: [], unites: [],
}

export function brouillonDepuis(item: ItemCoffre): Brouillon {
  return { ...BROUILLON_VIDE, item, nom: item.nom }
}

/** Hôtes que la sonde a le droit de viser (miroir de la règle côté API : machine, LAN, tailnet). */
export function hoteLocal(url: string): boolean {
  let u: URL
  try { u = new URL(url) } catch { return false }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return false
  const h = u.hostname.replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h === '::1') return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127)
}

/** Erreurs de l'étape (1 choix, 2 contrôle, 3 planification). Liste vide = on peut avancer. */
export function erreursEtape(etape: 1 | 2 | 3, b: Brouillon, cat: Catalogue): string[] {
  const e: string[] = []
  if (etape === 1 && !b.item) e.push("choisis un élément du coffre")
  if (etape === 2) {
    if (b.sondeType) {
      if (!hoteLocal(b.sondeUrl)) e.push('adresse de la sonde : http(s) vers cette machine, le réseau local ou le tailnet')
      if (b.sondeType !== 'http_bearer' && !b.sondeUtilisateur.trim()) e.push("nom d'utilisateur de la sonde manquant")
      if (!Number.isInteger(b.sondeAttendu) || b.sondeAttendu < 200 || b.sondeAttendu > 399) e.push('code attendu : 200 à 399')
    }
    for (const u of b.unites) if (!/^[A-Za-z0-9][A-Za-z0-9@._-]{0,80}\.service$/.test(u)) e.push(`unité invalide : ${u}`)
    for (const c of b.blobs) if (!c.chemin.endsWith('.cred') || !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(c.nom)) e.push(`fichier .cred invalide : ${c.chemin || '(vide)'}`)
  }
  if (etape === 3) {
    if (!b.nom.trim()) e.push('donne un nom à cette rotation')
    if (b.periodique && (!Number.isInteger(b.periode) || b.periode < cat.periode_min || b.periode > cat.periode_max)) {
      e.push(`périodicité : ${cat.periode_min} à ${cat.periode_max} jours`)
    }
  }
  return e
}

/** Corps de POST /rotation/elements. */
export function corpsElement(b: Brouillon): Record<string, unknown> {
  const sonde = b.sondeType
    ? {
        type: b.sondeType, url: b.sondeUrl.trim(), attendu: b.sondeAttendu,
        ...(b.sondeType === 'http_bearer' ? {} : { utilisateur: b.sondeUtilisateur.trim() }),
      }
    : null
  return {
    nom: b.nom.trim(),
    coffre: { id: b.item?.id ?? '', nom: b.item?.nom ?? '' },
    adaptateur: b.adaptateur,
    periode_jours: b.periodique ? b.periode : null,
    sonde,
    consommateurs: [
      ...b.blobs.map((c) => ({ type: 'blob_cred' as const, chemin: c.chemin.trim(), nom: c.nom.trim() })),
      ...b.unites.map((nom) => ({ type: 'unite' as const, nom })),
    ],
  }
}

/** Résumé en une phrase de ce que fera la rotation, pour la confirmation. */
export function phrasePlan(el: Pick<Element, 'adaptateur' | 'consommateurs' | 'sonde'>): string {
  const etapes = ['contrôler l\'ancien secret', 'générer le nouveau', 'le mettre en attente dans le coffre']
  if (el.adaptateur === 'assiste') return `${etapes.join(', ')}, puis attendre que tu l'appliques toi-même`
  const unites = el.consommateurs.filter((c) => c.type === 'unite')
  const blobs = el.consommateurs.filter((c) => c.type === 'blob_cred')
  return [...etapes, "l'appliquer au service", 'le vérifier', ...(blobs.length ? [`réécrire ${blobs.length} fichier(s) .cred`] : []),
    'le promouvoir dans le coffre', unites.length ? `relancer ${unites.map((u) => u.nom).join(', ')}` : 'ne relancer aucun service']
    .join(', ') + '. En cas d\'échec, tout est défait.'
}
