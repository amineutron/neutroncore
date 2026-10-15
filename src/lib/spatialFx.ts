// Effets de lumière dans l'espace (logique pure). Un effet est une forme qui vit dans la pièce —
// une onde qui part d'un point, un mur qui la traverse, une source qui tourne — et chaque
// appareil prend la couleur de ce qui passe là où il est. Rien ici ne sait dessiner ni piloter
// une vraie lampe : c'est le même calcul pour la simulation et, plus tard, pour le pont Hue.
//
// Repère, en centimètres : x = gauche/droite et y = avant/arrière, centrés sur la pièce ;
// z = hauteur depuis le sol.

export type Vec3 = [number, number, number]
export type Dims = { w: number; h: number; d: number }           // largeur, profondeur, hauteur
// lampe : ampoule ou applique ; par : projecteur fixe ; projo : lyre (faisceau orientable) ;
// barre : un point d'une barre ou d'un ruban à LED ; strobe : stroboscope
export type FixtureKind = 'lampe' | 'par' | 'projo' | 'barre' | 'strobe'
export type Fixture = { id: string; kind: FixtureKind; pos: Vec3; aim?: Vec3; label?: string }

export type FxId = 'onde' | 'mur' | 'orbite' | 'maree' | 'phare' | 'raz'
export const EFFETS: { id: FxId; label: string; desc: string }[] = [
  { id: 'onde', label: 'onde de choc', desc: 'À chaque temps, une sphère part du point source et grossit : les appareils flashent quand elle les atteint.' },
  { id: 'mur', label: 'mur de lumière', desc: 'Un plan traverse la pièce d’un bout à l’autre, une traversée par mesure.' },
  { id: 'orbite', label: 'source mobile', desc: 'Un point lumineux tourne autour de la pièce ; les appareils s’allument sur son passage.' },
  { id: 'maree', label: 'marée', desc: 'La lumière monte du sol au plafond puis redescend, avec un coup sur chaque temps.' },
  { id: 'phare', label: 'phare', desc: 'Un faisceau tourne autour du point source, un tour par mesure.' },
  { id: 'raz', label: 'raz de marée', desc: 'Une vague part du point source vers l’extérieur et submerge la pièce : elle monte du sol, descend du plafond, ou s’étend vers le haut et le bas depuis la hauteur du point.' },
]
export type Axe = 'x' | 'y' | 'z'
// d'où part le raz de marée, en hauteur : du sol, de la hauteur du point (vers le haut et le bas à la fois), ou du plafond
export type Depart = 'bas' | 'centre' | 'haut'
// Réglages de pulsation, communs à toutes les scènes (curseurs de 0 à 100) :
// attaque = temps de montée après le temps ; retombee = durée du fondu de sortie ; profondeur = à quel point la
// lumière respire avec la musique (0 = l'effet seul, 100 = tout suit la pulsation) ; plancher = lumière qui reste entre deux temps ;
// vie = sur combien de temps s'étale une pulsation (0 = un temps, 33 = deux, 67 = une mesure de quatre, 100 = deux mesures)
export type Pulsation = { attaque: number; retombee: number; profondeur: number; plancher: number; vie?: number }
/** `auto` : huebeat règle lui-même la sensibilité, le curseur ne sert plus. */
export type Commun = Pulsation & { intensite: number; sensibilite: number; vie: number; auto?: boolean }
export const COMMUN_DEFAUT: Commun = { intensite: 100, sensibilite: 68, attaque: 0, retombee: 60, profondeur: 0, plancher: 0, vie: 0 }
/** 3d : la lumière voyage dans la pièce depuis le point source. 2d : pas de trajet, toutes les lampes réagissent sur le temps. */
export type Mode = '3d' | '2d'
/** En 2d : toutes les lampes ensemble, ou une sur deux en alternance à chaque temps (la scène Iron Man de huebeat). */
export type Groupe = 'tous' | 'alterne'
export type FxParams = { mode?: Mode; groupe?: Groupe; source: Vec3; axe: Axe; palette: string; couleurs?: string[]; intensite: number; depart?: Depart; pulse?: Pulsation; general?: number; couches?: Partial<Record<FxId, Couche>> }
/** Ce qu'un effet joue à sa façon dans une scène (déjà converti : cm, 0..1) ; le reste vient de la scène. `tempo`
 * multiplie le tempo de la musique pour cet effet seulement (0,5 = deux fois plus lent). */
export type Couche = Partial<Pick<FxParams, 'palette' | 'couleurs' | 'intensite' | 'source' | 'axe' | 'depart' | 'pulse'>> & { tempo?: number }
/** Réglages propres à un effet, tels qu'une scène les garde (pourcentages, comme la scène elle-même). */
export type Surcharge = { palette?: string; couleurs?: string[]; intensite?: number; source?: { x: number; y: number; z: number }; axe?: Axe; depart?: Depart; respiration?: Partial<Pulsation>; tempo?: number }
export const TEMPOS: { k: number; label: string }[] = [
  { k: 0.25, label: 'quatre fois plus lent' }, { k: 0.5, label: 'deux fois plus lent' }, { k: 1, label: 'au tempo de la musique' }, { k: 2, label: 'deux fois plus vite' },
]
/** Paramètres avec lesquels joue l'effet `fx`, et à quelle vitesse. Miroir de `couche_de` (spatial_fx.py). */
export function coucheDe(p: FxParams, fx: FxId): { p: FxParams; k: number } {
  const c = p.couches?.[fx]
  if (!c) return { p, k: 1 }
  const { tempo, ...reste } = c
  return { p: { ...p, ...reste }, k: tempo ?? 1 }
}

/** Forme de la pulsation sur un temps (`phase` de 0 à 1) : montée pendant l'attaque, puis fondu de sortie. 0..1. */
export function enveloppe(phase: number, p: Pick<Pulsation, 'attaque' | 'retombee'>): number {
  const a = (clamp01(p.attaque / 100)) * 0.5
  const duree = 0.1 + clamp01(p.retombee / 100) * 0.9
  const e = phase < a ? phase / a : Math.max(0, 1 - (phase - a) / duree)
  return e * e
}

const VIES = [1, 2, 4, 8]
/** Nombre de temps que dure une pulsation pour le curseur `vie` (0..100). Toujours une puissance de deux : les
 * pulsations restent calées sur les temps et les mesures. */
export function tempsDeVie(vie: number | undefined): number {
  return VIES[Math.round(clamp01((vie ?? 0) / 100) * 3)]
}
/** Numéro de la pulsation en cours (`n`) et où on en est dans sa vie (`phase`, 0..1). Miroir de `phase_de_vie`. */
export function phaseDeVie(beat: number, vie: number | undefined): { n: number; phase: number } {
  const t = tempsDeVie(vie), n = Math.floor(beat / t)
  return { n, phase: (beat - n * t) / t }
}

/** Ce par quoi la pulsation multiplie la lumière : 1 sans profondeur, entre le plancher et 1 sinon. */
export function gainPulsation(phase: number, p: Pulsation | undefined): number {
  if (!p) return 1
  const plancher = clamp01(p.plancher / 100), profondeur = clamp01(p.profondeur / 100)
  return plancher + (1 - plancher) * (1 - profondeur + profondeur * enveloppe(phase, p))
}
export type RGB = [number, number, number]            // 0..1
export type Sortie = { rgb: RGB; niveau: number; vise: Vec3 | null }

export const PALETTES: Record<string, { label: string; couleurs: string[] }> = {
  neon: { label: 'néon', couleurs: ['#ff2bd6', '#22d3ee', '#7c3aed'] },
  fire: { label: 'feu', couleurs: ['#ff4d00', '#ffb300', '#ff0033'] },
  cool: { label: 'froid', couleurs: ['#2563eb', '#22d3ee', '#a5f3fc'] },
  sunset: { label: 'coucher de soleil', couleurs: ['#f97316', '#eb6f92', '#7c3aed'] },
  arctic: { label: 'arctique', couleurs: ['#e0f2fe', '#7dd3fc', '#6366f1'] },
  maison: { label: 'neutroncore', couleurs: ['#f6c177', '#eb6f92', '#9d7bf5'] },
  // arc-en-ciel : pas une couleur par temps, mais des bandes de couleur qui rayonnent depuis le point source et défilent
  arcenciel: { label: 'arc-en-ciel', couleurs: ['#ff0000', '#ff8800', '#ffee00', '#22cc44', '#00bbff', '#3344ff', '#aa33ff'] },
  // les trois couleurs de la scène Iron Man de huebeat : bleu du réacteur, rouge de l'armure, blanc d'énergie
  neutron: { label: 'neutron', couleurs: ['#0000ff', '#ff0000', '#ffffff'] },
}
export const ARC_EN_CIEL = 'arcenciel'

/** Teinte (0..1, un tour de roue) -> couleur vive. Même formule dans spatial_fx.py de huebeat. */
export function teinte(h: number): RGB {
  const t = (h - Math.floor(h)) * 6
  const x = 1 - Math.abs((t % 2) - 1)
  return t < 1 ? [1, x, 0] : t < 2 ? [x, 1, 0] : t < 3 ? [0, 1, x] : t < 4 ? [0, x, 1] : t < 5 ? [x, 0, 1] : [1, 0, x]
}

/** Couleur arc-en-ciel d'un endroit de la pièce : elle dépend de sa distance au point source, et tout défile avec le temps. */
export function arcEnCiel(pos: Vec3, source: Vec3, dims: Dims, beat: number): RGB {
  return teinte(Math.hypot(pos[0] - source[0], pos[1] - source[1], pos[2] - source[2]) / diagonale(dims) * 1.6 - beat / 8)
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const frac = (v: number) => v - Math.floor(v)
const cloche = (ecart: number, largeur: number) => Math.exp(-((ecart / largeur) ** 2))
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export function hex(c: string): RGB {
  return [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255]
}
export const LIBRE = 'libre'            // palette composée à la main : la scène porte ses propres couleurs
export const MAX_COULEURS = 6
/** Les couleurs qu'une scène fait jouer : les siennes si sa palette est libre, sinon celles de la palette. */
export function couleursDe(s: { palette: string; couleurs?: string[] }): string[] {
  return s.palette === LIBRE && s.couleurs?.length ? s.couleurs : (PALETTES[s.palette] ?? PALETTES.neon).couleurs
}
const couleur = (p: FxParams, rang: number): RGB => {
  const liste = couleursDe(p)
  return hex(liste[((rang % liste.length) + liste.length) % liste.length])
}

/** Plus grande distance possible dans la pièce : sert d'échelle à tous les effets. */
export function diagonale(d: Dims): number {
  return Math.hypot(d.w, d.h, d.d)
}

/** Où est la source mobile au temps `beat` : un tour autour de la pièce toutes les 8 pulsations, à la hauteur du point source. */
export function sourceMobile(dims: Dims, params: FxParams, beat: number): Vec3 {
  const a = (beat / 8) * 2 * Math.PI
  return [Math.cos(a) * dims.w * 0.36, Math.sin(a) * dims.h * 0.36, params.source[2]]
}

type Apport = { niveau: number; rgb: RGB; vise: Vec3 | null }

/** Ce qu'un effet apporte à un appareil au temps `beat` (en pulsations depuis le départ). */
export function apport(fx: FxId, f: Fixture, dims: Dims, p: FxParams, beat: number): Apport {
  const diag = diagonale(dims)
  const temps = Math.floor(beat), phase = frac(beat)
  if (fx === 'onde') {
    // l'onde met une pulsation à traverser la pièce et s'affaiblit en s'éloignant
    const rayon = phase * diag * 0.85
    const niveau = cloche(dist(f.pos, p.source) - rayon, diag * 0.09) * (1 - phase * 0.55)
    return { niveau, rgb: couleur(p, temps), vise: p.source }
  }
  if (fx === 'mur') {
    const i = p.axe === 'x' ? 0 : p.axe === 'y' ? 1 : 2
    const [min, max] = i === 0 ? [-dims.w / 2, dims.w / 2] : i === 1 ? [-dims.h / 2, dims.h / 2] : [0, dims.d]
    const ou = min + frac(beat / 4) * (max - min)                 // une traversée par mesure de 4 temps
    const vise: Vec3 = i === 0 ? [ou, f.pos[1], 0] : i === 1 ? [f.pos[0], ou, 0] : [f.pos[0], f.pos[1], 0]
    return { niveau: cloche(f.pos[i] - ou, (max - min) * 0.11), rgb: couleur(p, Math.floor(beat / 4)), vise }
  }
  if (fx === 'orbite') {
    const s = sourceMobile(dims, p, beat)
    return { niveau: cloche(dist(f.pos, s), diag * 0.24), rgb: couleur(p, Math.floor(beat / 8) + 1), vise: [s[0], s[1], 0] }
  }
  if (fx === 'maree') {
    // le niveau de l'eau monte et descend sur 8 temps ; tout ce qui est dessous est allumé
    const eau = (0.5 - 0.5 * Math.cos((beat / 8) * 2 * Math.PI)) * dims.d * 1.05
    const sous = clamp01((eau - f.pos[2]) / (dims.d * 0.12) + 0.5)
    const coup = (1 - phase) ** 3 * 0.35
    return { niveau: clamp01(sous * (0.65 + coup)), rgb: couleur(p, Math.floor(beat / 8) + 2), vise: [f.pos[0], f.pos[1], 0] }
  }
  if (fx === 'raz') {
    // une vague par mesure : le front s'éloigne du point au ras du sol (en plan), et derrière lui l'eau monte
    const T = frac(beat / 4)
    const portee = Math.hypot(dims.w, dims.h)
    const rayon = T * portee * 1.25
    const dx = f.pos[0] - p.source[0], dy = f.pos[1] - p.source[1]
    const loin = Math.hypot(dx, dy)
    const passe = rayon - loin                                   // de combien le front a dépassé cet endroit
    const front = clamp01(passe / (portee * 0.06) + 1)
    const montee = clamp01(passe / (portee * 0.28))              // l'eau met un moment à remplir la hauteur
    const depart = p.depart ?? 'bas'
    const z0 = depart === 'bas' ? 0 : depart === 'haut' ? dims.d : p.source[2]
    const aRemplir = depart === 'centre' ? Math.max(z0, dims.d - z0) : dims.d
    const vertical = clamp01((montee * aRemplir - Math.abs(f.pos[2] - z0)) / (dims.d * 0.1) + 0.5)
    const k = loin > 1e-6 ? rayon / loin : 0
    // les lyres suivent le front, sans viser au-delà des murs
    const dans = (v: number, demi: number) => Math.min(demi, Math.max(-demi, v))
    return { niveau: front * vertical * (1 - 0.45 * T), rgb: couleur(p, Math.floor(beat / 4)), vise: [dans(p.source[0] + dx * k, dims.w / 2), dans(p.source[1] + dy * k, dims.h / 2), 0] }
  }
  // phare : un faisceau horizontal tourne autour du point source, un tour par mesure
  const angle = (beat / 4) * 2 * Math.PI
  const vers = Math.atan2(f.pos[1] - p.source[1], f.pos[0] - p.source[0])
  const portee = Math.max(dims.w, dims.h)
  return {
    niveau: Math.max(0, Math.cos(vers - angle)) ** 8,
    rgb: couleur(p, Math.floor(beat / 4)),
    vise: [p.source[0] + Math.cos(angle) * portee, p.source[1] + Math.sin(angle) * portee, 0],
  }
}

/** Rang de chaque appareil quand on les range de gauche à droite (puis d'avant en arrière, puis de bas en haut) :
 * deux voisins ont des rangs de parité différente. Même ordre que `rangs` de spatial_fx.py. */
export function rangs(positions: Vec3[]): number[] {
  const ordre = positions.map((_, i) => i).sort((a, b) => positions[a][0] - positions[b][0] || positions[a][1] - positions[b][1] || positions[a][2] - positions[b][2] || a - b)
  const sortie = new Array<number>(positions.length).fill(0)
  ordre.forEach((i, rang) => { sortie[i] = rang })
  return sortie
}

/** Mode 2d : sur chaque temps, les lampes du groupe s'allument d'un coup puis retombent selon la pulsation (attaque,
 * retombée, plancher). Miroir de `evaluer_2d` (spatial_fx.py). */
export function evaluer2d(f: Fixture, dims: Dims, p: FxParams, beat: number, rang: number): Sortie {
  const pulse = p.pulse ?? COMMUN_DEFAUT
  // une pulsation dure `vie` temps : le groupe allumé et la couleur changent à chaque pulsation, pas à chaque temps
  const { n, phase } = f.kind === 'strobe' ? { n: Math.floor(beat), phase: frac(beat) } : phaseDeVie(beat, pulse.vie)
  const allume = p.groupe !== 'alterne' || (((rang + n) % 2) + 2) % 2 === 0
  const plancher = clamp01(pulse.plancher / 100), plein = clamp01(p.intensite) * clamp01(p.general ?? 1)
  const niveau = f.kind === 'strobe' ? (allume && phase < 0.09 ? plein : 0) : plein * (plancher + (1 - plancher) * (allume ? enveloppe(phase, pulse) : 0))
  const rgb: RGB = f.kind === 'strobe' ? [1, 1, 1] : p.palette === ARC_EN_CIEL ? arcEnCiel(f.pos, p.source, dims, beat) : couleur(p, n)
  return { rgb, niveau, vise: f.aim ?? null }
}

/** Sortie d'un appareil pour un ensemble d'effets superposés : les niveaux s'ajoutent (plafonnés), les
 * couleurs se mélangent selon ce que chaque effet apporte. Un stroboscope ne fait que claquer sur le temps ;
 * un projecteur à lyre vise l'endroit que désigne l'effet le plus fort. */
export function evaluer(effets: FxId[], f: Fixture, dims: Dims, p: FxParams, beat: number, rang = 0): Sortie {
  if (p.mode === '2d') return evaluer2d(f, dims, p, beat, rang)
  // chaque effet joue avec ses propres réglages s'il en a (couleurs, intensité, respiration, tempo...) ; la place
  // qu'il prend se mesure à ce qu'il apporte, et sa force (intensité x respiration) pondère lumière et couleur.
  // Sans réglage propre, toutes les forces sont égales : on retrouve exactement le calcul d'une scène d'un bloc.
  let total = 0, pese = 0, r = 0, g = 0, b = 0
  let fort: Apport | null = null
  for (const fx of effets) {
    const { p: pe, k } = coucheDe(p, fx)
    const bfx = beat * k
    const a = apport(fx, f, dims, pe, bfx)
    const force = clamp01(pe.intensite) * gainPulsation(phaseDeVie(bfx, pe.pulse?.vie).phase, pe.pulse)
    // arc-en-ciel : la couleur vient de l'endroit, pas de l'effet
    const c = pe.palette === ARC_EN_CIEL ? arcEnCiel(f.pos, pe.source, dims, bfx) : a.rgb
    total += a.niveau; pese += a.niveau * force
    r += c[0] * a.niveau * force; g += c[1] * a.niveau * force; b += c[2] * a.niveau * force
    if (!fort || a.niveau > fort.niveau) fort = a
  }
  let niveau = total <= 1e-6 ? 0 : clamp01(total) * (pese / total) * clamp01(p.general ?? 1)
  if (f.kind === 'strobe') niveau = total > 0.45 && frac(beat) < 0.09 ? clamp01(p.intensite) * clamp01(p.general ?? 1) : 0
  const rgb: RGB = pese <= 1e-9 ? [0, 0, 0] : [r / pese, g / pese, b / pese]
  return { rgb: f.kind === 'strobe' ? [1, 1, 1] : rgb, niveau, vise: f.kind === 'projo' ? (fort?.vise ?? null) : (f.aim ?? null) }
}

/** Tempo d'après des tapes (instants en ms) : médiane des écarts récents, entre 50 et 220 ; null s'il en manque. */
export function tempoTape(instants: number[]): number | null {
  const ecarts = instants.slice(-6).map((t, i, l) => (i ? t - l[i - 1] : 0)).slice(1).filter((e) => e > 0 && e < 2000)
  if (ecarts.length < 2) return null
  const tri = [...ecarts].sort((a, b) => a - b)
  const m = tri.length >> 1
  const bpm = 60000 / (tri.length % 2 ? tri[m] : (tri[m - 1] + tri[m]) / 2)
  return bpm >= 50 && bpm <= 220 ? Math.round(bpm) : null
}

// ---- horloge calée sur huebeat, pad et sets --------------------------------

/** Temps en pulsations d'après la détection de huebeat : le nombre de temps déjà tombés et la durée écoulée
 * depuis le dernier. Chaque vrai temps repart d'un entier ; entre deux, on avance au tempo mesuré sans dépasser
 * le temps suivant ; sans musique depuis 2,5 s, l'effet tourne librement. Miroir de `position_dans_le_temps`
 * (spatial_fx.py de huebeat) : le banc d'essai et les vraies lampes doivent être au même endroit du morceau. */
export function positionDansLeTemps(beatCount: number, depuisLeDernierS: number, bpm: number): number {
  const depuis = Math.max(0, depuisLeDernierS)
  // tempo connu : l'horloge continue au tempo mesuré, même si un temps n'est pas détecté
  if (Number.isFinite(bpm) && bpm >= 40 && bpm <= 240) return beatCount + (depuis * bpm) / 60
  // tempo inconnu : 120, sans dépasser le temps suivant (les lampes attendent le prochain coup). Miroir de `avancer`.
  return Math.min(Math.floor(beatCount) + 0.999, beatCount + depuis * 2)
}

// Une scène du pad : des effets et leurs réglages. Le point source est en pourcentage de la pièce,
// pour que la même scène se rejoue dans un autre lieu.
export type Scene = { id: string; nom: string; effets: FxId[]; palette: string; couleurs?: string[]; axe: Axe; source: { x: number; y: number; z: number }; intensite: number; depart?: Depart; mode?: Mode; groupe?: Groupe; reglages?: Partial<Record<FxId, Surcharge>> }
export type PasDeSet = { scene: string; mesures: number }
export type SetDeScenes = { id: string; nom: string; pas: PasDeSet[]; boucle: boolean }
export const TEMPS_PAR_MESURE = 4

/** Réglages du calcul pour une scène dans une pièce donnée. */
export function paramsDeScene(s: Pick<Scene, 'palette' | 'couleurs' | 'axe' | 'source' | 'intensite' | 'depart' | 'mode' | 'groupe' | 'reglages'>, dims: Dims, commun?: Commun): FxParams {
  const cm = (src: { x: number; y: number; z: number }): Vec3 => [(src.x / 100 - 0.5) * dims.w, (src.y / 100 - 0.5) * dims.h, (src.z / 100) * dims.d]
  const couches: Partial<Record<FxId, Couche>> = {}
  for (const [fx, r] of Object.entries(s.reglages ?? {}) as [FxId, Surcharge][]) {
    const c: Couche = {}
    if (r.palette) { c.palette = r.palette; c.couleurs = r.couleurs }
    if (r.intensite !== undefined) c.intensite = r.intensite / 100
    if (r.source) c.source = cm(r.source)
    if (r.axe) c.axe = r.axe
    if (r.depart) c.depart = r.depart
    if (r.respiration) c.pulse = { ...(commun ?? COMMUN_DEFAUT), ...r.respiration }
    if (r.tempo !== undefined) c.tempo = r.tempo
    if (Object.keys(c).length) couches[fx] = c
  }
  return { couches, mode: s.mode ?? '3d', groupe: s.groupe ?? 'tous', depart: s.depart ?? 'bas', pulse: commun, general: commun ? commun.intensite / 100 : 1, source: [(s.source.x / 100 - 0.5) * dims.w, (s.source.y / 100 - 0.5) * dims.h, (s.source.z / 100) * dims.d], axe: s.axe, palette: s.palette, couleurs: s.couleurs, intensite: s.intensite / 100 }
}

/** Étape d'un set jouée `temps` pulsations après son départ : son rang, ou -1 quand un set sans boucle est fini. */
export function etapeDuSet(set: Pick<SetDeScenes, 'pas' | 'boucle'>, temps: number): number {
  const durees = set.pas.map((p) => p.mesures * TEMPS_PAR_MESURE)
  const total = durees.reduce((t, d) => t + d, 0)
  if (total <= 0 || temps < 0) return -1
  if (temps >= total && !set.boucle) return -1
  let reste = temps % total
  for (let i = 0; i < durees.length; i++) {
    if (reste < durees[i]) return i
    reste -= durees[i]
  }
  return durees.length - 1
}

/** Transforme ce qu'on a joué au pad en étapes de set : chaque scène est tenue jusqu'à la frappe suivante (ou la
 * fin de l'enregistrement), arrondi à la mesure, une mesure au moins. Deux frappes de suite sur la même scène se fondent. */
export function frappesEnSet(frappes: { scene: string; beat: number }[], finBeat: number): PasDeSet[] {
  const tri = [...frappes].sort((a, b) => a.beat - b.beat)
  const pas: PasDeSet[] = []
  tri.forEach((f, i) => {
    const jusqua = i + 1 < tri.length ? tri[i + 1].beat : finBeat
    const mesures = Math.min(64, Math.max(1, Math.round((jusqua - f.beat) / TEMPS_PAR_MESURE)))
    const dernier = pas[pas.length - 1]
    if (dernier && dernier.scene === f.scene) pas[pas.length - 1] = { scene: f.scene, mesures: Math.min(64, dernier.mesures + mesures) }
    else pas.push({ scene: f.scene, mesures })
  })
  return pas
}

/** Le pad après avoir déplacé une touche d'un cran (`sens` = -1 vers le début, 1 vers la fin) : la liste des identifiants. */
export function deplacerTouche(ids: string[], id: string, sens: -1 | 1): string[] {
  const i = ids.indexOf(id), j = i + sens
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const next = [...ids]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
