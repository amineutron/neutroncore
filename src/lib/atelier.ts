// Atelier 3D : types et logique pure (aucun three.js ici, tout est testable sans navigateur).
// Les données viennent de l'API /modelisation, qui lit les sorties du projet modelisation-3d.

export type Vec3 = [number, number, number]
export type Groupe = 'pieces' | 'composants' | 'gabarits'
export type Piece = { nom: string; groupe: Groupe; chemin: string }
// trois états : affichée, fantôme (opacité faible : on devine la pièce), cachée
export type Etat = 'shown' | 'ghost' | 'hidden'
export type Etats = Record<string, Etat>
export type Nature = 'geometrie' | 'spec' | 'calcul' | 'indicateur'
export type Controle = { nom: string; ok: boolean; mesure: number | null; limite: number | null; detail: string; nature: string }
export type Decompte = Record<string, { ok: number; total: number }>
export type Article = { cle: string; quantite: number; designation: string; consommable?: boolean }
// relevé de prix (specs/<modele>.prix.yaml) : un INDICE, pas un devis
export type PrixArticle = { nature?: string; nom_recherche?: string; conditionnement?: string; prix_lot_min?: number | null; prix_lot_max?: number | null; plateformes?: string[]; confiance?: string; remarque?: string; inclus?: boolean }
export type Prix = { releve_le?: string; devise?: string; note?: string; articles?: Record<string, PrixArticle> }
export type Resume = {
  pieces_imprimees?: { nom: string; designation: string; quantite: number; volume_cm3: number | null; masse_g: number | null }[]
  nomenclature?: Article[]; montage?: EtapeFiche[]; prix?: Prix | null
  haut?: string          // axe qui pointe vers le haut dans le modèle : « y » ou « z »
  limites_usage?: { nom: string; mesure: number; detail: string }[]
}
// une étape de la fiche de montage : une phrase, ou une étape structurée dont le modèle nomme les pièces
export type EtapeFiche = string | { titre: string; astuce?: string; pieces?: string[] }
export type Iteration = { numero: number; verdict: string; demande?: string; refs?: number[]; pieces?: string[]; le?: string }
export type Jeu = {
  nom: string; iteration: string; courant: { numero?: number; etape?: string; attente?: unknown }; iterations: Iteration[]
  pieces: Piece[]; images: { nom: string; chemin: string }[]; documents: { nom: string; chemin: string }[]; impression?: string[]
  controles: Controle[]; decompte: Decompte; resume: Resume | null; maj: number
}

export const ETAT_LABEL: Record<Etat, string> = { shown: 'affichée', ghost: 'fantôme', hidden: 'cachée' }
export const GROUPE_LABEL: Record<Groupe, string> = { pieces: 'pièces imprimées', composants: 'composants', gabarits: 'gabarits de contrôle' }

/** affichée → fantôme → cachée → affichée */
export function nextEtat(e: Etat): Etat {
  return e === 'shown' ? 'ghost' : e === 'ghost' ? 'hidden' : 'shown'
}

/** État de départ : tout est affiché, sauf les gabarits (volumes de contrôle, pas des pièces). */
export function defaultEtats(pieces: Piece[]): Etats {
  return Object.fromEntries(pieces.map((p) => [p.nom, p.groupe === 'gabarits' ? 'hidden' : 'shown']))
}

/** Garde les réglages des pièces qui existent encore (changement d'itération), défaut pour les nouvelles. */
export function mergeEtats(old: Etats, pieces: Piece[]): Etats {
  const base = defaultEtats(pieces)
  return Object.fromEntries(pieces.map((p) => [p.nom, old[p.nom] ?? base[p.nom]]))
}

export function setEtat(etats: Etats, noms: string[], etat: Etat): Etats {
  return { ...etats, ...Object.fromEntries(noms.filter((n) => n in etats).map((n) => [n, etat])) }
}

/** État commun d'un ensemble de pièces, ou « mixed ». */
export function etatCommun(etats: Etats, noms: string[]): Etat | 'mixed' {
  const seen = new Set(noms.map((n) => etats[n]).filter(Boolean))
  return seen.size === 1 ? [...seen][0] : 'mixed'
}

/** Focus : la sélection est affichée, le reste passe en fantôme — ce qui était caché le reste. */
export function focusEtats(etats: Etats, selection: string[]): Etats {
  if (selection.length === 0) return etats
  const sel = new Set(selection)
  return Object.fromEntries(Object.entries(etats).map(([n, e]) => [n, sel.has(n) ? 'shown' : e === 'hidden' ? 'hidden' : 'ghost']))
}

/** Isoler : seule la sélection reste visible. */
export function isolerEtats(etats: Etats, selection: string[]): Etats {
  if (selection.length === 0) return etats
  const sel = new Set(selection)
  return Object.fromEntries(Object.keys(etats).map((n) => [n, sel.has(n) ? 'shown' : 'hidden']))
}

/** Clic simple = cette pièce seule ; avec « multi » (Ctrl, Maj, ou mode sélection multiple au doigt) on ajoute ou retire. */
export function toggleSelection(selection: string[], nom: string, multi: boolean): string[] {
  if (!multi) return selection.length === 1 && selection[0] === nom ? [] : [nom]
  return selection.includes(nom) ? selection.filter((n) => n !== nom) : [...selection, nom]
}

/** Maj + clic dans la liste : tout ce qui est entre la dernière pièce touchée (`ancre`) et
 * celle-ci rejoint la sélection, dans l'ordre affiché. Sans ancre connue, la pièce seule. */
export function rangeSelection(ordre: string[], ancre: string | null, nom: string, selection: string[]): string[] {
  const a = ancre === null ? -1 : ordre.indexOf(ancre), b = ordre.indexOf(nom)
  if (b < 0) return selection
  const plage = a < 0 ? [nom] : ordre.slice(Math.min(a, b), Math.max(a, b) + 1)
  return [...selection, ...plage.filter((n) => !selection.includes(n))]
}

// ---- familles : les 6 vis, les 24 cales… se règlent d'un geste ----

/** Famille d'une pièce : la plus longue clé de nomenclature qui préfixe son nom, sinon son nom. */
export function familyOf(nom: string, cles: string[]): string {
  const hit = cles.filter((c) => nom === c || nom.startsWith(`${c}_`)).sort((a, b) => b.length - a.length)[0]
  return hit ?? nom
}

export type Famille = { cle: string; pieces: Piece[] }
export function groupPieces(pieces: Piece[], cles: string[]): { groupe: Groupe; familles: Famille[] }[] {
  return (['pieces', 'composants', 'gabarits'] as Groupe[]).map((groupe) => {
    const map = new Map<string, Piece[]>()
    for (const p of pieces.filter((x) => x.groupe === groupe)) {
      const cle = groupe === 'composants' ? familyOf(p.nom, cles) : p.nom
      map.set(cle, [...(map.get(cle) ?? []), p])
    }
    return { groupe, familles: [...map.entries()].map(([cle, list]) => ({ cle, pieces: list })) }
  }).filter((g) => g.familles.length > 0)
}

/** « cale_afficheur_+x » → « cale afficheur +x » */
export function pieceLabel(nom: string): string {
  return nom.replace(/_/g, ' ')
}

/** Axe vertical d'un modèle : le choix de l'utilisateur d'abord, puis ce que dit le modèle, sinon y. */
export function axeHaut(choix: string | null | undefined, resume: Resume | null): 'y' | 'z' {
  const v = (choix || resume?.haut || '').toLowerCase()
  return v === 'z' ? 'z' : 'y'
}

/** Nom de projet à partir d'un titre libre : « Support de casque » → « support_de_casque ».
 * Rend '' si rien d'utilisable (le nom doit commencer par une lettre, 64 caractères au plus). */
export function slugProjet(titre: string): string {
  const s = titre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^[_0-9]+|_+$/g, '')
  return s.slice(0, 64).replace(/_+$/, '')
}

// ---- géométrie : centre, éclaté ----

export function centroid(centers: Record<string, Vec3>, noms: string[]): Vec3 | null {
  const pts = noms.map((n) => centers[n]).filter(Boolean)
  if (pts.length === 0) return null
  return [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length) as Vec3
}

/** Décalage de chaque pièce pour une vue éclatée : elle s'éloigne de `origine` le long de
 * la droite origine → centre de la pièce, d'une distance proportionnelle (`facteur`, 0 = en place).
 * Les pièces de `fixes` (la sélection autour de laquelle on éclate) ne bougent pas.
 * Une pièce posée exactement sur l'origine part vers le haut, pour ne pas rester confondue. */
export function explodeOffsets(centers: Record<string, Vec3>, origine: Vec3, facteur: number, fixes: string[] = [], ecart = 0): Record<string, Vec3> {
  const still = new Set(fixes)
  return Object.fromEntries(Object.entries(centers).map(([nom, c]) => {
    if (facteur <= 0 || still.has(nom)) return [nom, [0, 0, 0] as Vec3]
    const d: Vec3 = [c[0] - origine[0], c[1] - origine[1], c[2] - origine[2]]
    const len = Math.hypot(...d)
    if (len < 1e-6) return [nom, [0, facteur * Math.max(10, ecart), 0] as Vec3]
    // `ecart` : distance ajoutée à toutes les pièces, pour que deux pièces empilées près du centre (un bac et
    // son couvercle) se séparent franchement au lieu de bouger de quelques millimètres
    return [nom, d.map((v) => v * facteur + (v / len) * ecart * facteur) as Vec3]
  }))
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** « 12,4 mm », et l'écart par axe pour une mesure entre deux points. */
export function mesureLabel(a: Vec3, b: Vec3): { total: string; axes: string } {
  const f = (v: number) => v.toFixed(1).replace('.', ',')
  return { total: `${f(distance(a, b))} mm`, axes: `x ${f(Math.abs(a[0] - b[0]))} · y ${f(Math.abs(a[1] - b[1]))} · z ${f(Math.abs(a[2] - b[2]))}` }
}

// ---- contrôles ----

export const NATURES: { cle: string; label: string; aide: string }[] = [
  { cle: 'geometrie', label: 'géométrie', aide: 'mesuré sur les solides : le seul décompte qui parle de la forme' },
  { cle: 'spec', label: 'spec', aide: 'calcul entre cotes de la spec' },
  { cle: 'calcul', label: 'calcul', aide: 'résistance des matériaux en première approche, pas une simulation' },
  { cle: 'indicateur', label: 'indicateur', aide: 'valeur publiée sans verdict' },
]

export function controlsSummary(decompte: Decompte): { ok: number; total: number; echecs: number; parNature: { cle: string; label: string; ok: number; total: number }[] } {
  const parNature = NATURES.filter((n) => decompte[n.cle]).map((n) => ({ cle: n.cle, label: n.label, ...decompte[n.cle] }))
  const ok = parNature.reduce((s, n) => s + n.ok, 0)
  const total = parNature.reduce((s, n) => s + n.total, 0)
  return { ok, total, echecs: total - ok, parNature }
}

export type ControlFilter = { q: string; nature: string; echecs: boolean }
/** Échecs d'abord, puis par nom ; filtre texte sur le nom et le détail. */
export function filterControls(controles: Controle[], f: ControlFilter): Controle[] {
  const q = f.q.trim().toLowerCase()
  return controles
    .filter((c) => (!f.echecs || !c.ok) && (!f.nature || c.nature === f.nature) && (!q || c.nom.toLowerCase().includes(q) || (c.detail ?? '').toLowerCase().includes(q)))
    .sort((a, b) => Number(a.ok) - Number(b.ok) || a.nom.localeCompare(b.nom))
}

/** Pièces dont le nom apparaît dans le nom du contrôle (« interference:corps:couvercle » → corps, couvercle). */
export function piecesOfControl(nom: string, pieces: string[]): string[] {
  // mots entiers seulement : « surface_min » ne désigne pas la pièce « face »
  const mots = nom.toLowerCase().split(/[:,;/\s_]+/).filter(Boolean)
  const cite = (piece: string) => {
    const parts = piece.toLowerCase().split('_').filter(Boolean)
    return parts.length > 0 && mots.some((_, i) => parts.every((part, k) => mots[i + k] === part))
  }
  return pieces.filter(cite).slice(0, 6)
}

export function controlValue(c: Controle): string {
  const f = (v: number | null) => (v === null || v === undefined ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','))
  return c.nature === 'indicateur' ? f(c.mesure) : `${f(c.mesure)} / ${f(c.limite)}`
}

// ---- matériaux à acheter (hors impression) ----

export type MaterialRow = {
  cle: string; designation: string; quantite: number; recherche: string
  nature: string         // ce que c'est, en clair (« batterie ») : une référence seule ne parle à personne
  conditionnement: string; min: number | null; max: number | null; plateformes: string[]; confiance: string; remarque: string
  inclus: boolean        // livré avec un autre article : rien à acheter à part
  consommable: boolean   // se consomme (filament, ruban d'étiquette) : pas une pièce de l'objet
}
export function materialRows(resume: Resume | null): MaterialRow[] {
  const articles = resume?.prix?.articles ?? {}
  return (resume?.nomenclature ?? []).map((a) => {
    const p = articles[a.cle] ?? {}
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
    return {
      cle: a.cle, designation: a.designation, quantite: a.quantite, nature: typeof p.nature === 'string' ? p.nature.trim() : '', recherche: p.nom_recherche?.trim() || a.designation,
      conditionnement: p.conditionnement ?? '', min: num(p.prix_lot_min), max: num(p.prix_lot_max),
      plateformes: Array.isArray(p.plateformes) ? p.plateformes : [], confiance: p.confiance ?? '', remarque: p.remarque ?? '', inclus: p.inclus === true, consommable: a.consommable === true,
    }
  })
}

/** Total indicatif : somme des fourchettes des lots (un lot couvre souvent plus que le besoin).
 * `manquants` : articles sans prix relevé — le total est alors un minimum, on le dit. */
export function materialTotal(rows: MaterialRow[]): { min: number; max: number; manquants: number } {
  const priced = rows.filter((r) => r.min !== null || r.max !== null)
  return {
    min: priced.reduce((s, r) => s + (r.min ?? r.max ?? 0), 0), max: priced.reduce((s, r) => s + (r.max ?? r.min ?? 0), 0),
    manquants: rows.filter((r) => !r.inclus).length - priced.filter((r) => !r.inclus).length,
  }
}

export function euros(v: number): string {
  return `${v.toFixed(2).replace('.', ',')} €`
}
export function priceRange(min: number | null, max: number | null, inclus = false): string {
  if (min === null && max === null) return inclus ? 'inclus' : 'prix non relevé'
  if (min === null || max === null || min === max) return euros((min ?? max) as number)
  return `${euros(min)} – ${euros(max)}`
}

// ---- pipeline et itérations ----

export const ETAPES = ['recherche', 'concept', 'test', 'contrôle', 'humain'] as const
/** Étape en cours d'après le texte libre de iteration.json (« concept-3d », « Terminée, en attente… »). */
export function etapeIndex(etape: string | undefined): number {
  const t = (etape ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!t) return -1
  if (/(termine|attente|decision|humain|arbitrage|escalad|present)/.test(t)) return 4
  if (/controle/.test(t)) return 3
  if (/test/.test(t)) return 2
  if (/concept/.test(t)) return 1
  if (/recherche/.test(t)) return 0
  return -1
}

/** Une question de la boucle : son texte, les pièces dont elle parle, son mini-plan, et les solutions proposées. */
export type OptionAttente = { nom: string; texte: string; image: string }
export type PointAttente = { texte: string; pieces: string[]; image: string; detail: string; recommande: string; options: OptionAttente[] }
export type Attente = { motif: 'decision' | 'probleme' | 'information'; texte: string; points: PointAttente[] }
export const MOTIF_ATTENTE: Record<Attente['motif'], string> = { decision: 'attend ta décision', probleme: 'arrêtée sur un problème', information: 'attend une information' }

const texteDe = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
// chemin d'image relatif aux sorties du modèle : rien qui remonte, png ou gif seulement (l'API revérifie)
const imageDe = (v: unknown): string => { const c = texteDe(v); return /^[\w][\w./-]*\.(png|gif)$/.test(c) && !c.includes('..') ? c : '' }
function lirePoint(p: unknown): PointAttente | null {
  if (typeof p === 'string') return p.trim() ? { texte: p.trim(), pieces: [], image: '', detail: '', recommande: '', options: [] } : null
  if (!p || typeof p !== 'object') return null
  const o = p as Record<string, unknown>
  const texte = texteDe(o.texte)
  if (!texte) return null
  const options = (Array.isArray(o.options) ? o.options : []).flatMap((x): OptionAttente[] => {
    const t = x && typeof x === 'object' ? texteDe((x as Record<string, unknown>).texte) : ''
    return t ? [{ nom: texteDe((x as Record<string, unknown>).nom), texte: t, image: imageDe((x as Record<string, unknown>).image) }] : []
  })
  return { texte, pieces: (Array.isArray(o.pieces) ? o.pieces : []).filter((n): n is string => typeof n === 'string' && n !== ''), image: imageDe(o.image), detail: imageDe(o.detail), recommande: texteDe(o.recommande), options }
}

/** Ce que la boucle attend de toi, d'après iteration.json (écrit par `instantane.py --attente`), ou null.
 * Un point est une phrase, ou une question illustrée (`--points-json`). Le fichier vient d'un autre projet :
 * tout champ mal formé est ignoré plutôt que de casser l'écran. */
export function lireAttente(brut: unknown): Attente | null {
  if (!brut || typeof brut !== 'object') return null
  const b = brut as Record<string, unknown>
  const texte = texteDe(b.texte)
  if (!texte) return null
  const motif = b.motif === 'probleme' || b.motif === 'information' ? b.motif : 'decision'
  const points = (Array.isArray(b.points) ? b.points : []).flatMap((p) => lirePoint(p) ?? [])
  return { motif, texte, points }
}

/** Pièces dont parle une question, quand la boucle ne les a pas données : celles dont le nom (son premier mot,
 * au singulier ou au pluriel) est écrit dans le texte. « tourillon » désigne les deux tourillons. */
export function piecesCitees(texte: string, noms: string[]): string[] {
  const mots = new Set(texte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean))
  return noms.filter((n) => { const tete = n.toLowerCase().split('_')[0]; return tete.length >= 4 && (mots.has(tete) || mots.has(`${tete}s`)) }).slice(0, 8)
}

/** Pièces à montrer pour une question : celles que la boucle désigne et qui existent, sinon celles que le texte nomme. */
export function piecesDuPoint(p: Pick<PointAttente, 'texte' | 'pieces'>, noms: string[]): string[] {
  const donnees = p.pieces.filter((n) => noms.includes(n))
  return donnees.length > 0 ? donnees : piecesCitees(p.texte, noms)
}

/** Premier mot du verdict : reboucler, présenter, escalader, arbitrage. */
export function verdictTone(verdict: string): 'ok' | 'warn' | 'crit' | '' {
  const t = verdict.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (t.startsWith('present')) return 'ok'
  if (t.startsWith('reboucl') || t.startsWith('arbitrage')) return 'warn'
  if (t.startsWith('escalad')) return 'crit'
  return ''
}

export const MAX_DEMANDE = 2000
export type Demande = { modele: string; texte: string; pieces: string[]; refs: number[]; vue?: string }

/** Texte envoyé à la boucle d'agents. Les pièces désignées et les itérations de référence
 * sont écrites en clair : c'est ce qui donne le contexte (« la jonction entre A et B »). */
export function buildDemande(d: Demande): string {
  const lignes = [d.texte.trim()]
  if (d.pieces.length > 0) lignes.push(`Pièces concernées : ${d.pieces.join(', ')}.`)
  if (d.refs.length > 0) lignes.push(`Itérations de référence : ${[...d.refs].sort((a, b) => a - b).join(', ')} (sorties/${d.modele}/iterations/<n>/).`)
  if (d.vue) lignes.push(`Vue au moment de la demande : ${d.vue}.`)
  return lignes.join('\n')
}

export function demandeError(d: Demande): string {
  if (!d.texte.trim()) return 'écris ta demande'
  if (buildDemande(d).length > MAX_DEMANDE) return `demande trop longue (${MAX_DEMANDE} caractères au plus)`
  return ''
}

/** Contrôles qui ont changé d'état entre deux itérations (comparaison facultative). */
export function controlsDiff(avant: Controle[], apres: Controle[]): { repares: string[]; casses: string[]; nouveaux: string[]; disparus: string[] } {
  const a = new Map(avant.map((c) => [c.nom, c.ok])), b = new Map(apres.map((c) => [c.nom, c.ok]))
  return {
    repares: [...b].filter(([n, ok]) => ok && a.get(n) === false).map(([n]) => n),
    casses: [...b].filter(([n, ok]) => !ok && a.get(n) === true).map(([n]) => n),
    nouveaux: [...b.keys()].filter((n) => !a.has(n)),
    disparus: [...a.keys()].filter((n) => !b.has(n)),
  }
}

/** Parmi les pièces d'une question, celles à mettre en avant en mode fantôme : une pièce qui en enveloppe une
 * qui enveloppe toutes les autres (le corps autour de la béquille et de son étrier) sert de décor, sinon elle
 * cacherait celles dont on parle. « Envelopper » : toucher l'autre et faire au moins une fois et demie son volume (boîtes englobantes). */
export function piecesEnAvant(concernees: string[], boites: Record<string, { min: Vec3; max: Vec3 }>): string[] {
  const vol = (n: string) => { const b = boites[n]; return b ? (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]) : 0 }
  // les deux boîtes se touchent ou se chevauchent : une béquille dépliée sort du corps, mais y reste attachée
  const contient = (grand: string, petit: string) => {
    const g = boites[grand], p = boites[petit]
    return Boolean(g && p) && [0, 1, 2].every((i) => p.max[i] >= g.min[i] && p.min[i] <= g.max[i])
  }
  // décor : la pièce qui enveloppe TOUTES les autres (pas la béquille parce qu'elle entoure son étrier)
  const decor = concernees.filter((g) => concernees.length > 1 && concernees.every((p) => p === g || (vol(p) > 0 && vol(g) >= 1.5 * vol(p) && contient(g, p))))
  const reste = concernees.filter((n) => !decor.includes(n))
  return reste.length > 0 ? reste : concernees
}
