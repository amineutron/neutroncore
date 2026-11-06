// De quelle couleur est l'Ambilight : celles que tu as choisies à la main, sinon celle que montrent les lampes, sinon celles
// de la scène jouée, sinon la couleur de repli. Seule la luminosité vient du son (djAmbilight.ts) ; ici, la teinte.
// Logique pure, testée dans djAmbilightTeinte.test.ts.
import type { ReglagesAmbilight } from './djAmbilight'

export type LampeCouleur = { id: number; rgb: [number, number, number] }   // 0..1, comme la trame des lampes

const LUMINOSITE_MIN = 0.03        // une lampe plus sombre que cela est éteinte : sa teinte ne veut rien dire
const TEMPS_PAR_MESURE = 4
const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)
const hex2 = (v: number): string => Math.round(v * 255).toString(16).padStart(2, '0')

/** La couleur de la lampe la plus lumineuse, remise à pleine luminosité (la luminosité, c'est le son qui la donne). */
export function teinteDesLampes(lampes: readonly LampeCouleur[]): string | null {
  let meilleure: [number, number, number] | null = null, max = 0
  for (const l of lampes) {
    const c = l.rgb.map(clamp01)
    const m = Math.max(c[0], c[1], c[2])
    if (m > max) { max = m; meilleure = [c[0], c[1], c[2]] }
  }
  if (!meilleure || max < LUMINOSITE_MIN) return null
  return `#${meilleure.map((v) => hex2(v / max)).join('')}`
}

/** Les couleurs de la liste se succèdent, une par mesure, en boucle. */
export function teinteEnSuccession(couleurs: readonly string[], beat: number): string | null {
  if (couleurs.length === 0) return null
  const mesure = Number.isFinite(beat) && beat > 0 ? Math.floor(beat / TEMPS_PAR_MESURE) : 0
  return couleurs[mesure % couleurs.length]
}

type Entree = {
  reglages: Pick<ReglagesAmbilight, 'couleurs' | 'couleur'>
  lampes: readonly LampeCouleur[] | null      // null : les vraies lampes ne sont pas branchées
  scene: readonly string[]                    // les couleurs de la scène jouée en ce moment
  beat: number
}

/** La teinte du moment : choix manuel, puis lampes, puis scène, puis couleur de repli. */
export function choisirTeinte({ reglages, lampes, scene, beat }: Entree): string {
  return teinteEnSuccession(reglages.couleurs, beat)
    ?? (lampes ? teinteDesLampes(lampes) : null)
    ?? teinteEnSuccession(scene, beat)
    ?? reglages.couleur
}
