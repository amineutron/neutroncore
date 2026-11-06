// DJ Light : les couches (logique pure, testée dans djCouches.test.ts).
// Une pile de rangées, la plus prioritaire en HAUT. Chaque rangée est soit la scène jouée, soit sa palette, soit un
// signal musical branché sur un réglage de scène (intensité, point source, pulsation, couleurs...). On applique la pile de
// bas en haut : ce qui est au-dessus écrase ce qui est dessous. Une rangée de modulation placée SOUS la scène ou sa palette
// est donc recouverte par elles ; placée au-dessus, elle les module.
import type { Commun, Dims, FxId, FxParams, Scene } from './spatialFx'
import { ARC_EN_CIEL, LIBRE, PALETTES, couleursDe, paramsDeScene } from './spatialFx'
import type { SignalId } from './djSignaux'
import { SIGNAUX_INFO } from './djSignaux'
import { nettoyerCouleurs } from './jeuxCouleurs'

export type Genre = 'scene' | 'couleurs' | 'modulation' | 'couleur' | 'declencheur'
export type ModeCouche = 'remplace' | 'ajoute' | 'multiplie'
export type CibleMod = 'intensite' | 'general' | 'profondeur' | 'attaque' | 'retombee' | 'plancher' | 'vie' | 'source_x' | 'source_y' | 'source_z' | 'tempo' | 'onde' | 'effet'
export type CibleCouleur = 'teinte' | 'saturation' | 'chaleur' | 'palette'
export type Cible = CibleMod | CibleCouleur

/** Une rangée de la pile. Même forme que `Couche` du schéma de l'API (`/djlight/config`). */
export type Couche = {
  id: string; nom: string; actif: boolean; solo: boolean
  force: number                       // 0..100 : à quel point la rangée agit (0 = comme si elle n'existait pas)
  genre: Genre
  signal: SignalId | null
  cible: Cible | null
  fx: FxId | null                     // cible « effet » : de quel effet on règle l'intensité
  scene: string | null                // déclencheur : la scène qui prend le relais
  palettes: string[]                  // cible « palette » : la palette choisie selon la valeur du signal
  couleurs?: string[]                 // « couleurs » et déclencheur : couleurs choisies à la main, à la place de la palette de la scène
  mesures: number                     // déclencheur : combien de mesures dure la scène
  mode: ModeCouche
  min: number; max: number            // la sortie quand le signal vaut 0, puis quand il vaut 1 (unités de la cible)
  inverse: boolean
  seuil: number                       // 0..100 : le signal ne compte qu'au-delà
  lissage: number                     // 0..100 : 0 = réagit d'un coup, 100 = très lent
}
export type Profil = { id: string; nom: string; couches: Couche[] }
export type FinPas = 'mesures' | 'drop' | 'manuel'
export type PasDj = { scene: string; profil: string | null; mesures: number; fin: FinPas }
export type SetDj = { id: string; nom: string; boucle: boolean; pas: PasDj[] }
export type ConfigDj = { version: 1; actif: string | null; profils: Profil[]; sets: SetDj[] }

export const MAX_COUCHES = 24

type InfoCible = { label: string; unite: string; lo: number; hi: number; quoi: string }
export const CIBLES_MOD: Record<CibleMod, InfoCible> = {
  intensite: { label: 'intensité de la scène', unite: '%', lo: 10, hi: 100, quoi: 'La force de la scène elle-même. La scène la fixe : une rangée placée dessous n’y change rien.' },
  general: { label: 'luminosité générale', unite: '%', lo: 10, hi: 100, quoi: 'Le niveau de toutes les lampes (le réglage « intensité » commun à toutes les scènes).' },
  profondeur: { label: 'force de la pulsation', unite: '', lo: 0, hi: 100, quoi: '0 : la lumière reste continue ; 100 : tout suit la pulsation du temps.' },
  attaque: { label: 'arrivée de la lumière', unite: '', lo: 0, hi: 100, quoi: 'Le temps de montée de la lumière après un temps : 0 d’un coup, 100 lentement.' },
  retombee: { label: 'départ de la lumière', unite: '', lo: 0, hi: 100, quoi: 'La durée du fondu de sortie après un temps : 0 vite, 100 lentement.' },
  plancher: { label: 'lumière qui reste', unite: '', lo: 0, hi: 100, quoi: 'La lumière qui reste entre deux pulsations : 0 le noir, 100 aucune pulsation visible.' },
  vie: { label: 'durée d’une pulsation', unite: '', lo: 0, hi: 100, quoi: '0 : un temps ; 33 : deux temps ; 67 : une mesure ; 100 : deux mesures.' },
  source_x: { label: 'point source : gauche / droite', unite: '%', lo: 0, hi: 100, quoi: 'D’où part la lumière, en largeur de la pièce. La scène le fixe ; au-dessus d’elle, le son peut le déplacer.' },
  source_y: { label: 'point source : avant / arrière', unite: '%', lo: 0, hi: 100, quoi: 'D’où part la lumière, en profondeur (0 : mur de la télé).' },
  source_z: { label: 'point source : hauteur', unite: '%', lo: 0, hi: 100, quoi: 'D’où part la lumière, en hauteur (0 : sol, 100 : plafond).' },
  tempo: { label: 'vitesse des effets', unite: '%', lo: 25, hi: 200, quoi: '100 : au tempo de la musique ; 200 : deux fois plus vite ; 50 : deux fois plus lent.' },
  onde: { label: 'vitesse de l’onde', unite: '×', lo: 1, hi: 8, quoi: 'En combien de fois moins de temps l’onde traverse la pièce. 1 : une pulsation entière (les lampes lointaines s’allument en retard) ; 4 : un quart ; 8 : presque d’un coup.' },
  effet: { label: 'force d’un effet', unite: '%', lo: 0, hi: 100, quoi: 'L’intensité d’un seul effet de la scène (onde, mur, phare...), sans toucher aux autres.' },
}
export const CIBLES_COULEUR: Record<CibleCouleur, InfoCible> = {
  teinte: { label: 'teinte des couleurs', unite: '°', lo: -180, hi: 180, quoi: 'Fait tourner toutes les couleurs sur la roue : 180 les inverse.' },
  saturation: { label: 'intensité des couleurs', unite: '%', lo: 0, hi: 200, quoi: '100 : couleurs de la palette ; 0 : blanc ; au-delà, plus vives.' },
  chaleur: { label: 'chaud / froid', unite: '', lo: -100, hi: 100, quoi: 'Tire les couleurs vers l’orangé (positif) ou vers le bleuté (négatif).' },
  palette: { label: 'choix de la palette', unite: '', lo: 0, hi: 1, quoi: 'Choisit une palette dans une courte liste selon la valeur du signal (ex. mineur : froide, majeur : chaude).' },
}
export const infoCible = (c: Cible): InfoCible => (c in CIBLES_MOD ? CIBLES_MOD[c as CibleMod] : CIBLES_COULEUR[c as CibleCouleur])
export const MODES: { id: ModeCouche; label: string; quoi: string }[] = [
  { id: 'remplace', label: 'remplace', quoi: 'La valeur du signal devient celle du réglage.' },
  { id: 'ajoute', label: 'ajoute', quoi: 'La valeur du signal s’ajoute à celle du réglage.' },
  { id: 'multiplie', label: 'multiplie', quoi: 'Le réglage est multiplié par un pourcentage (100 : inchangé).' },
]

// ---- l'état des réglages quand on applique la pile ------------------------------------------------------------

export type Etat = {
  scene: Scene
  intensite: number; general: number
  profondeur: number; attaque: number; retombee: number; plancher: number; vie: number
  source: { x: number; y: number; z: number }
  tempo: number                                          // % de la vitesse de la musique
  onde: number                                           // l'onde traverse la pièce en 1/onde de pulsation
  fx: Partial<Record<FxId, number>>                      // intensité propre à un effet, en %
  palette: string; couleurs?: string[]
  teinte: number; saturation: number; chaleur: number
}

const bornes = (c: Cible): [number, number] => { const i = infoCible(c); return [i.lo, i.hi] }
const borner = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)

export function etatInitial(commun: Commun, scene: Scene, onde = 1): Etat {
  return {
    scene, intensite: scene.intensite, general: commun.intensite,
    profondeur: commun.profondeur, attaque: commun.attaque, retombee: commun.retombee, plancher: commun.plancher, vie: commun.vie,
    source: { ...scene.source }, tempo: 100, onde, fx: {}, palette: scene.palette, couleurs: scene.couleurs, teinte: 0, saturation: 100, chaleur: 0,
  }
}

/** La scène (effets, intensité, point source) prend la place de ce qu'il y avait dessous. */
function poserScene(e: Etat, s: Scene): Etat {
  return { ...e, scene: s, intensite: s.intensite, source: { ...s.source }, fx: {} }
}
/** La scène, avec les couleurs choisies à la main par la rangée si elle en a de valides (sinon telle quelle). */
export function avecCouleursDeRangee(s: Scene, c: Pick<Couche, 'couleurs'>): Scene {
  const choisies = nettoyerCouleurs(c.couleurs ?? [])
  return choisies.length > 0 ? { ...s, palette: LIBRE, couleurs: choisies } : s
}
/** La palette de la scène prend la place des couleurs de dessous, et remet à zéro teinte, saturation et chaleur. */
function poserCouleurs(e: Etat, s: Scene): Etat {
  return { ...e, palette: s.palette, couleurs: s.couleurs, teinte: 0, saturation: 100, chaleur: 0 }
}

function lire(e: Etat, c: Cible, fx: FxId | null): number {
  switch (c) {
    case 'effet': return fx ? (e.fx[fx] ?? 100) : 100
    case 'source_x': return e.source.x
    case 'source_y': return e.source.y
    case 'source_z': return e.source.z
    case 'palette': return 0
    default: return e[c]
  }
}
function ecrire(e: Etat, c: Cible, fx: FxId | null, v: number): Etat {
  const [lo, hi] = bornes(c), x = borner(v, lo, hi)
  switch (c) {
    case 'effet': return fx ? { ...e, fx: { ...e.fx, [fx]: x } } : e
    case 'source_x': return { ...e, source: { ...e.source, x } }
    case 'source_y': return { ...e, source: { ...e.source, y: x } }
    case 'source_z': return { ...e, source: { ...e.source, z: x } }
    case 'palette': return e
    default: return { ...e, [c]: x }
  }
}

/** Valeur de sortie d'une rangée pour un signal de 0..1 : seuil, inversion, puis de `min` à `max`. Rend aussi `x`, le niveau d'activité. */
export function sortieDe(c: Pick<Couche, 'min' | 'max' | 'inverse' | 'seuil'>, signal: number): { sortie: number; x: number } {
  const seuil = Math.min(0.99, Math.max(0, c.seuil / 100))
  const s = Math.min(1, Math.max(0, Number.isFinite(signal) ? signal : 0))
  const gate = s <= seuil ? 0 : (s - seuil) / (1 - seuil)
  const x = c.inverse ? 1 - gate : gate
  return { sortie: c.min + (c.max - c.min) * x, x }
}

export type Entree = {
  profil: Profil
  valeurs: Record<string, number>                  // signal (déjà lissé) de chaque rangée
  scene: Scene                                     // la scène jouée
  scenes: Scene[]
  commun: Commun
  declenches: Record<string, string>               // rangée -> scène qu'elle est en train de jouer
  ondeBase?: number                                // vitesse de l'onde réglée pour tout l'écran (1 si absent)
}
export type Appliquee = { etat: Etat; acts: Record<string, number> }

/** Applique toute la pile, de la rangée la moins prioritaire (en bas) à la plus prioritaire (en haut). */
export function appliquer(entree: Entree): Appliquee {
  const { profil, valeurs, scene, scenes, commun, declenches } = entree
  let e = etatInitial(commun, scene, entree.ondeBase)
  const acts: Record<string, number> = {}
  const seul = profil.couches.some((c) => c.solo && c.actif && c.genre !== 'scene' && c.genre !== 'couleurs')
  for (let i = profil.couches.length - 1; i >= 0; i--) {
    const c = profil.couches[i]
    acts[c.id] = 0
    const base = c.genre === 'scene' || c.genre === 'couleurs'
    if (!c.actif || (seul && !c.solo && !base)) continue
    if (c.genre === 'scene') { e = poserScene(e, scene); acts[c.id] = 1; continue }
    if (c.genre === 'couleurs') { e = poserCouleurs(e, avecCouleursDeRangee(scene, c)); acts[c.id] = 1; continue }
    const f = c.force / 100
    if (f <= 0) continue
    if (c.genre === 'declencheur') {
      const jouee = declenches[c.id] ? scenes.find((s) => s.id === declenches[c.id]) : undefined
      if (jouee) { e = poserCouleurs(poserScene(e, jouee), avecCouleursDeRangee(jouee, c)); acts[c.id] = 1 }
      continue
    }
    if (!c.cible) continue
    const v = valeurs[c.id] ?? 0
    if (c.cible === 'palette') {
      if (c.signal === 'mode' && Math.abs(v - 0.5) < 0.001) continue            // tonalité pas encore trouvée : la palette de la scène reste
      const liste = c.palettes.filter((p) => p in PALETTES)
      if (liste.length === 0) continue
      e = { ...e, palette: liste[Math.min(liste.length - 1, Math.floor(Math.min(1, Math.max(0, v)) * liste.length))], couleurs: undefined }
      acts[c.id] = Math.min(1, Math.max(0, v))
      continue
    }
    const { sortie, x } = sortieDe(c, v)
    const actuel = lire(e, c.cible, c.fx)
    const voulu = c.mode === 'remplace' ? sortie : c.mode === 'ajoute' ? actuel + sortie : (actuel * sortie) / 100
    e = ecrire(e, c.cible, c.fx, actuel + (voulu - actuel) * f)
    acts[c.id] = x
  }
  return { etat: e, acts }
}

// ---- couleurs ---------------------------------------------------------------------------------------------

type RGB3 = [number, number, number]
const h2 = (n: number): string => Math.round(Math.min(255, Math.max(0, n * 255))).toString(16).padStart(2, '0')
const versHex = ([r, g, b]: RGB3): string => `#${h2(r)}${h2(g)}${h2(b)}`
const deHex = (c: string): RGB3 => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255]

function rgbVersHsl([r, g, b]: RGB3): RGB3 {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
  if (d < 1e-9) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function hslVersRgb([h, s, l]: RGB3): RGB3 {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return [f(0), f(8), f(4)]
}
const CHAUD: RGB3 = [1, 0.55, 0.2], FROID: RGB3 = [0.25, 0.55, 1]

/** Applique teinte (°), saturation (%, 100 = inchangée) et chaleur (-100 froid, 100 chaud) à des couleurs `#rrggbb`. */
export function transformerCouleurs(couleurs: string[], teinte: number, saturation: number, chaleur: number): string[] {
  if (Math.abs(teinte) < 0.5 && Math.abs(saturation - 100) < 0.5 && Math.abs(chaleur) < 0.5) return couleurs
  return couleurs.map((c) => {
    const [h, s, l] = rgbVersHsl(deHex(c))
    const rgb = hslVersRgb([(((h + teinte) % 360) + 360) % 360, Math.min(1, Math.max(0, (s * saturation) / 100)), l])
    const part = Math.min(1, Math.abs(chaleur) / 100) * 0.55, cible = chaleur >= 0 ? CHAUD : FROID
    return versHex(rgb.map((v, i) => v + (cible[i] - v) * part) as RGB3)
  })
}

// ---- résultat pour le calcul de lumière --------------------------------------------------------------------

export type Sortie = { effets: FxId[]; params: FxParams; tempoK: number }

/** Réglages du calcul de lumière après application de la pile. `tempoK` : facteur de vitesse des effets (1 = tempo de la musique). */
export function versParams(e: Etat, dims: Dims, commun: Commun): Sortie {
  let palette = e.palette, couleurs = e.couleurs
  if (palette !== ARC_EN_CIEL && (Math.abs(e.teinte) >= 0.5 || Math.abs(e.saturation - 100) >= 0.5 || Math.abs(e.chaleur) >= 0.5)) {
    couleurs = transformerCouleurs(couleursDe({ palette, couleurs }), e.teinte, e.saturation, e.chaleur)
    palette = LIBRE
  }
  const scene: Scene = { ...e.scene, intensite: e.intensite, source: e.source, palette, couleurs }
  const pulsation: Commun = { ...commun, intensite: e.general, profondeur: e.profondeur, attaque: e.attaque, retombee: e.retombee, plancher: e.plancher, vie: e.vie }
  const params = paramsDeScene(scene, dims, pulsation)
  for (const [fx, gain] of Object.entries(e.fx) as [FxId, number][]) {
    const base = params.couches?.[fx]?.intensite ?? params.intensite
    params.couches = { ...params.couches, [fx]: { ...params.couches?.[fx], intensite: (base * gain) / 100 } }
  }
  if (e.onde > 1.001) params.vitesseOnde = e.onde
  return { effets: e.scene.effets, params, tempoK: Math.max(0.1, e.tempo / 100) }
}

// ---- fabrication et phrases --------------------------------------------------------------------------------

export const nouvelId = (): string => `x${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`.slice(0, 16)

export function nouvelleCouche(genre: Genre, p: Partial<Couche> = {}): Couche {
  const modulation = genre === 'modulation' || genre === 'couleur'
  return {
    id: nouvelId(), nom: genre === 'scene' ? 'scène jouée' : genre === 'couleurs' ? 'couleurs de la scène' : genre === 'declencheur' ? 'déclencheur' : 'nouvelle modulation',
    actif: true, solo: false, force: 100, genre,
    signal: genre === 'scene' || genre === 'couleurs' ? null : 'volume',
    cible: modulation ? (genre === 'couleur' ? 'chaleur' : 'general') : null,
    fx: null, scene: null, palettes: [], mesures: 4, mode: 'remplace', min: 0, max: 100, inverse: false, seuil: 0, lissage: 20, ...p,
  }
}

const SIGNAL_VERBES: Partial<Record<SignalId, string>> = {
  kick: 'à chaque grosse caisse', snare: 'à chaque caisse claire', hat: 'à chaque charleston', drop: 'au drop',
}
const nombre = (v: number): string => String(Math.round(v * 10) / 10).replace('.', ',')

/** La rangée dite en une phrase, pour la liste et pour l'aide. */
export function phrase(c: Couche, scenes: Pick<Scene, 'id' | 'nom'>[] = []): string {
  if (c.genre === 'scene') return 'la scène jouée : ses effets, son intensité et son point source'
  const nbChoisies = nettoyerCouleurs(c.couleurs ?? []).length
  const choisies = nbChoisies > 0 ? ` en ${nbChoisies} couleur${nbChoisies > 1 ? 's' : ''} choisie${nbChoisies > 1 ? 's' : ''}` : ''
  if (c.genre === 'couleurs') return nbChoisies > 0 ? `${nbChoisies} couleur${nbChoisies > 1 ? 's' : ''} choisie${nbChoisies > 1 ? 's' : ''} à la main` : 'la palette de la scène'
  const quand = c.signal ? (SIGNAL_VERBES[c.signal] ?? `selon ${SIGNAUX_INFO[c.signal].label}`) : ''
  if (c.genre === 'declencheur') return `${quand}, la scène « ${scenes.find((s) => s.id === c.scene)?.nom ?? 'introuvable'} » prend le relais ${c.mesures} mesure${c.mesures > 1 ? 's' : ''}${choisies}`
  if (!c.cible) return 'à régler'
  const cible = infoCible(c.cible)
  const u = cible.unite === '%' ? ' %' : cible.unite === '°' ? '°' : ''
  const nom = c.cible === 'effet' ? `${cible.label}${c.fx ? ` (${c.fx})` : ''}` : cible.label
  if (c.cible === 'palette') return `${quand} : choisit parmi ${c.palettes.map((p) => PALETTES[p]?.label ?? p).join(', ') || 'aucune palette'}`
  const plage = `de ${nombre(c.min)}${u} à ${nombre(c.max)}${u}`
  if (c.mode === 'multiplie') return `${quand} : ${nom} multipliée ${plage}`
  if (c.mode === 'ajoute') return `${quand} : ${nom} augmentée ${plage}`
  return `${quand} : ${nom} ${plage}`
}

/** Les rangées en conflit : deux rangées actives qui règlent la même cible (la plus haute gagne). Pour l'afficher. */
export function conflits(couches: Couche[]): Record<string, string> {
  const vues = new Map<string, string>()
  const res: Record<string, string> = {}
  for (const c of couches) {
    if (!c.actif || c.genre === 'scene' || c.genre === 'couleurs' || c.genre === 'declencheur' || !c.cible || c.mode !== 'remplace') continue
    const cle = `${c.cible}:${c.fx ?? ''}`
    const dessus = vues.get(cle)
    if (dessus) res[c.id] = dessus
    else vues.set(cle, c.id)
  }
  return res
}

/** Déplace la rangée `id` d'un cran (`sens` -1 : plus prioritaire). */
export function deplacer(couches: Couche[], id: string, sens: -1 | 1): Couche[] {
  const i = couches.findIndex((c) => c.id === id), j = i + sens
  if (i < 0 || j < 0 || j >= couches.length) return couches
  const copie = [...couches]
  ;[copie[i], copie[j]] = [copie[j], copie[i]]
  return copie
}

// ---- profils de départ -------------------------------------------------------------------------------------

const C = (profil: string, n: number, genre: Genre, p: Partial<Couche>): Couche => ({ ...nouvelleCouche(genre, p), id: `${profil}${String(n).padStart(4, '0')}` })
const BASES = (profil: string, n: number): Couche[] => [
  C(profil, n, 'couleurs', { nom: 'couleurs de la scène' }),
  C(profil, n + 1, 'scene', { nom: 'scène jouée' }),
]
export const SCENE_DROP_DEFAUT = 'depart07'

export function profilsDeDepart(): Profil[] {
  return [
    { id: 'club0001', nom: 'club', couches: [
      C('club', 1, 'declencheur', { nom: 'le drop lance une scène', signal: 'drop', scene: SCENE_DROP_DEFAUT, mesures: 4, seuil: 30, lissage: 0 }),
      C('club', 2, 'modulation', { nom: 'la montée accélère', signal: 'montee', cible: 'tempo', mode: 'remplace', min: 100, max: 190, lissage: 30 }),
      C('club', 3, 'modulation', { nom: 'flash sur la grosse caisse', signal: 'kick', cible: 'general', mode: 'multiplie', min: 75, max: 100, lissage: 0 }),
      C('club', 4, 'modulation', { nom: 'pulsation selon le volume', signal: 'volume', cible: 'profondeur', mode: 'remplace', min: 10, max: 55, lissage: 25 }),
      C('club', 5, 'modulation', { nom: 'intensité selon le volume', signal: 'volume_court', cible: 'general', mode: 'multiplie', min: 75, max: 100, lissage: 40 }),
      C('club', 6, 'modulation', { nom: 'le point source suit le son', signal: 'pan', cible: 'source_x', mode: 'remplace', min: 15, max: 85, lissage: 30 }),
      C('club', 7, 'couleur', { nom: 'les aigus éclaircissent', signal: 'hat', cible: 'saturation', mode: 'remplace', min: 100, max: 40, lissage: 0 }),
      C('club', 8, 'couleur', { nom: 'son rond : couleurs chaudes', signal: 'chaleur', cible: 'chaleur', mode: 'remplace', min: -50, max: 50, lissage: 60 }),
      C('club', 9, 'couleur', { nom: 'mineur froid, majeur chaud', signal: 'mode', cible: 'palette', palettes: ['cool', 'sunset'], lissage: 0 }),
      ...BASES('club', 10),
    ] },
    { id: 'graves01', nom: 'graves seuls', couches: [
      C('graves', 1, 'modulation', { nom: 'flash sur les basses', signal: 'basses', cible: 'general', mode: 'multiplie', min: 50, max: 100, lissage: 10 }),
      ...BASES('graves', 2),
    ] },
    { id: 'douce001', nom: 'ambiance douce', couches: [
      C('douce', 1, 'modulation', { nom: 'intensité selon le volume', signal: 'volume_court', cible: 'general', mode: 'multiplie', min: 40, max: 90, lissage: 60 }),
      C('douce', 2, 'modulation', { nom: 'pulsation légère', signal: 'volume_court', cible: 'profondeur', mode: 'remplace', min: 0, max: 35, lissage: 60 }),
      C('douce', 3, 'couleur', { nom: 'son rond : couleurs chaudes', signal: 'chaleur', cible: 'chaleur', mode: 'remplace', min: -40, max: 40, lissage: 80 }),
      C('douce', 4, 'couleur', { nom: 'mineur froid, majeur chaud', signal: 'mode', cible: 'palette', palettes: ['cool', 'sunset'], lissage: 0 }),
      ...BASES('douce', 5),
    ] },
    { id: 'zero0001', nom: 'à zéro', couches: BASES('zero', 1) },
  ]
}

export const CONFIG_DEPART = (): ConfigDj => ({ version: 1, actif: 'club0001', profils: profilsDeDepart(), sets: [] })
