// God Eye : apparence du fond de carte et du globe (logique pure, testée dans apparence.test.ts) : palettes, quadrillage, réglages de la carte.

export type GrilleReglage = 'auto' | 10 | 15 | 30
export type ReglagesCarte = { grille: GrilleReglage; equateur: boolean; tropiques: boolean }
export const REGLAGES_CARTE_DEFAUT: ReglagesCarte = { grille: 'auto', equateur: false, tropiques: false }
export const CLE_CARTE = 'neutroncore_godeye_carte'
export const GRILLES: readonly GrilleReglage[] = ['auto', 10, 15, 30]
export const LAT_TROPIQUE = 23.4366

/** Relit les réglages enregistrés ; toute valeur illisible retombe sur le défaut. */
export function lireReglagesCarte(brut: string | null): ReglagesCarte {
  let o: Record<string, unknown> = {}
  try { const j = JSON.parse(brut ?? 'null'); if (j && typeof j === 'object') o = j as Record<string, unknown> } catch { /* défauts */ }
  const g = o.grille
  return { grille: g === 10 || g === 15 || g === 30 ? g : 'auto', equateur: o.equateur === true, tropiques: o.tropiques === true }
}

/** Pas du quadrillage en degrés : le choix, ou (auto) plus fin à mesure qu'on zoome. `figee` = texture du globe, refaite rarement. */
export function pasGrille(r: GrilleReglage, zoom: number, figee = false): 10 | 15 | 30 {
  if (r !== 'auto') return r
  if (figee) return 15
  return zoom < 2.2 ? 30 : zoom < 5 ? 15 : 10
}

export type Grille = { meridiens: number[]; paralleles: number[]; speciales: { lat: number; nom: string }[] }

/** Méridiens et parallèles à tracer ; équateur et tropiques sont des lignes à part (le pas ne les range pas toujours). */
export function lignesGrille(pas: number, r: Pick<ReglagesCarte, 'equateur' | 'tropiques'>): Grille {
  const meridiens: number[] = []
  const paralleles: number[] = []
  for (let lon = -180; lon <= 180; lon += pas) meridiens.push(lon)
  const max = Math.floor(75 / pas) * pas
  for (let lat = -max; lat <= max; lat += pas) if (lat !== 0 || !r.equateur) paralleles.push(lat)
  const speciales: Grille['speciales'] = []
  if (r.equateur) speciales.push({ lat: 0, nom: 'équateur' })
  if (r.tropiques) speciales.push({ lat: LAT_TROPIQUE, nom: 'tropique du Cancer' }, { lat: -LAT_TROPIQUE, nom: 'tropique du Capricorne' })
  return { meridiens, paralleles, speciales }
}

export type Palette = {
  mer: [string, string, string]
  terre: [string, string, string, string]
  /** Terres remplies ? (sinon seulement leurs contours, sur un fond uni). */
  remplir: boolean
  /** Relief procédural par-dessus les terres (vue satellite). */
  relief: boolean
}

/**
 * Palette du fond. texture=false : fond uni, contours seuls ; satellite : mer presque noire, terres sombres teintées
 * (vert, ocre en altitude, glace aux pôles) avec un relief fabriqué sans réseau.
 */
export function palette(texture: boolean, satellite: boolean): Palette {
  if (!texture) return { mer: ['#0a1426', '#0a1426', '#0a1426'], terre: ['#0a1426', '#0a1426', '#0a1426', '#0a1426'], remplir: false, relief: false }
  if (satellite) return { mer: ['#04101c', '#030c16', '#04101c'], terre: ['#1d3a2e', '#2b4a2c', '#5a5636', '#b9c5cc'], remplir: true, relief: true }
  return { mer: ['#0b1d38', '#0a2342', '#0b1d38'], terre: ['#2d5a52', '#3b6a55', '#4a6b4d', '#8fa3ad'], remplir: true, relief: false }
}

/** Bruit de valeur déterministe (graine fixe) : `taille` x `taille` valeurs 0..1, sur `octaves` passes. Sert au relief du mode satellite. */
export function bruitRelief(taille: number, octaves = 4, graine = 7): Float32Array {
  const hash = (x: number, y: number, o: number): number => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(o, 1442695041) + Math.imul(graine, 1274126177)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295
  }
  const sortie = new Float32Array(taille * taille)
  let amp = 1, somme = 0
  for (let o = 0; o < octaves; o++) {
    const g = 4 << o
    for (let y = 0; y < taille; y++) {
      for (let x = 0; x < taille; x++) {
        const fx = (x / taille) * g, fy = (y / taille) * g
        const x0 = Math.floor(fx), y0 = Math.floor(fy)
        const tx = fx - x0, ty = fy - y0
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
        const a = hash(x0 % g, y0 % g, o), b = hash((x0 + 1) % g, y0 % g, o), c = hash(x0 % g, (y0 + 1) % g, o), d = hash((x0 + 1) % g, (y0 + 1) % g, o)
        sortie[y * taille + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy)
      }
    }
    somme += amp
    amp /= 2
  }
  for (let i = 0; i < sortie.length; i++) sortie[i] /= somme
  return sortie
}
