// DJ Light sur les vraies lampes (logique pure) : la couleur que doit avoir chaque canal Entertainment, et la trame
// binaire qui la porte jusqu'à huebeat. Le calcul est exactement celui de la pièce 3d (`evaluer`) : ce qu'on voit à
// l'écran est ce que les lampes reçoivent. Même rendu que `sortie_lampe` de huebeat : gamma perceptuel en 3d
// (une LED à 10 % paraît encore très allumée), linéaire en 2d (le niveau y est déjà une enveloppe au carré).

import { evaluer, rangs, type Dims, type FxId, type FxParams, type Vec3 } from './spatialFx'

export type Canal = { id: number; pos: Vec3 }
export type Couleur = { id: number; rgb: [number, number, number] }          // 0..1
/** Positions des canaux telles que l'API les rend : numéro de canal -> [x, y, z] en cm (x et y centrés, z depuis le sol). */
export type CanauxPlan = Record<string, number[]>

/** Les canaux utilisables : numéro entier de 0 à 255, position finie. Rangés par numéro. */
export function lireCanaux(brut: CanauxPlan | null | undefined): Canal[] {
  const liste: Canal[] = []
  for (const [cle, p] of Object.entries(brut ?? {})) {
    const id = Number(cle)
    if (!Number.isInteger(id) || id < 0 || id > 255) continue
    if (!Array.isArray(p) || p.length < 3 || !p.slice(0, 3).every(Number.isFinite)) continue
    liste.push({ id, pos: [p[0], p[1], p[2]] })
  }
  return liste.sort((a, b) => a.id - b.id)
}

/** La couleur de chaque canal à cet instant. `silence` éteint tout (rien ne joue sur l'appareil écouté). */
export function couleursCanaux(canaux: Canal[], effets: FxId[], params: FxParams, dims: Dims, beat: number, silence: boolean): Couleur[] {
  if (silence) return canaux.map((c) => ({ id: c.id, rgb: [0, 0, 0] }))
  const rg = rangs(canaux.map((c) => c.pos))
  const lineaire = params.mode === '2d'
  return canaux.map((c, i) => {
    const s = evaluer(effets, { id: `canal:${c.id}`, kind: 'lampe', pos: c.pos }, dims, params, beat, rg[i])
    const k = (v: number) => {
      const x = Math.min(1, Math.max(0, v * s.niveau))
      return lineaire ? x : x * x
    }
    return { id: c.id, rgb: [k(s.rgb[0]), k(s.rgb[1]), k(s.rgb[2])] }
  })
}

/** Trame HueStream : par canal `>BHHH` (numéro, r, g, b en 0..65535). Même format que `lib/djlight_reel.py` côté API. */
export function encoderTrame(couleurs: Couleur[]): Uint8Array {
  const out = new Uint8Array(couleurs.length * 7)
  const vue = new DataView(out.buffer)
  couleurs.forEach((c, i) => {
    const o = i * 7
    vue.setUint8(o, c.id)
    c.rgb.forEach((v, k) => vue.setUint16(o + 1 + k * 2, Math.round(Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0)) * 65535), false))
  })
  return out
}

/** Relit une trame (essais, outils de diagnostic). */
export function decoderTrame(trame: Uint8Array): Couleur[] {
  const vue = new DataView(trame.buffer, trame.byteOffset, trame.byteLength)
  const liste: Couleur[] = []
  for (let o = 0; o + 7 <= trame.byteLength; o += 7) {
    liste.push({ id: vue.getUint8(o), rgb: [vue.getUint16(o + 1) / 65535, vue.getUint16(o + 3) / 65535, vue.getUint16(o + 5) / 65535] })
  }
  return liste
}
