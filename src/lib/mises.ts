// Tableau des mises à jour : types, filtres mémorisés et mise en phrases (logique pure).

export type SourceId = 'dnf' | 'noyau' | 'flatpak' | 'docker' | 'npm' | 'pip' | 'firmware'
export type Niveau = 'aucune' | 'basse' | 'moyenne' | 'haute' | 'critique'
export type Ecart = 'majeur' | 'mineur' | 'correctif' | 'inconnu' | 'aucun'

export type Item = {
  id: string; source: SourceId; portee: 'systeme' | 'ordinateur'; nom: string
  installe: string | null; disponible: string | null; ecart: Ecart; retard_jours: number | null
  securite: { niveau: Niveau; avis: string[]; cves: string[] }
  integrite: { signature: 'verifiee' | 'desactivee' | 'non_verifiee' | 'inconnue'; detail: string; depot: string; origine: string; digest: string }
  proposition: { commande: string; action: { type: 'flatpak' | 'docker'; cible: string } | null }
  note: string; a_jour: boolean; en_retard: boolean; redemarrage?: boolean
}
export type SourceResume = { total: number; a_jour: number; en_retard: number; a_mettre_a_jour: number; securite: number; statut: string; detail: string }
export type Reglages = { seuil_jours: number; sources: SourceId[]; projets: string[] | null }
export type Tableau = {
  releve_le: number | null; items: Item[]; en_cours: boolean
  resume: { par_source: Record<SourceId, SourceResume>; a_mettre_a_jour: number; en_retard: number; securite: number; critiques: number; redemarrage: boolean }
  reglages: Reglages
}

export const SOURCES: { id: SourceId; label: string }[] = [
  { id: 'dnf', label: 'paquets système' }, { id: 'noyau', label: 'noyau' }, { id: 'firmware', label: 'firmware' },
  { id: 'flatpak', label: 'flatpak' }, { id: 'docker', label: 'images docker' }, { id: 'npm', label: 'npm' }, { id: 'pip', label: 'pip' },
]
export const labelSource = (s: SourceId): string => SOURCES.find((x) => x.id === s)?.label ?? s

export type Filtres = { portee: 'systeme' | 'tout'; securite: boolean; retard: boolean; apropos: boolean }
export const FILTRES_DEFAUT: Filtres = { portee: 'tout', securite: false, retard: false, apropos: true }
const CLE = 'neutroncore_mises_filtres'

export function lireFiltres(): Filtres {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? '{}') as Partial<Filtres>
    return {
      portee: brut.portee === 'systeme' ? 'systeme' : 'tout',
      securite: brut.securite === true, retard: brut.retard === true, apropos: brut.apropos !== false,
    }
  } catch { return FILTRES_DEFAUT }
}
export function ecrireFiltres(f: Filtres): void {
  try { localStorage.setItem(CLE, JSON.stringify(f)) } catch { /* stockage indisponible : le filtre n'est juste pas retenu */ }
}

/** Éléments à afficher. « à mettre à jour » (défaut) cache ce qui est déjà à jour ; les filtres se cumulent. */
export function filtrer(items: Item[], f: Filtres): Item[] {
  return items.filter((i) =>
    (f.portee === 'tout' || i.portee === 'systeme') &&
    (!f.securite || i.securite.niveau !== 'aucune') &&
    (!f.retard || i.en_retard) &&
    (!f.apropos || Boolean(i.disponible) || i.en_retard))
}

export function retardPhrase(i: Item): string {
  if (!i.disponible && !i.en_retard) return 'à jour'
  if (i.retard_jours === null) return i.ecart === 'majeur' ? 'saut de version majeur' : i.ecart === 'mineur' ? 'saut de version mineur' : 'disponible'
  if (i.retard_jours < 1) return 'avis publié aujourd\'hui'
  return `avis publié il y a ${i.retard_jours} j`
}

export const toneNiveau = (n: Niveau): 'crit' | 'warn' | 'gold' | '' =>
  n === 'critique' || n === 'haute' ? 'crit' : n === 'moyenne' ? 'warn' : n === 'basse' ? 'gold' : ''

export function toneSignature(s: Item['integrite']['signature']): 'ok' | 'crit' | 'warn' | '' {
  return s === 'verifiee' ? 'ok' : s === 'desactivee' ? 'crit' : s === 'inconnue' ? 'warn' : ''
}
export const phraseSignature = (s: Item['integrite']['signature']): string =>
  ({ verifiee: 'signature vérifiée', desactivee: 'vérification désactivée', non_verifiee: 'pas de signature', inconnue: 'origine à confirmer' })[s]

/** Titre de la carte de synthèse. */
export function phraseResume(t: Pick<Tableau, 'releve_le' | 'resume'>): string {
  if (t.releve_le === null) return 'aucun relevé : lance-en un'
  const r = t.resume
  if (r.a_mettre_a_jour === 0) return 'tout est à jour'
  const parts = [`${r.a_mettre_a_jour} à mettre à jour`]
  if (r.critiques) parts.push(`${r.critiques} alerte${r.critiques > 1 ? 's' : ''} sécurité haute`)
  else if (r.securite) parts.push(`${r.securite} avec avis de sécurité`)
  if (r.redemarrage) parts.push('redémarrage à prévoir')
  return parts.join(' · ')
}

/** Lien officiel d'un avis ou d'une CVE (pour « en savoir plus »), ou null. */
export function lienAvis(id: string): string | null {
  if (/^CVE-\d{4}-\d{4,7}$/.test(id)) return `https://nvd.nist.gov/vuln/detail/${id}`
  if (/^FEDORA-\d{4}-[0-9a-f]{10}$/.test(id)) return `https://bodhi.fedoraproject.org/updates/${id}`
  if (/^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/.test(id)) return `https://github.com/advisories/${id}`
  return null
}
