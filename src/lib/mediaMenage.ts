// Nettoyage, santé des fichiers et recommandations de la médiathèque : types et logique pure.
// L'API calcule tout (espace réel avec hardlinks, anomalies, suggestions) ; l'écran filtre, trie et montre.

export type Motif = { code: 'jamais_vu' | 'ancien' | 'qualite' | 'doublon'; detail: string }
export type Proposition = {
  cle: string; kind: 'movie' | 'series'; id: number; title: string; year: number | null; quality: string; added: string
  motifs: Motif[]; apparent: number; libere: number; retenu: number; seme: number; confiance: 'haute' | 'basse'
}
export type Menage = {
  genere: number; analyses: number; propositions: Proposition[]
  plex: { disponible: boolean; entrees: number; erreur: string }
  total: { apparent: number; libere: number; retenu: number; seme: number }
  reglages: { jours: number; qualites_faibles: string[]; debit_min: number; garder: string[] }
}

export type Gravite = 'info' | 'warn' | 'crit'
export type Anomalie = { code: string; gravite: Gravite; detail: string }
export type LigneSante = { chemin: string; taille: number; anomalies: Anomalie[]; infos: Record<string, unknown>; vu: number }
export type ScanEtat = { etat: 'repos' | 'en_cours' | 'termine' | 'annule' | 'erreur'; total: number; fait: number; saute: number; erreurs: number; debut: number; fin: number; courant: string; message?: string }
export type Sante = {
  scan: ScanEtat; reglages: { audio: string[]; sous_titres: string[]; paralleles: number }
  synthese: { fichiers: number; sains: number; par_gravite: Record<Gravite, number>; par_code: Record<string, number> }
  total: number; lignes: LigneSante[]
}

export type Suggestion = { titre: string; annee: number | null; type: 'film' | 'serie'; raison: string; tmdb_id: number | null }
export type Recos = { genere: number; source: 'modele' | 'repli' | ''; modele?: string; raison_repli?: string; depart?: string; suggestions: Suggestion[] }

export const MOTIFS: Record<Motif['code'], string> = { jamais_vu: 'jamais regardé', ancien: 'ancien', qualite: 'mauvaise qualité', doublon: 'doublon' }
export const CODES_SANTE: Record<string, string> = {
  illisible: 'illisible', sans_video: 'sans vidéo', sans_duree: 'sans durée', tronque: 'tronqué ?', erreurs_lecture: 'erreurs de lecture',
  sans_audio: 'sans audio', audio_langue: 'langue audio', audio_inconnue: 'audio sans langue', sous_titres_langue: 'langue sous-titres',
  sans_sous_titres: 'sans sous-titres', dv_non_converti: 'dv non converti', dv_incoherent: 'dv incohérent', dv_absent: 'dv absent', dv_profil5: 'dv profil 5',
}

// --- Filtres du nettoyage (retenus en localStorage) ------------------------------------------------------

export type Filtres = { motifs: Motif['code'][]; kind: 'tous' | 'movie' | 'series'; seulementLibere: boolean; q: string }
export const FILTRES_DEFAUT: Filtres = { motifs: ['jamais_vu', 'ancien', 'qualite', 'doublon'], kind: 'tous', seulementLibere: false, q: '' }
const CLE = 'neutroncore_menage_filtres'

export function lireFiltres(): Filtres {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Partial<Filtres> | null
    if (!brut || typeof brut !== 'object') return FILTRES_DEFAUT
    const motifs = Array.isArray(brut.motifs) ? brut.motifs.filter((m): m is Motif['code'] => m in MOTIFS) : FILTRES_DEFAUT.motifs
    const kind = brut.kind === 'movie' || brut.kind === 'series' ? brut.kind : 'tous'
    return { motifs, kind, seulementLibere: brut.seulementLibere === true, q: typeof brut.q === 'string' ? brut.q.slice(0, 80) : '' }
  } catch { return FILTRES_DEFAUT }
}

export function ecrireFiltres(f: Filtres): void {
  try { localStorage.setItem(CLE, JSON.stringify(f)) } catch { /* stockage indisponible : le filtre ne sera pas retenu */ }
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export function filtrer(props: Proposition[], f: Filtres): Proposition[] {
  const mot = norm(f.q.trim())
  return props.filter((p) =>
    p.motifs.some((m) => f.motifs.includes(m.code)) &&
    (f.kind === 'tous' || p.kind === f.kind) &&
    (!f.seulementLibere || p.libere > 0) &&
    (!mot || norm(p.title).includes(mot)))
}

/** Phrase honnête sur l'espace : « 12 Go libérés » ou « rien de libéré : lien torrent encore semé ». */
export function phraseEspace(p: Pick<Proposition, 'apparent' | 'libere' | 'retenu' | 'seme'>, fmt: (n: number) => string): string {
  if (p.libere === 0 && p.retenu > 0) return p.seme > 0 ? `rien de libéré : ${fmt(p.seme)} encore semés par un torrent` : 'rien de libéré : un autre lien garde le fichier'
  if (p.retenu > 0) return `${fmt(p.libere)} libérés (${fmt(p.retenu)} gardés par d'autres liens)`
  return `${fmt(p.libere)} libérés`
}

// --- Santé -------------------------------------------------------------------------------------------------

export function progressionScan(s: ScanEtat): number {
  return s.total > 0 ? Math.min(100, Math.round((s.fait / s.total) * 100)) : 0
}

export function nomCourt(chemin: string): string {
  return chemin.split('/').slice(-1)[0] ?? chemin
}

export function dossierCourt(chemin: string): string {
  const parts = chemin.split('/')
  return parts.slice(-3, -1).join(' / ')
}

export function toneGravite(g: Gravite): 'crit' | 'warn' | 'ok' { return g === 'crit' ? 'crit' : g === 'warn' ? 'warn' : 'ok' }

/** Libellé du modèle ou du repli, pour dire d'où viennent les suggestions. */
export function origineRecos(r: Recos): string {
  if (r.source === 'modele') return `modèle local ${r.modele ?? ''}`.trim()
  if (r.source === 'repli') return `sans modèle${r.raison_repli ? ` (${r.raison_repli})` : ''}`
  return 'pas encore générées'
}
