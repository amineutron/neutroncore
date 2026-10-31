// Fondu de retour de huebeat dans l'aperçu : après un silence, ou quand la détection ne prend plus aucun temps,
// les lampes s'éteignent d'un coup puis reviennent en fondu d'une demi-seconde. Miroir de `presence_cible` et
// `suivre_presence` (spatial_fx.py de huebeat) : mêmes constantes, mêmes cas de test.

export const SILENCE_ATTENTE = 1.2        // secondes sans son avant de commencer à éteindre
export const SILENCE_FONDU = 1.5          // durée de l'extinction
export const TEMPS_SANS_DETECTION = 8     // temps que l'horloge comble seule quand la détection n'en prend plus
export const FONDU_RETOUR_S = 0.5

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const tempoConnu = (bpm: number) => Number.isFinite(bpm) && bpm >= 40 && bpm <= 240

/** 1 tant qu'il y a du son, puis fondu vers 0. `Infinity` = jamais de son. */
export function gainSilence(sansSonS: number): number {
  if (!Number.isFinite(sansSonS)) return 0
  return clamp01(1 - (sansSonS - SILENCE_ATTENTE) / SILENCE_FONDU)
}

/** Selon le temps écoulé depuis le dernier temps PRIS par la détection : huit temps comblés, puis extinction sur deux
 * temps. `Infinity` = jamais rien pris. */
export function gainSansTemps(depuisLeDernierS: number, bpm: number): number {
  if (!Number.isFinite(depuisLeDernierS)) return 0
  const duree = tempoConnu(bpm) ? (2 * 60) / bpm : 1
  const limite = tempoConnu(bpm) ? (TEMPS_SANS_DETECTION * 60) / bpm : 2.5
  return clamp01(1 - (depuisLeDernierS - limite) / duree)
}

/** Part de lumière que le silence et l'absence de temps pris laissent (0..1), avant le fondu de retour. */
export function presenceCible(sansSonS: number, sansTempsS: number, bpm: number): number {
  return Math.min(gainSilence(sansSonS), gainSansTemps(sansTempsS, bpm))
}

/** Présence après `dtS` secondes : elle retombe d'un coup, mais ne remonte qu'en fondu. */
export function suivrePresence(presence: number, cible: number, dtS: number): number {
  return cible > presence ? Math.min(cible, presence + dtS / FONDU_RETOUR_S) : cible
}

/** Ce qui reste différent entre l'aperçu et les vraies lampes, à afficher tel quel sur l'écran. */
export const LIMITES_APERCU: string[] = [
  'le fondu de retour après un silence est montré comme sur les lampes : extinction d’un coup, retour en une demi-seconde',
  'l’aperçu recale son horloge sur les relevés de l’api (toutes les 1,5 s) ; les lampes la corrigent à chaque temps détecté, donc elles peuvent être un peu en avance ou en retard sur l’écran',
  'les lampes ont un retard (pont, ampoules) que l’aperçu ne simule pas',
  'les ampoules ne rendent pas toutes les couleurs comme l’écran : le blanc, les teintes très saturées et les très faibles intensités peuvent différer',
  'les réactions au son (onde de basses, scintillement, voix) sont calculées d’après le relevé d’écoute de l’api, six fois par seconde : l’onde d’un pic de basses peut démarrer quelques dixièmes de seconde plus tard sur l’écran',
  'le scintillement des aigus est tiré au hasard à chaque 20e de seconde : les lampes qui scintillent ne sont pas forcément les mêmes sur l’écran et dans la pièce',
  'dans un mix qui mêle 2d et 3d, l’aperçu superpose les couches sans le gamma des lampes (qui met la 3d au carré) : la 3d s’y voit un peu plus fort que dans ta pièce, surtout sous une couche 2d',
  'dans un mix, chaque appareil de l’aperçu se rattache au canal de lampe le plus proche dans le plan : deux appareils presque superposés peuvent ne pas suivre exactement la même couche que sur les lampes',
]
