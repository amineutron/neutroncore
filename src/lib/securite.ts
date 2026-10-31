// Ecran securite : secrets (lecture seule) et journal système. Logique pure, sans React.
// Aucune valeur de secret ne transite ici : l'API ne renvoie que des emplacements et des âges.

export type Rotation = { nom: string; libelle: string; age_jours: number; periode_jours: number; reste_jours: number; etat: 'ok' | 'bientot' | 'due' }
export type Vault = { actif: boolean; etat: string; sous_etat: string; installe: boolean; relances: number; depuis: string; resultat: string }
export type Resume = { en_dur: number; rotations_dues: number; rotations_proches: number; vaultwarden_actif: boolean; gravite: 'ok' | 'warn' | 'crit' }
export type EtatSecrets = { vaultwarden: Vault; rotations: Rotation[]; resume: Resume; scan_il_y_a_s: number }
export type Trouvaille = { depot: string; chemin: string; ligne: number; motif: string; emplacement: string }

export type Entree = { t: number; niveau: number; unite: string; message: string; quand: string }
export type Groupe = { unite: string; modele: string; exemple: string; niveau: number; nombre: number; premier: number; dernier: number }
export type Journal = { unite: string; total: number; decompte: Record<string, number>; groupes: Groupe[]; entrees: Entree[]; erreur: string }
export type Catalogue = { unites: { id: string; portee: string; libelle: string }[]; priorites: string[]; plages: string[]; limite_max: number }

export type Filtres = { unite: string; priorite: string; plage: string; recherche: string; groupes: boolean }
export const FILTRES_DEFAUT: Filtres = { unite: '@user', priorite: '', plage: '1h', recherche: '', groupes: true }
const CLE = 'neutroncore_securite_filtres'

export function chargerFiltres(): Filtres {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? '{}') as Partial<Filtres>
    return {
      unite: typeof brut.unite === 'string' ? brut.unite : FILTRES_DEFAUT.unite,
      priorite: typeof brut.priorite === 'string' ? brut.priorite : '',
      plage: typeof brut.plage === 'string' ? brut.plage : FILTRES_DEFAUT.plage,
      recherche: typeof brut.recherche === 'string' ? brut.recherche.slice(0, 100) : '',
      groupes: brut.groupes !== false,
    }
  } catch {
    return FILTRES_DEFAUT
  }
}

export function sauverFiltres(f: Filtres): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(f))
  } catch {
    /* stockage indisponible : le filtre ne sera pas retenu */
  }
}

/** Chaine de requete de GET /securite/journal (valeurs encodees ; la validation reste cote API). */
export function requeteJournal(f: Filtres): string {
  const p = new URLSearchParams({ unite: f.unite, plage: f.plage })
  if (f.priorite) p.set('priorite', f.priorite)
  if (f.recherche.trim()) p.set('recherche', f.recherche.trim())
  return p.toString()
}

export type Ton = 'ok' | 'warn' | 'crit' | ''

/** Couleur d'une priorite syslog (0 a 7). */
export function tonNiveau(niveau: number): Ton {
  return niveau <= 3 ? 'crit' : niveau === 4 ? 'warn' : ''
}

export function tonRotation(etat: Rotation['etat']): 'ok' | 'warn' | 'crit' {
  return etat === 'due' ? 'crit' : etat === 'bientot' ? 'warn' : 'ok'
}

export function phraseRotation(r: Rotation): string {
  if (r.etat === 'due') return `due depuis ${Math.abs(r.reste_jours)} j (âge ${r.age_jours} j sur ${r.periode_jours})`
  return `renouvelée il y a ${r.age_jours} j, prochaine dans ${r.reste_jours} j`
}

export function dureeCourte(secondes: number): string {
  if (secondes < 90) return `${Math.max(0, Math.round(secondes))} s`
  if (secondes < 5400) return `${Math.round(secondes / 60)} min`
  if (secondes < 172800) return `${Math.round(secondes / 3600)} h`
  return `${Math.round(secondes / 86400)} j`
}

/** Trouvailles regroupees par fichier, fichiers tries par nombre decroissant. */
export function parFichier(liste: Trouvaille[]): { fichier: string; lignes: number[]; motif: string }[] {
  const m = new Map<string, { fichier: string; lignes: number[]; motif: string }>()
  for (const t of liste) {
    const cle = `${t.depot}/${t.chemin}`
    const g = m.get(cle) ?? { fichier: cle, lignes: [], motif: t.motif }
    g.lignes.push(t.ligne)
    m.set(cle, g)
  }
  return [...m.values()].sort((a, b) => b.lignes.length - a.lignes.length || a.fichier.localeCompare(b.fichier))
}
