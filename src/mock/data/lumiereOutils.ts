// Outils de la lumière 3d en démonstration : pas de vraies lampes, donc le test et le calibrage répondent comme
// l'API quand rien n'est joignable... sauf une séquence fictive pour voir le rapport. L'import est simulé : il
// analyse le fichier comme l'API (version, noms en double renommés) mais ne modifie pas le pad de la démo.
// Brancher : importer `lumiereOutils` dans src/mock/routes.ts et l'étaler dans la table, avant `lumiere`.
import type { MockHandler } from '../router'

const LAMPES = [
  { id: '1', nom: 'Hue salon', joignable: true, canaux: [0] },
  { id: '2', nom: 'Hue coin télé', joignable: true, canaux: [1] },
  { id: '3', nom: 'Ruban télé', joignable: true, canaux: [2, 3] },
  { id: '4', nom: 'Lampe chambre', joignable: false, canaux: [] },
]
const NOMS_PRIS = ['kick', 'balayage', 'montée', 'tournoi', 'marée', 'phare', 'tempête', 'vague de fond', 'raz de marée', 'arc-en-ciel', 'neutron']

type Entree = { nom?: unknown; id?: unknown }
const noms = (l: unknown): string[] => (Array.isArray(l) ? l.map((x: Entree) => String(x?.nom ?? '')).filter(Boolean) : [])

function apercu(fichier: { version?: unknown; scenes?: unknown; sets?: unknown }) {
  if (typeof fichier?.version !== 'number' || fichier.version < 1) return { success: false, error: 'fichier sans numéro de version valide' }
  if (fichier.version > 1) return { success: false, error: 'fichier fait par une version plus récente : mets l’application à jour' }
  const pris = new Set(NOMS_PRIS)
  const final = (nom: string) => { let n = nom, i = 2; while (pris.has(n.toLowerCase())) n = `${nom} (${i++})`; pris.add(n.toLowerCase()); return n }
  const scenes = noms(fichier.scenes).map((nom) => { const f = final(nom); return { nom: f, renomme_de: f === nom ? null : nom } })
  const sets = (Array.isArray(fichier.sets) ? fichier.sets : []).map((s: { nom?: unknown; pas?: unknown[] }) => ({ nom: String(s?.nom ?? 'set'), renomme_de: null, etapes: Array.isArray(s?.pas) ? s.pas.length : 0 }))
  return { success: true, apercu: { scenes, sets, refus: [] } }
}

export const lumiereOutils: [string, string, MockHandler][] = [
  ['GET', '/spatial/outils/lampes', () => ({ success: true, lampes: LAMPES, allumee: null, huebeat: false })],
  ['POST', '/spatial/outils/calibrage/allumer', () => ({ success: true })],
  ['POST', '/spatial/outils/calibrage/arreter', () => ({ success: true, restauree: true })],
  ['GET', '/spatial/outils/test', () => ({
    etat: 'termine', total: 3, fait: 3, courant: null, erreur: null, resume: '3 lampes sur 3 répondent (démo)',
    rapport: LAMPES.slice(0, 3).map((l) => ({ id: l.id, nom: l.nom, canaux: l.canaux, etat: 'repond', raison: '', restauree: true })),
  })],
  ['POST', '/spatial/outils/test/lancer', () => ({ success: false, error: 'mode démo : pas de vraies lampes à tester' })],
  ['POST', '/spatial/outils/test/arreter', () => ({ success: true, deja: true, etat: 'repos', total: 0, fait: 0, courant: null, rapport: [], resume: '', erreur: null })],
  ['GET', '/spatial/outils/export', () => ({ success: true, fichier: { version: 1, format: 'neutroncore-lumiere', exporte_le: '2026-01-01T00:00:00+00:00', scenes: [], sets: [] } })],
  ['POST', '/spatial/outils/import/apercu', ({ body }) => apercu((body as { fichier: object }).fichier ?? {})],
  ['POST', '/spatial/outils/import', ({ body }) => {
    const a = apercu((body as { fichier: object }).fichier ?? {})
    return a.success ? { success: true, apercu: a.apercu, ajoutes: { scenes: a.apercu!.scenes.length, sets: a.apercu!.sets.length }, demo: true } : a
  }],
]
