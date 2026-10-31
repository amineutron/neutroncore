// Outils de la lumière 3d (calibrage, test des lampes, partage) : logique pure, sans réseau ni DOM.
import { fromSvg, moveLight, type Plan, type RoomDims } from './plan'

// ---- types des réponses de /spatial/outils ----

export type LampeInfo = { id: string; nom: string; joignable: boolean; canaux: number[] }
export type LigneTest = { id: string; nom: string; canaux: number[]; etat: 'repond' | 'ne_repond_pas'; raison: string; restauree: boolean | null }
export type EtatTest = {
  etat: 'repos' | 'en_cours' | 'termine' | 'interrompu' | 'erreur'
  total: number; fait: number; courant: string | null; rapport: LigneTest[]; resume: string; erreur: string | null
}
export type ApercuImport = {
  scenes: { nom: string; renomme_de: string | null }[]
  sets: { nom: string; renomme_de: string | null; etapes: number }[]
  refus: { type: 'scene' | 'set'; nom: string; raison: string }[]
}
export type FichierEchange = { version: number; format?: string; exporte_le?: string; scenes: unknown[]; sets: unknown[] }

export const MAX_OCTETS_IMPORT = 400_000      // même plafond que l'API (lib/spatial_outils.MAX_OCTETS)

// ---- calibrage ----

/** Les lampes que le plan connaît (on peut les recaler) et celles qu'il ignore (HALO doit d'abord les ajouter). */
export function lampesDuPlan(lampes: LampeInfo[], plan: Plan): { placables: LampeInfo[]; absentes: LampeInfo[] } {
  const placables = lampes.filter((l) => l.id in plan.configs)
  return { placables, absentes: lampes.filter((l) => !(l.id in plan.configs)) }
}

/** Point touché à l'écran -> position dans la pièce (cm, centrée), ramenée entre les murs.
 * `rect` : boîte du dessin à l'écran ; le dessin couvre toute la pièce. */
export function pointTouche(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, dims: RoomDims): { x: number; y: number } | null {
  if (!(rect.width > 0) || !(rect.height > 0)) return null
  const px = (clientX - rect.left) / rect.width, py = (clientY - rect.top) / rect.height
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null
  return fromSvg({ x: px * dims.w, y: py * dims.h }, dims)
}

/** Nouvelle position d'une lampe dans le brouillon (la hauteur est conservée). Inconnue : brouillon inchangé. */
export function recaler(plan: Plan, id: string, xy: { x: number; y: number }): Plan {
  return moveLight(plan, id, xy)
}

export function ecartCm(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y))
}

/** Lampes déplacées par rapport au plan enregistré : [{id, nom, ecart}], les plus grands écarts d'abord. */
export function deplacees(saved: Plan, draft: Plan): { id: string; nom: string; ecart: number }[] {
  return Object.entries(draft.configs)
    .map(([id, c]) => ({ id, nom: c.name, ecart: saved.configs[id] ? ecartCm(saved.configs[id].pos, c.pos) : 0 }))
    .filter((d) => d.ecart > 0)
    .sort((a, b) => b.ecart - a.ecart)
}

export function phraseCalibrage(rang: number, total: number, nom: string): string {
  return `lampe ${rang + 1} sur ${total} : ${nom} est allumée — touche l'endroit du plan où elle se trouve`
}

// ---- test des lampes ----

export const nomCanaux = (c: number[]): string => (c.length === 0 ? '' : c.length === 1 ? `canal ${c[0]}` : `canaux ${c.join(', ')}`)

export function progressionTest(e: Pick<EtatTest, 'fait' | 'total'>): number {
  return e.total > 0 ? Math.max(0, Math.min(100, Math.round((e.fait / e.total) * 100))) : 0
}

export function titreTest(e: EtatTest): string {
  switch (e.etat) {
    case 'en_cours': return e.courant ? `test en cours : ${e.courant}` : 'test en cours'
    case 'termine': return e.resume || 'test terminé'
    case 'interrompu': return e.resume || 'test arrêté'
    case 'erreur': return e.erreur || 'le test s’est arrêté'
    default: return ''
  }
}

/** Lampes qui ne répondent pas, ou qui n'ont pas pu être remises comme avant (à signaler en rouge). */
export function problemesTest(rapport: LigneTest[]): LigneTest[] {
  return rapport.filter((l) => l.etat !== 'repond' || l.restauree === false)
}

// ---- partage ----

export function nomFichierExport(quand: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `lumiere-${quand.getFullYear()}${p(quand.getMonth() + 1)}${p(quand.getDate())}.json`
}

/** Contrôle côté écran, avant d'envoyer : l'API refait la vraie validation (c'est elle qui décide). */
export function lireFichier(texte: string): { ok: true; fichier: FichierEchange } | { ok: false; erreur: string } {
  if (texte.length > MAX_OCTETS_IMPORT) return { ok: false, erreur: 'ce fichier est trop gros pour être un export de scènes' }
  let brut: unknown
  try { brut = JSON.parse(texte) } catch { return { ok: false, erreur: 'ce fichier n’est pas du JSON lisible' } }
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { ok: false, erreur: 'ce fichier n’est pas un export de scènes' }
  const f = brut as Record<string, unknown>
  if (typeof f.version !== 'number' || !Number.isInteger(f.version) || f.version < 1) return { ok: false, erreur: 'ce fichier n’a pas de numéro de version : ce n’est pas un export de cette application' }
  if (f.scenes !== undefined && !Array.isArray(f.scenes)) return { ok: false, erreur: 'la liste des scènes est illisible' }
  if (f.sets !== undefined && !Array.isArray(f.sets)) return { ok: false, erreur: 'la liste des sets est illisible' }
  return { ok: true, fichier: { ...f, version: f.version, scenes: (f.scenes as unknown[]) ?? [], sets: (f.sets as unknown[]) ?? [] } as FichierEchange }
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

export function phraseApercu(a: ApercuImport): string {
  const ajout = [a.scenes.length && pluriel(a.scenes.length, 'scène', 'scènes'), a.sets.length && pluriel(a.sets.length, 'set', 'sets')].filter(Boolean)
  if (ajout.length === 0) return a.refus.length ? 'rien à ajouter : tout ce qui est dans le fichier est refusé' : 'ce fichier ne contient rien'
  const renommes = a.scenes.filter((s) => s.renomme_de).length + a.sets.filter((s) => s.renomme_de).length
  return `sera ajouté : ${ajout.join(' et ')}` + (renommes ? ` (${pluriel(renommes, 'nom déjà pris, renommé', 'noms déjà pris, renommés')})` : '') +
    (a.refus.length ? ` ; ${pluriel(a.refus.length, 'élément refusé', 'éléments refusés')}` : '')
}

export const importPossible = (a: ApercuImport): boolean => a.scenes.length + a.sets.length > 0

/** Coche / décoche un identifiant sans toucher à la liste d'origine. */
export function basculer(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

/** ?scenes=a,b&sets=c pour GET /spatial/outils/export ; tout coché = pas de filtre (tout est exporté). */
export function requeteExport(choisies: string[], toutesScenes: string[], choisis: string[], tousSets: string[]): string {
  const tout = (c: string[], t: string[]) => t.length > 0 && t.every((x) => c.includes(x)) && c.length === t.length
  const q = new URLSearchParams()
  if (!tout(choisies, toutesScenes)) q.set('scenes', choisies.join(','))
  if (!tout(choisis, tousSets)) q.set('sets', choisis.join(','))
  const s = q.toString()
  return s ? `?${s}` : ''
}
