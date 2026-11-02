// Réactions au contenu du son (option « bandes ») : calcul pur, miroir de `spatial_bandes.py` (huebeat).
// Basses (< 200 Hz) : un pic déclenche une onde ; voix (300-3400 Hz) : la couleur chauffe ; aigus (> 4000 Hz) :
// scintillement. Chaque bande est un niveau RELATIF (0 = son habituel, 1 = trois fois plus fort).
// Mêmes constantes et mêmes cas de test des deux côtés.

export type Vec3 = [number, number, number]
export type RGB = [number, number, number]
export type Bande = 'basses' | 'voix' | 'aigus'
export type Niveaux = Record<Bande, number>
export const BANDES: Bande[] = ['basses', 'voix', 'aigus']
export const LIBELLES_BANDES: Record<Bande, string> = { basses: 'basses', voix: 'voix', aigus: 'aigus' }

export const SEUIL_PIC = 0.55
export const REFRACTAIRE_S = 0.25
export const ONDE_DUREE_S = 1.4
export const ONDE_VITESSE = 0.9
export const SCINTILLE_HZ = 20
export const SCINTILLE_PART = 0.35
export const CHAUD: RGB = [1.0, 0.55, 0.2]

/** Ce que le calcul lit : niveaux des bandes, âge (en secondes) de chaque onde de basses en cours, et l'heure. */
export type EtatBandes = { niveaux: Niveaux; ondes: number[]; t: number }
export const NIVEAUX_NULS: Niveaux = { basses: 0, voix: 0, aigus: 0 }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function niveauRelatif(niveau: number, mediane: number, plancher = 1e-6): number {
  if (!Number.isFinite(niveau) || !Number.isFinite(mediane) || mediane <= plancher || niveau <= plancher) return 0
  return clamp01((niveau / mediane - 1) / 2)
}

/** Vrai quand les basses franchissent le seuil vers le haut, hors période réfractaire. */
export function picBasses(precedent: number, courant: number, depuisDernierS: number): boolean {
  return precedent < SEUIL_PIC && courant >= SEUIL_PIC && depuisDernierS >= REFRACTAIRE_S
}

export type EtatOndes = { ondes: number[]; dernier: number; precedent: number }
export const ETAT_ONDES_VIDE: EtatOndes = { ondes: [], dernier: -1e9, precedent: 0 }

/** Nouvel état des ondes après un niveau de basses (rien n'est modifié) ; les ondes finies sont retirées. */
export function avancerOndes(etat: EtatOndes, basses: number, now: number): EtatOndes {
  const declenche = picBasses(etat.precedent, basses, now - etat.dernier)
  const ondes = (declenche ? [...etat.ondes, now] : etat.ondes).filter((t) => now - t <= ONDE_DUREE_S)
  return { ondes, dernier: declenche ? now : etat.dernier, precedent: basses }
}

/** Les âges (en secondes) des ondes en cours, comme les attend `EtatBandes`. */
export function agesDesOndes(etat: EtatOndes, now: number): number[] {
  return etat.ondes.map((t) => now - t).filter((a) => a <= ONDE_DUREE_S)
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Niveau (0..1) d'une onde née `ageS` secondes plus tôt : un anneau qui grandit depuis la source en s'éteignant. */
export function ondePic(pos: Vec3, source: Vec3, diag: number, ageS: number): number {
  if (ageS < 0 || ageS > ONDE_DUREE_S || diag <= 0) return 0
  const ecart = dist(pos, source) - ageS * ONDE_VITESSE * diag
  return Math.exp(-((ecart / (0.18 * diag)) ** 2)) * (1 - ageS / ONDE_DUREE_S)
}

function hachage(x: number, y: number, z: number, k: number): number {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791) ^ Math.imul(k, 2654435761)) >>> 0
  h = (h ^ (h >>> 15)) >>> 0
  h = Math.imul(h, 2246822519) >>> 0
  return (h ^ (h >>> 13)) >>> 0
}

/** Scintillement d'une lampe : une part des lampes, tirée au hasard (reproductible) à chaque 1/20 s, s'allume
 * en proportion des aigus. */
export function scintillement(pos: Vec3, aigus: number, t: number): number {
  if (aigus <= 0) return 0
  const cle = hachage(Math.floor(pos[0] + 0.5), Math.floor(pos[1] + 0.5), Math.floor(pos[2] + 0.5), Math.floor(t * SCINTILLE_HZ))
  return (cle % 1000) / 1000 < SCINTILLE_PART ? aigus : 0
}

/** Tire la couleur vers l'orange en gardant sa luminosité (une lampe éteinte reste éteinte). */
export function chauffer(rgb: RGB, voix: number): RGB {
  const m = clamp01(voix) * 0.5
  const crete = Math.max(...rgb)
  return [0, 1, 2].map((i) => rgb[i] * (1 - m) + CHAUD[i] * crete * m) as RGB
}

/** Couleur d'une lampe (déjà multipliée par son niveau) après les réactions au son. */
export function reagir(rgb: RGB, pos: Vec3, source: Vec3, diag: number, etat: EtatBandes): RGB {
  const onde = etat.ondes.reduce((m, age) => Math.max(m, ondePic(pos, source, diag, age)), 0)
  const ajout = onde * 0.7 + scintillement(pos, etat.niveaux.aigus, etat.t) * 0.5
  const crete = Math.max(...rgb)
  const teinte: RGB = crete > 1e-6 ? [rgb[0] / crete, rgb[1] / crete, rgb[2] / crete] : [1, 1, 1]
  return chauffer([0, 1, 2].map((i) => clamp01(rgb[i] + teinte[i] * ajout)) as RGB, etat.niveaux.voix)
}
