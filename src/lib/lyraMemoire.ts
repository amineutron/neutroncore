// Memoire et historique vocal de Lyra : types et logique pure (testee dans lyraMemoire.test.ts).

export type Souvenir = {
  id: string
  genre: 'demande' | 'apprentissage' | 'mot'
  theme: string
  texte: string
  detail: string
  at: number | null
  outil: string
  groupe: string
  corrige: boolean
  original?: string
  /** Pour un mot : ce qu'on corrige (le sens de l'abreviation, ou la liste de synonymes). */
  valeur?: string
  /** Mot ajoute dans neutroncore seulement (lyra ne le connait pas). */
  local?: boolean
}
export type Theme = { id: string; libelle: string; n: number }
export type MemoireResp = {
  items: Souvenir[]; n: number; themes: Theme[]; corbeille: number; note: string; appliquee_chez_lyra: boolean
  /** Le demon de lyra sait modifier sa vraie memoire (sinon : couche neutroncore seulement). */
  edition_reelle?: boolean
}
export type Apercu = {
  total: number; demandes: number; apprentissages: number; mots: number; corrigees: number; corbeille: number
  derniere: number | null; note: string; edition_reelle?: boolean
  themes: (Theme & { exemples: string[] })[]
}
export type Supprime = Souvenir & { supprime_le: number }

export type Evenement = {
  id: string; at: number | null; source: 'retenu' | 'conversation' | 'journal' | 'erreur'; canal: string
  phrase: string; outil: string; compris: boolean; succes: boolean | null; confiance: number | null; detail: string
}
export type Taux = { total: number; reussis: number; taux: number | null }
export type Stats = Taux & {
  non_compris: number; erreurs: number; sans_verdict: number
  par_jour: (Taux & { jour: string })[]; par_outil: (Taux & { outil: string })[]
}
export type HistoriqueResp = { evenements: Evenement[]; n: number; outils: string[]; stats: Stats; note: string }

// --- vraie memoire ou couche locale ------------------------------------------------------------

/** Reponse de PUT /lyra/memoire/{id} et DELETE .../definitif. */
export type Application = {
  appliquee_chez_lyra?: boolean; redemarrage_requis?: boolean; raison?: string; id?: string
}

/** Ce que l'ecran dit apres une modification : atteint-elle la vraie memoire de lyra ou seulement neutroncore ? */
export function messageApplication(action: 'corrigé' | 'supprimé' | 'ajouté', r: Application | undefined): { texte: string; ton: 'ok' | 'warn' } {
  if (r?.appliquee_chez_lyra) {
    const base = action === 'corrigé' ? 'corrigé dans la mémoire de lyra'
      : action === 'ajouté' ? 'ajouté dans la mémoire de lyra' : 'oublié par lyra pour de bon'
    const suite = action === 'ajouté' ? 'actif après le redémarrage de son démon' : 'pris en compte au redémarrage de son démon'
    return { texte: r.redemarrage_requis ? `${base} - ${suite}` : base, ton: 'ok' }
  }
  if (action === 'ajouté') return { texte: "ajouté dans neutroncore seulement : lyra ne le connaît pas encore", ton: 'warn' }
  return { texte: `${action} dans neutroncore seulement : lyra garde l'original`, ton: 'warn' }
}

// --- mots et « veut dire » ----------------------------------------------------------------------

export const MAX_MOT = 60
export const MAX_VEUT_DIRE = 12

/** Lignes nettoyees : espaces retires, vides et doublons (sans tenir compte de la casse) ecartes. */
export function nettoyerLignes(lignes: string[]): string[] {
  const vus = new Set<string>()
  const out: string[] = []
  for (const l of lignes) {
    const t = l.trim()
    if (t && !vus.has(t.toLowerCase())) { vus.add(t.toLowerCase()); out.push(t) }
  }
  return out
}

export type ValidationMot = { ok: true; mot: string; veutDire: string[] } | { ok: false; erreur: string }

/** Memes regles que le demon, pour le dire avant l'envoi. */
export function validerMot(mot: string, lignes: string[]): ValidationMot {
  const m = mot.trim()
  if (!m) return { ok: false, erreur: 'écris le mot' }
  if (m.length > MAX_MOT) return { ok: false, erreur: `le mot dépasse ${MAX_MOT} caractères` }
  if (m.includes(',') || m.startsWith('_')) return { ok: false, erreur: 'le mot ne peut pas contenir de virgule' }
  const liste = nettoyerLignes(lignes).filter((l) => l.toLowerCase() !== m.toLowerCase())
  if (!liste.length) return { ok: false, erreur: 'ajoute au moins un « veut dire »' }
  if (liste.length > MAX_VEUT_DIRE) return { ok: false, erreur: `${MAX_VEUT_DIRE} « veut dire » au plus` }
  const long = liste.find((l) => l.length > MAX_MOT)
  if (long) return { ok: false, erreur: `« ${long.slice(0, 20)}... » dépasse ${MAX_MOT} caractères` }
  if (liste.some((l) => l.includes(','))) return { ok: false, erreur: 'un « veut dire » ne peut pas contenir de virgule : une ligne par formulation' }
  return { ok: true, mot: m, veutDire: liste }
}

/** Un mot dont la valeur est une liste (synonymes), par opposition a une abreviation (un seul sens). */
export function estListe(it: Souvenir): boolean {
  return it.genre === 'mot' && it.detail.startsWith('aussi dit')
}

export function listeDeValeur(valeur: string): string[] {
  return nettoyerLignes(valeur.split(','))
}

/** Valeur envoyee a PUT /lyra/memoire/{id} pour une liste de « veut dire » (le demon separe sur les virgules). */
export function valeurDeListe(lignes: string[]): string {
  return nettoyerLignes(lignes).join(', ')
}

/** Bandeau d'etat de l'ecran (puce + phrase d'aide). */
export function etatEdition(reelle: boolean | undefined): { libelle: string; ton: 'ok' | 'warn'; aide: string } {
  return reelle
    ? { libelle: 'mémoire réelle', ton: 'ok', aide: 'tes corrections et suppressions modifient la vraie mémoire de lyra' }
    : { libelle: 'copie neutroncore', ton: 'warn', aide: "le démon de lyra ne gère pas encore la mémoire : lyra garde l'original" }
}

/** Texte que l'editeur propose de corriger : le sens pour un mot, la phrase sinon. */
export function texteEditable(it: Souvenir): string {
  return it.genre === 'mot' ? it.valeur ?? '' : it.texte
}

/** Nom du canal d'une phrase, quand le demon le note (journal) ; vide si inconnu. */
export function libelleCanal(canal: string): string {
  return canal === 'vocal' ? 'voix' : canal === 'texte' ? 'clavier' : canal === 'api' ? 'application' : ''
}

// --- regroupement par theme ------------------------------------------------------------------

export type Groupe = { id: string; libelle: string; items: Souvenir[] }

/** Souvenirs regroupes par theme, dans l'ordre des themes donnes ; un theme inconnu garde son id. */
export function grouperParTheme(items: Souvenir[], themes: Theme[]): Groupe[] {
  const libelle = new Map(themes.map((t) => [t.id, t.libelle]))
  const ordre = themes.map((t) => t.id)
  const par = new Map<string, Souvenir[]>()
  for (const it of items) par.set(it.theme, [...(par.get(it.theme) ?? []), it])
  const ids = [...ordre.filter((id) => par.has(id)), ...[...par.keys()].filter((id) => !ordre.includes(id))]
  return ids.map((id) => ({ id, libelle: libelle.get(id) ?? id, items: par.get(id) ?? [] }))
}

/** Dans le theme « mots », sous-regroupement par section du dictionnaire. */
export function grouperParSection(items: Souvenir[]): { section: string; items: Souvenir[] }[] {
  const par = new Map<string, Souvenir[]>()
  for (const it of items) par.set(it.groupe || '', [...(par.get(it.groupe || '') ?? []), it])
  return [...par.entries()].map(([section, liste]) => ({ section, items: liste }))
}

// --- affichage --------------------------------------------------------------------------------

export function quand(at: number | null, now = Date.now()): string {
  if (!at) return ''
  const s = Math.max(0, now / 1000 - at)
  if (s < 90) return "à l'instant"
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  if (s < 86400 * 45) return `il y a ${Math.round(s / 86400)} j`
  return new Date(at * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function heure(at: number | null): string {
  return at ? new Date(at * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
}

export function pourcent(t: number | null): string {
  return t === null ? '-' : `${Math.round(t)} %`
}

export function toneTaux(t: number | null): 'ok' | 'warn' | 'crit' | undefined {
  if (t === null) return undefined
  return t >= 80 ? 'ok' : t >= 50 ? 'warn' : 'crit'
}

/** Phrase de resume du verdict d'un evenement, sans jargon. */
export function verdict(e: Evenement): string {
  if (e.succes === true) return 'a marché'
  if (e.succes === false) return e.compris ? "n'a pas abouti" : "n'a pas compris"
  return 'résultat non noté'
}

/** Nom d'outil lisible : « fedora.vm_start » -> « vm start ». */
export function nomOutil(outil: string): string {
  if (!outil) return 'rien compris'
  return outil.split('.').pop()!.replace(/_/g, ' ')
}

// --- filtres retenus (localStorage) ----------------------------------------------------------

export function lireStocke<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle)
    return brut === null ? defaut : ({ ...defaut, ...JSON.parse(brut) } as T)
  } catch { return defaut }
}
export function ecrireStocke(cle: string, valeur: unknown): void {
  try { localStorage.setItem(cle, JSON.stringify(valeur)) } catch { /* stockage indisponible */ }
}

/** Parametres d'URL sans valeur vide. */
export function requete(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}
