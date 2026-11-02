// Vue télé de la lumière 3d : navigation à la télécommande (flèches) dans la grille des scènes.

/** Prochain index dans une grille de `cols` colonnes ; reste sur place au bord (pas de saut de ligne surprise). */
export function navigue(index: number, touche: string, cols: number, n: number): number {
  if (n <= 0) return 0
  const c = Math.max(1, cols)
  const i = Math.min(n - 1, Math.max(0, index))
  switch (touche) {
    case 'ArrowRight': return i + 1 < n && (i + 1) % c !== 0 ? i + 1 : i
    case 'ArrowLeft': return i % c !== 0 ? i - 1 : i
    case 'ArrowDown': return i + c < n ? i + c : i
    case 'ArrowUp': return i - c >= 0 ? i - c : i
    default: return i
  }
}

/** Texte du tempo, lisible de loin. */
export function texteTempo(bpm: number | undefined, actif: boolean, silence?: boolean): string {
  if (!actif) return 'lampes arrêtées'
  if (silence) return 'pas de son'
  return bpm && bpm > 0 ? `${Math.round(bpm)} par minute` : 'tempo en recherche'
}
