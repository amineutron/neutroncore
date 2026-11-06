// Mode d'affichage de la télé : image à l'écran, ou « sound only » (panneau éteint, son et réseau conservés).
// Logique pure, testée dans ecranTv.test.ts.

export type ModeEcran = 'ecran' | 'son' | 'inconnu' | 'indisponible'

type Etat = { power?: string; screen?: string } | undefined

/** Le mode vu depuis l'état renvoyé par /tv/status. Télé en veille ou injoignable : pas de mode ; panneau illisible : inconnu. */
export function modeEcran(etat: Etat): ModeEcran {
  if (!etat || etat.power !== 'On') return 'indisponible'
  const s = (etat.screen ?? '').toLowerCase()
  if (s === 'on') return 'ecran'
  if (s === 'off') return 'son'
  return 'inconnu'
}

export function texteMode(m: ModeEcran): string {
  switch (m) {
    case 'ecran': return 'L’image s’affiche : mode écran.'
    case 'son': return 'Le panneau est éteint, le son continue : mode sound only.'
    case 'inconnu': return 'État du panneau inconnu.'
    default: return 'La télé est en veille ou injoignable.'
  }
}
