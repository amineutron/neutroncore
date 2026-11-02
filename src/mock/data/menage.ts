// Entretien de la médiathèque en démonstration : titres inventés, aucune action réelle.
// Le « garder » et la suppression sont retenus en mémoire jusqu'au rechargement.
import type { MockHandler } from '../router'

const GO = 1_000_000_000
const motif = (code: string, detail: string) => ({ code, detail })
const prop = (kind: 'movie' | 'series', id: number, title: string, year: number, quality: string, motifs: object[], apparent: number, libere: number, seme = 0) => ({
  cle: `${kind}:${id}`, kind, id, title, year, quality, added: '2025-02-01T00:00:00Z', path: '', motifs, apparent, libere, retenu: apparent - libere, seme,
  confiance: 'haute',
})

let propositions = [
  prop('series', 4, 'La Ville Basse', 2021, '', [motif('jamais_vu', 'jamais regardé, ajouté il y a 610 j')], 31 * GO, 31 * GO),
  prop('movie', 12, 'Orbite Morte', 2023, 'Bluray-2160p', [motif('jamais_vu', 'jamais regardé, ajouté il y a 300 j')], 27 * GO, 27 * GO),
  prop('movie', 13, 'Le Dernier Phare', 2019, 'CAM', [motif('qualite', 'qualité CAM'), motif('jamais_vu', 'jamais regardé, ajouté il y a 420 j')], 2 * GO, 2 * GO),
  prop('movie', 21, 'Nuit Blanche', 2018, 'WEBDL-1080p', [motif('doublon', 'existe aussi en Bluray-1080p (id 22), cette copie est la moins bonne')], 9 * GO, 0, 9 * GO),
]
const garder: string[] = []

const total = () => ({
  apparent: propositions.reduce((a, p) => a + p.apparent, 0), libere: propositions.reduce((a, p) => a + p.libere, 0),
  retenu: propositions.reduce((a, p) => a + p.retenu, 0), seme: propositions.reduce((a, p) => a + p.seme, 0),
})

const lignes = [
  { chemin: '/mnt/media/media/movies/Orbite Morte (2023)/Orbite Morte (2023) Bluray-2160p.mkv', taille: 27 * GO, vu: 0, infos: {},
    anomalies: [{ code: 'dv_non_converti', gravite: 'warn', detail: 'Dolby Vision profil 7 : non converti en profil 8 (illisible sur beaucoup de lecteurs)' }] },
  { chemin: '/mnt/media/media/tv/La Ville Basse/Season 01/La Ville Basse - S01E03 WEBDL-1080p.mkv', taille: 2 * GO, vu: 0, infos: {},
    anomalies: [{ code: 'sans_audio', gravite: 'crit', detail: 'aucune piste audio' }] },
  { chemin: '/mnt/media/media/movies/Nuit Blanche (2018)/Nuit Blanche (2018) WEBDL-1080p.mkv', taille: 9 * GO, vu: 0, infos: {},
    anomalies: [{ code: 'sans_sous_titres', gravite: 'info', detail: 'aucun sous-titre (intégré ou à côté du fichier)' }] },
]

export const menage: [string, string, MockHandler][] = [
  ['GET', '/media/menage', () => ({
    genere: Math.floor(Date.now() / 1000), analyses: 80, plex: { disponible: true, entrees: 368, erreur: '' }, total: total(), propositions,
    reglages: { jours: 180, qualites_faibles: ['CAM', 'DVD'], debit_min: 1.2, garder },
  })],
  ['POST', '/media/menage/garder', ({ body }) => {
    const b = body as { kind: string; id: number }
    garder.push(`${b.kind}:${b.id}`); propositions = propositions.filter((p) => p.cle !== `${b.kind}:${b.id}`)
    return { garder }
  }],
  ['PUT', '/media/menage/reglages', () => ({ jours: 180 })],
  ['POST', '/media/menage/supprimer', ({ body }) => {
    const b = body as { kind: string; id: number }
    propositions = propositions.filter((p) => p.cle !== `${b.kind}:${b.id}`)
    return { success: true }
  }],
  ['GET', '/media/sante', () => ({
    scan: { etat: 'termine', total: 80, fait: 80, saute: 0, erreurs: 0, debut: 0, fin: 0, courant: '' },
    reglages: { audio: ['eng', 'fre'], sous_titres: ['fre'], paralleles: 2 },
    synthese: { fichiers: 80, sains: 77, par_gravite: { crit: 1, warn: 1, info: 1 }, par_code: { dv_non_converti: 1, sans_audio: 1, sans_sous_titres: 1 } },
    total: lignes.length, lignes,
  })],
  ['POST', '/media/sante/scan', () => ({ etat: 'en_cours', total: 80, fait: 0 })],
  ['POST', '/media/sante/scan/annuler', () => ({ etat: 'annule' })],
  ['PUT', '/media/sante/reglages', () => ({ audio: ['eng', 'fre'], sous_titres: ['fre'], paralleles: 2 })],
  ['GET', '/recos', () => ({
    genere: Math.floor(Date.now() / 1000), source: 'modele', modele: 'llama3.2:3b', depart: 'plex',
    suggestions: [
      { titre: 'Les Veilleurs', annee: 2022, type: 'film', raison: 'dans la lignée des thrillers que tu as regardés ces derniers jours', tmdb_id: null },
      { titre: 'Mer de Cendres', annee: 2020, type: 'serie', raison: 'même ambiance que La Ville Basse', tmdb_id: null },
    ],
  })],
  ['POST', '/recos/generer', () => ({ success: true })],
]
