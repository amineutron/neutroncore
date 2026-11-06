// DJ Light : les signaux musicaux (logique pure, testée dans djSignaux.test.ts).
// Une image du moteur audio de l'API (`GET /djlight/flux`) devient une vingtaine de signaux de 0 à 1 que les couches
// viennent lire. Rien ici ne dessine ni ne parle au réseau.

/** Une attaque : `on` vaut vrai UNE image au moment du coup, `v` est sa force (0..1). */
export type Impulsion = { on: boolean; v: number }

/** Une image du moteur audio, telle que l'API l'envoie (contrat de `/djlight/flux`). */
export type ImageAudio = {
  t: number
  spec: number[]                    // 96 bandes log, 30 Hz - 16 kHz, 0..255
  wave: number[]                    // 128 échantillons, -127..127
  pts: [number, number][]           // 48 paires gauche/droite pour le vectoroscope
  lufs: { m: number; s: number }    // volume perçu : momentané (400 ms) et court terme (3 s)
  bandes: { sub: number; basses: number; mediums: number; aigus: number }   // niveaux relatifs 0..1
  kick: Impulsion
  snare: Impulsion
  hat: Impulsion
  chroma: number[]                  // 12 hauteurs, Do en premier
  centroide: number                 // Hz
  corr: number                      // corrélation stéréo, 1 = mono
  pan: number                       // -1 gauche, 1 droite
  silence: boolean
}

export const SIGNAUX = [
  'sub', 'basses', 'mediums', 'aigus', 'volume', 'volume_court', 'kick', 'snare', 'hat', 'drop', 'montee',
  'chaleur', 'largeur', 'pan', 'mode', 'tonalite', 'tempo', 'temps1',
] as const
export type SignalId = (typeof SIGNAUX)[number]
export type Signaux = Record<SignalId, number>
export type GenreSignal = 'continu' | 'impulsion'

export const SIGNAUX_INFO: Record<SignalId, { label: string; quoi: string; genre: GenreSignal }> = {
  sub: { label: 'sous-graves', quoi: 'Les sons les plus bas, sous 60 Hz : le grondement des basses.', genre: 'continu' },
  basses: { label: 'basses', quoi: 'Les graves sous 200 Hz : grosse caisse et ligne de basse.', genre: 'continu' },
  mediums: { label: 'médiums', quoi: 'De 300 à 3400 Hz : la voix, les guitares, les claviers.', genre: 'continu' },
  aigus: { label: 'aigus', quoi: 'Au-dessus de 4 kHz : cymbales, charleston, brillance.', genre: 'continu' },
  volume: { label: 'volume', quoi: 'Le volume perçu à l’instant (LUFS momentané) : monte sur un passage fort, redescend sur un calme.', genre: 'continu' },
  volume_court: { label: 'volume lent', quoi: 'Le volume perçu moyenné sur 3 secondes : suit l’énergie du passage plutôt que chaque coup.', genre: 'continu' },
  kick: { label: 'grosse caisse', quoi: 'Un pic à chaque coup de grosse caisse, qui retombe vite.', genre: 'impulsion' },
  snare: { label: 'caisse claire', quoi: 'Un pic à chaque caisse claire ou clap.', genre: 'impulsion' },
  hat: { label: 'charleston', quoi: 'Un pic à chaque charleston ou coup d’aigus.', genre: 'impulsion' },
  drop: { label: 'drop', quoi: 'Un pic quand tout revient après un break : le moment fort d’un morceau électro.', genre: 'impulsion' },
  montee: { label: 'montée', quoi: 'De 0 à 1 pendant la montée avant un drop : le break, les caisses claires qui s’accélèrent.', genre: 'continu' },
  chaleur: { label: 'chaleur du son', quoi: '1 pour un son sombre et rond, 0 pour un son brillant et froid (d’après la répartition des fréquences).', genre: 'continu' },
  largeur: { label: 'largeur stéréo', quoi: '0 pour un son centré, 1 pour un son très large.', genre: 'continu' },
  pan: { label: 'position gauche / droite', quoi: '0 pour un son à gauche, 0,5 au centre, 1 à droite.', genre: 'continu' },
  mode: { label: 'mode mineur / majeur', quoi: '0 en mineur (sombre), 1 en majeur (ouvert), 0,5 tant que la tonalité n’est pas trouvée.', genre: 'continu' },
  tonalite: { label: 'tonalité', quoi: 'La note de la gamme trouvée, de Do (0) à Si (1) : pour faire tourner les couleurs avec les accords.', genre: 'continu' },
  tempo: { label: 'tempo', quoi: 'La vitesse de la musique : 60 pulsations par minute valent 0, 180 valent 1.', genre: 'continu' },
  temps1: { label: 'premier temps de la mesure', quoi: 'Un pic sur le « un » de chaque mesure (3 ou 4 temps), qui retombe en une demi-seconde : pour accentuer le début de la mesure. Demande que le cycle soit trouvé.', genre: 'impulsion' },
}

export const SIGNAUX_NULS: Signaux = Object.fromEntries(SIGNAUX.map((s) => [s, s === 'mode' || s === 'pan' ? 0.5 : 0])) as Signaux

export const clamp01 = (v: number): number => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0)

/** Volume perçu en 0..1 : -40 LUFS (presque silence) vaut 0, -6 LUFS (très fort) vaut 1. */
export function volumeDepuisLufs(lufs: number): number {
  return clamp01((lufs + 40) / 34)
}

/** Chaleur d'un son en 0..1 d'après son centroïde spectral : 250 Hz (sombre) vaut 1, 4 kHz (brillant) vaut 0. */
export function chaleurDepuisCentroide(hz: number): number {
  if (!Number.isFinite(hz) || hz <= 0) return 0.5
  return clamp01(1 - Math.log2(hz / 250) / 4)
}

/** Largeur stéréo en 0..1 d'après la corrélation : mono (1) donne 0, décorrélé (0 ou moins) donne 1. */
export function largeurDepuisCorr(corr: number): number {
  return clamp01(1 - corr)
}

// ---- échelle qui s'adapte --------------------------------------------------------------------------------
// Une échelle fixe (-40 à -6 LUFS) donne 15 % de volume à quelqu'un qui écoute bas : les rangées qui lisent le volume ne
// bougent presque plus et le détecteur de drop ne voit jamais de « passage fort ». L'échelle suit donc ce que le
// morceau fait vraiment : bas = ses moments calmes (10e centile), haut = ses moments forts (95e centile) sur 90 s.

export type Echelle = { echant: number[]; dernier: number }
export const ECHELLE_VIDE: Echelle = { echant: [], dernier: -1e9 }
const ECHELLE_PAS_S = 0.5, ECHELLE_MAX = 180

/** Ajoute une mesure (au plus une toutes les 0,5 s). Rend une nouvelle échelle. */
export function pousserEchelle(e: Echelle, x: number, t: number): Echelle {
  if (!Number.isFinite(x) || t - e.dernier < ECHELLE_PAS_S) return e
  return { echant: [...e.echant.slice(-(ECHELLE_MAX - 1)), x], dernier: t }
}

/** Bornes (bas, haut) de l'échelle : celles de départ tant qu'on n'a rien vu, puis, en une minute, celles mesurées.
 * `ecartMini` empêche d'agrandir le moindre souffle quand le morceau ne bouge presque pas. */
export function bornesEchelle(e: Echelle, depart: [number, number], ecartMini: number, qBas = 0.1, qHaut = 0.95): [number, number] {
  const n = e.echant.length
  if (n < 8) return depart
  const t = [...e.echant].sort((a, b) => a - b)
  let bas = t[Math.floor(qBas * (n - 1))], haut = t[Math.floor(qHaut * (n - 1))]
  if (haut - bas < ecartMini) { const mil = (haut + bas) / 2; bas = mil - ecartMini / 2; haut = mil + ecartMini / 2 }
  const w = Math.min(1, n / 40)                       // fondu sur les 20 premières secondes
  return [depart[0] + (bas - depart[0]) * w, depart[1] + (haut - depart[1]) * w]
}

export const ECHELLE_VOLUME_DEPART: [number, number] = [-40, -6]
export const ECART_VOLUME_MINI = 8                    // LU : en dessous, le morceau est « plat »
export const ECHELLE_CHALEUR_DEPART: [number, number] = [Math.log2(500), Math.log2(6000)]
export const ECART_CHALEUR_MINI = 1.2                 // octave
export const ECHELLE_LARGEUR_DEPART: [number, number] = [0, 0.6]
export const ECART_LARGEUR_MINI = 0.2                 // 1 - corrélation

/** Rapproche `courant` de `cible` : constante de temps `tauMonte` en montée, `tauDescente` en descente (secondes). 0 = d'un coup. */
export function suivre(courant: number, cible: number, dt: number, tauMonte: number, tauDescente: number): number {
  const tau = cible > courant ? tauMonte : tauDescente
  if (tau <= 0 || dt <= 0) return tau <= 0 ? cible : courant
  return cible + (courant - cible) * Math.exp(-dt / tau)
}

/** Constantes de temps (s) de chaque signal continu : monte vite, retombe un peu plus lentement. */
const TAU: Partial<Record<SignalId, [number, number]>> = {
  sub: [0.04, 0.25], basses: [0.04, 0.2], mediums: [0.06, 0.25], aigus: [0.04, 0.15],
  volume: [0.08, 0.35], volume_court: [0.5, 1.2], chaleur: [1.2, 1.8], largeur: [0.8, 1.2], pan: [0.15, 0.3],
}
/** Durée de retombée (s) d'une impulsion : un pic de grosse caisse dure plus qu'un charleston. */
const RETOMBEE = { kick: 0.22, snare: 0.16, hat: 0.07, drop: 1.4, temps1: 0.45 } as const

/** Ce que l'analyse (tonalité, tempo, drop) ajoute à une image pour fabriquer les signaux. */
export type Analyse = {
  mineur: boolean | null; tonique: number | null; confianceCle: number; bpm: number | null; montee: number; drop: boolean
  temps1?: boolean                          // le premier temps de la mesure vient de tomber
  /** Échelles mesurées sur le morceau (LUFS et log2 du centroïde) ; absentes, on prend les échelles fixes. */
  echelles?: { volume: [number, number]; chaleur: [number, number]; largeur: [number, number] }
}

/** Les signaux après une nouvelle image. `dt` en secondes ; rien n'est modifié, un nouvel objet est rendu. */
export function avancerSignaux(prev: Signaux, img: ImageAudio, dt: number, an: Analyse): Signaux {
  const s = (id: SignalId, cible: number): number => {
    const [m, d] = TAU[id] ?? [0, 0]
    return suivre(prev[id], clamp01(cible), dt, m, d)
  }
  const pic = (id: 'kick' | 'snare' | 'hat' | 'drop' | 'temps1', declenche: boolean, force: number): number => {
    const retombe = prev[id] * Math.exp(-dt / RETOMBEE[id])
    return declenche ? Math.max(retombe, clamp01(force)) : retombe
  }
  const calme = img.silence
  const ev = an.echelles?.volume, ec = an.echelles?.chaleur, el = an.echelles?.largeur
  const largeur = el ? clamp01((1 - img.corr - el[0]) / (el[1] - el[0])) : largeurDepuisCorr(img.corr)
  const vol = (lufs: number): number => (ev ? clamp01((lufs - ev[0]) / (ev[1] - ev[0])) : volumeDepuisLufs(lufs))
  const chaleur = ec && img.centroide > 0 ? clamp01(1 - (Math.log2(img.centroide) - ec[0]) / (ec[1] - ec[0])) : chaleurDepuisCentroide(img.centroide)
  return {
    sub: s('sub', calme ? 0 : img.bandes.sub),
    basses: s('basses', calme ? 0 : img.bandes.basses),
    mediums: s('mediums', calme ? 0 : img.bandes.mediums),
    aigus: s('aigus', calme ? 0 : img.bandes.aigus),
    volume: s('volume', calme ? 0 : vol(img.lufs.m)),
    volume_court: s('volume_court', calme ? 0 : vol(img.lufs.s)),
    kick: pic('kick', img.kick.on, img.kick.v),
    snare: pic('snare', img.snare.on, img.snare.v),
    hat: pic('hat', img.hat.on, img.hat.v),
    drop: pic('drop', an.drop, 1),
    temps1: pic('temps1', an.temps1 === true, 1),
    montee: clamp01(an.montee),
    chaleur: s('chaleur', chaleur),
    largeur: s('largeur', largeur),
    pan: s('pan', (img.pan + 1) / 2),
    mode: an.mineur === null ? 0.5 : prev.mode + ((an.mineur ? 0 : 1) - prev.mode) * Math.min(1, dt / 1.2),
    tonalite: an.tonique === null ? prev.tonalite : an.tonique / 12,
    tempo: an.bpm === null ? prev.tempo : clamp01((an.bpm - 60) / 120),
  }
}
