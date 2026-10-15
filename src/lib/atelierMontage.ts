// Atelier 3D : le montage pas à pas (logique pure). La fiche de fabrication donne quelques
// longues phrases ; on en fait des gestes courts, on retrouve les pièces de chaque geste, et
// on calcule d'où chaque pièce arrive pour l'animation.

import { familyOf, type Article, type Etats, type EtapeFiche, type Piece, type Vec3 } from './atelier'

export type Boite = { min: Vec3; max: Vec3 }
export type Boites = Record<string, Boite>
export type MontageStep = {
  n: number               // numéro de l'étape de la fiche dont vient ce geste
  titre: string; astuce: string
  nouvelles: string[]     // pièces posées à ce geste
  reprises: string[]      // pièces déjà posées que ce geste manipule (une étape structurée les nomme de nouveau)
  deduites: string[]      // parmi elles, celles que le texte ne nomme pas : placées ici par proximité
  visibles: string[]      // tout ce qui est en place une fois le geste fait
}

const sansAccent = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const mots = (t: string) => sansAccent(t).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
const VERBE = /^[a-z]{2,}(er|ir|re)$/
const PRONOMS = ['le', 'la', 'les', 'se', 'y', 'en']
const COURT = 3          // mots : en dessous, un fragment n'est pas un geste à lui seul (« brancher », « boîtier vide »)
const centre = (b: Boite): Vec3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

function commenceParUnVerbe(fragment: string): string | null {
  const w = mots(fragment)
  if (w[0] && VERBE.test(w[0])) return fragment.trim().split(/\s+/)[0]
  return w[0] && PRONOMS.includes(w[0]) && w[1] && VERBE.test(w[1]) ? '' : null
}

/** Une phrase de la fiche → des gestes courts. Les parenthèses et ce qui suit « : »
 * deviennent l'astuce du geste ; un fragment sans verbe reprend celui du précédent
 * (« Poser la carte puis la cellule » → « Poser la carte », « Poser la cellule »). */
export function splitEtape(texte: string): { titre: string; astuce: string }[] {
  const notes: string[] = []
  const brut = texte.replace(/^\s*\d+[.)]\s*/, '').trim().replace(/\.$/, '')
    .replace(/\(([^()]*)\)/g, (_, dedans: string) => { notes.push(dedans.trim()); return ` @@${notes.length - 1}@@ ` })
  const fragments = brut.split(/\s*;\s*|\s*,?\s+puis\s+|\s*,\s+(?=[a-zA-Zéèêàç]+(?:er|ir|re)\s)/).map((f) => f.trim()).filter(Boolean)
  let verbe = ''
  const gestes: { titre: string; astuce: string }[] = []
  for (const fragment of fragments) {
    const astuces: string[] = []
    let corps = fragment.replace(/@@(\d+)@@/g, (_, i: string) => { astuces.push(notes[Number(i)]); return '' })
    const deuxPoints = corps.indexOf(' : ')
    if (deuxPoints > 0) { astuces.unshift(corps.slice(deuxPoints + 3).trim()); corps = corps.slice(0, deuxPoints) }
    corps = corps.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').replace(/[,\s]+$/, '').trim()
    if (!corps) { if (gestes.length && astuces.length) gestes[gestes.length - 1].astuce = [gestes[gestes.length - 1].astuce, ...astuces].filter(Boolean).join(' ; '); continue }
    const v = commenceParUnVerbe(corps)
    if (v) verbe = v
    else if (v === null && verbe) corps = `${verbe} ${corps}`
    gestes.push({ titre: corps, astuce: astuces.filter(Boolean).join(' ; ') })
  }
  // un fragment trop court rejoint son voisin
  const fusion: { titre: string; astuce: string }[] = []
  let attente: { titre: string; astuce: string } | null = null
  for (const g of gestes) {
    const joindre = (a: string, b: string) => [a, b].filter(Boolean).join(' ; ')
    if (attente) { fusion.push({ titre: `${attente.titre} puis ${g.titre.charAt(0).toLowerCase()}${g.titre.slice(1)}`, astuce: joindre(attente.astuce, g.astuce) }); attente = null }
    else if (g.titre.split(/\s+/).length >= COURT) fusion.push(g)
    else if (fusion.length) { const p = fusion[fusion.length - 1]; fusion[fusion.length - 1] = { titre: `${p.titre}, ${g.titre.charAt(0).toLowerCase()}${g.titre.slice(1)}`, astuce: joindre(p.astuce, g.astuce) } }
    else attente = g
  }
  if (attente) fusion.push(attente)
  return fusion.map((g) => ({ titre: majuscule(g.titre), astuce: g.astuce ? majuscule(g.astuce) : '' }))
}

// ---- quelle pièce à quel geste ----

/** Mots qui désignent une pièce. `tetes` : son nom propre (premier mot du nom, et premier mot de
 * la désignation de sa famille — « module » est appelé « carte » dans la fiche) ; `autres` : ce
 * qui la précise (« afficheur » dans « cale_afficheur »). */
function jetons(piece: Piece, cles: string[], designations: Record<string, string>): { tetes: string[]; autres: string[] } {
  const bon = (m: string) => m.length >= 3 && !/^\d+$/.test(m)
  const nom = mots(piece.nom.replace(/_/g, ' '))
  const tetes = [...new Set([nom[0] ?? '', mots(designations[familyOf(piece.nom, cles)] ?? '')[0] ?? ''])].filter(bon)
  return { tetes, autres: [...new Set(nom.slice(1))].filter((m) => bon(m) && !tetes.includes(m)) }
}

const DEBUT = 6      // un mot parmi les premiers du geste en est l'objet (« Poser la carte »)

/** Le nom propre de la pièce pèse 2 (3 s'il est l'objet du geste), une précision ou une
 * mention dans l'astuce pèse 1. */
function score(tokens: { tetes: string[]; autres: string[] }, titre: string[], astuce: string[]): number {
  const cite = (liste: string[], t: string) => liste.findIndex((m) => m === t || m === `${t}s` || m === `${t}x`)
  const tete = Math.max(0, ...tokens.tetes.map((t) => { const i = cite(titre, t); return i >= 0 ? (i < DEBUT ? 3 : 2) : cite(astuce, t) >= 0 ? 1 : 0 }))
  return tete + tokens.autres.filter((t) => cite(titre, t) >= 0 || cite(astuce, t) >= 0).length
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const volume = (b: Boite) => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2])
/** Distance entre deux boîtes (0 si elles se touchent ou se recouvrent). */
const ecart = (a: Boite, b: Boite) => Math.hypot(...[0, 1, 2].map((i) => Math.max(0, a.min[i] - b.max[i], b.min[i] - a.max[i])))
const CONTACT = 1        // mm : en dessous, deux pièces se touchent

/** Les gestes du montage, avec les pièces que chacun pose.
 * 1. une pièce va au geste qui la nomme le mieux ;
 * 2. à égalité, une pièce imprimée arrive à sa première mention, un composant au geste dont
 *    les pièces sûres sont les plus proches de lui (`boites` connues), sinon au premier ;
 * 3. une pièce que rien ne nomme rejoint sa voisine la plus proche et est signalée « déduite » ;
 *    sans géométrie, elle n'apparaît qu'à la vue d'ensemble finale. */
export function montageSteps(fiche: EtapeFiche[], pieces: Piece[], nomenclature: Article[], boites: Boites = {}): MontageStep[] {
  // la fiche est écrite par un agent et arrive par le réseau : on ne garde que ce qui a la bonne forme
  const montage = (Array.isArray(fiche) ? fiche : []).filter((e): e is EtapeFiche => typeof e === 'string' || (typeof e === 'object' && e !== null && typeof e.titre === 'string'))
  if (montage.length === 0) return []
  const cles = nomenclature.map((a) => a.cle)
  const designations = Object.fromEntries(nomenclature.map((a) => [a.cle, a.designation]))
  const montables = pieces.filter((p) => p.groupe !== 'gabarits')
  type Geste = { n: number; titre: string; astuce: string; fixes: string[] | null }
  const gestes = montage.flatMap((etape, i): Geste[] => (typeof etape === 'string'
    ? splitEtape(etape).map((g) => ({ n: i + 1, ...g, fixes: null }))
    : [{ n: i + 1, titre: etape.titre, astuce: typeof etape.astuce === 'string' ? etape.astuce : '', fixes: Array.isArray(etape.pieces) ? etape.pieces.filter((x) => typeof x === 'string') : [] }]))
  const place = new Map<string, number>()        // pièce → indice du geste
  const deduites = new Set<string>()
  // étapes structurées : le modèle a nommé les pièces (nom exact ou famille)
  const nommees = gestes.map((g) => (g.fixes ? montables.filter((p) => g.fixes!.some((f) => p.nom === f || familyOf(p.nom, cles) === f)).map((p) => p.nom) : []))
  nommees.forEach((noms, gi) => noms.forEach((n) => { if (!place.has(n)) place.set(n, gi) }))
  const lus = gestes.map((g) => ({ titre: mots(g.titre), astuce: mots(g.astuce) }))
  const egalites: { piece: Piece; candidats: number[] }[] = []
  for (const p of montables) {
    if (place.has(p.nom)) continue
    const tokens = jetons(p, cles, designations)
    const scores = gestes.map((g, gi) => (g.fixes ? 0 : score(tokens, lus[gi].titre, lus[gi].astuce)))
    const meilleur = Math.max(0, ...scores)
    if (meilleur === 0) continue
    const candidats = scores.flatMap((s, gi) => (s === meilleur ? [gi] : []))
    if (candidats.length === 1 || p.groupe === 'pieces') place.set(p.nom, candidats[0])
    else egalites.push({ piece: p, candidats })
  }
  const sures = [...place.entries()]
  for (const { piece, candidats } of egalites) {
    const b = boites[piece.nom]
    const proche = (gi: number) => (b ? Math.min(Infinity, ...sures.filter(([nom, at]) => gestes[at].n === gestes[gi].n && boites[nom]).map(([nom]) => dist(centre(b), centre(boites[nom])))) : Infinity)
    place.set(piece.nom, candidats.reduce((best, gi) => (proche(gi) < proche(best) ? gi : best), candidats[0]))
  }
  // pièces que rien ne nomme : avec celle qu'elles touchent (la plus petite, donc la plus précise :
  // un tourillon touche la béquille et le corps, il va avec la béquille), sinon avec la plus proche
  const placees = [...place.entries()].filter(([nom]) => boites[nom])
  const base = boiteDeBase(pieces, boites)
  for (const p of montables) {
    if (place.has(p.nom) || !boites[p.nom] || placees.length === 0) continue
    const b = boites[p.nom], c = centre(b)
    // la pièce de base contient tout le monde : la toucher ne dit rien
    const contact = placees.filter(([nom]) => boites[nom] !== base && ecart(b, boites[nom]) <= CONTACT)
    const voisine = contact.length
      ? contact.reduce((best, cur) => (volume(boites[cur[0]]) < volume(boites[best[0]]) ? cur : best))
      : placees.reduce((best, cur) => (dist(c, centre(boites[cur[0]])) < dist(c, centre(boites[best[0]])) ? cur : best))
    place.set(p.nom, voisine[1])
    deduites.add(p.nom)
  }
  const vus: string[] = []
  const steps = gestes.map((g, gi) => {
    const nouvelles = montables.filter((p) => place.get(p.nom) === gi).map((p) => p.nom)
    vus.push(...nouvelles)
    return { n: g.n, titre: g.titre, astuce: g.astuce, nouvelles, reprises: nommees[gi].filter((n) => !nouvelles.includes(n)), deduites: nouvelles.filter((n) => deduites.has(n)), visibles: [...vus] }
  })
  const reste = montables.filter((p) => !place.has(p.nom)).map((p) => p.nom)
  return [...steps, { n: montage.length + 1, titre: 'Vue d’ensemble', astuce: reste.length ? 'Les pièces qu’aucune étape ne nomme apparaissent ici.' : 'Le montage est terminé.', nouvelles: reste, reprises: [], deduites: [], visibles: [...vus, ...reste] }]
}

/** États de la vue pour un geste : ses pièces et celles déjà posées sont affichées
 * (`fantome` : les déjà posées passent en fantôme pour voir à travers), le reste est caché. */
export function montageEtats(pieces: Piece[], step: MontageStep, fantome = false): Etats {
  const now = new Set(step.nouvelles), before = new Set(step.visibles)
  return Object.fromEntries(pieces.map((p) => [p.nom, now.has(p.nom) ? 'shown' : before.has(p.nom) ? (fantome && step.nouvelles.length > 0 ? 'ghost' : 'shown') : 'hidden']))
}

/** « 6 × insert », « corps » : les pièces d'un geste, regroupées par famille. */
export function compterFamilles(noms: string[], cles: string[]): string[] {
  const compte = new Map<string, number>()
  for (const n of noms) { const f = familyOf(n, cles); compte.set(f, (compte.get(f) ?? 0) + 1) }
  return [...compte].map(([f, q]) => (q > 1 ? `${q} × ${f.replace(/_/g, ' ')}` : (noms.find((n) => familyOf(n, cles) === f) ?? f).replace(/_/g, ' ')))
}

// ---- d'où arrive une pièce ----

/** Pièce de base du montage : la plus grosse pièce imprimée (celle qui reçoit les autres). */
export function boiteDeBase(pieces: Piece[], boites: Boites): Boite | null {
  const candidates = pieces.filter((p) => p.groupe === 'pieces' && boites[p.nom]).map((p) => boites[p.nom])
  const toutes = candidates.length ? candidates : Object.values(boites)
  return toutes.length ? toutes.reduce((a, b) => (volume(b) > volume(a) ? b : a)) : null
}

/** Les pièces de l'objet fini : ni les gabarits de contrôle, ni un outil imprimé posé à côté
 * (un gabarit de pliage) — une pièce imprimée qui ne touche pas la base n'en fait pas partie. */
export function piecesProduit(pieces: Piece[], boites: Boites): string[] {
  const base = boiteDeBase(pieces, boites)
  return pieces.filter((p) => p.groupe !== 'gabarits' && !(p.groupe === 'pieces' && base && boites[p.nom] && ecart(boites[p.nom], base) > CONTACT)).map((p) => p.nom)
}

/** Direction (unitaire, sur un axe) d'où la pièce arrive dans l'animation.
 * Une pièce posée contre une face extérieure de la base arrive par cette face ; sinon elle
 * arrive le long de l'axe le plus mince de la base (un boîtier s'ouvre par sa grande face),
 * du côté du dos si elle est au dos, par le dessus sinon. */
export function insertionDir(piece: Boite, base: Boite): Vec3 {
  const c = centre(piece)
  const taille = [0, 1, 2].map((i) => Math.max(base.max[i] - base.min[i], 1e-6))
  const mince = taille.indexOf(Math.min(...taille))
  const dir: Vec3 = [0, 0, 0]
  for (const i of [0, 1, 2].filter((x) => x !== mince)) {
    if (c[i] < base.min[i] + taille[i] * 0.01) { dir[i] = -1; return dir }
    if (c[i] > base.max[i] - taille[i] * 0.01) { dir[i] = 1; return dir }
  }
  dir[mince] = c[mince] < base.min[mince] + taille[mince] * 0.15 ? -1 : 1
  return dir
}

/** Décalage de départ de chaque pièce d'un geste (elle glisse de là jusqu'à sa place). */
export function slideOffsets(noms: string[], boites: Boites, base: Boite | null): Record<string, Vec3> {
  if (!base) return {}
  const course = Math.max(base.max[0] - base.min[0], base.max[1] - base.min[1], base.max[2] - base.min[2]) * 0.55
  return Object.fromEntries(noms.filter((n) => boites[n]).map((n) => [n, insertionDir(boites[n], base).map((v) => v * course) as Vec3]))
}

/** Direction dominante d'un geste (celle du plus grand nombre de ses pièces), pour orienter la vue. */
export function dirDuGeste(noms: string[], boites: Boites, base: Boite | null): Vec3 {
  if (!base) return [0, 0, 1]
  const votes = new Map<string, number>()
  for (const n of noms) if (boites[n]) { const k = insertionDir(boites[n], base).join(','); votes.set(k, (votes.get(k) ?? 0) + 1) }
  const gagnant = [...votes].sort((a, b) => b[1] - a[1])[0]
  return gagnant ? gagnant[0].split(',').map(Number) as Vec3 : [0, 0, 1]
}
