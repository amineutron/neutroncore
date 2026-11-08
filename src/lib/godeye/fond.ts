// God Eye : fond de carte détaillé (logique pure, testée dans fond.test.ts).
// Décode une topologie TopoJSON (Natural Earth 50 m via world-atlas, domaine public) en lignes prêtes à dessiner :
// côtes des terres et frontières entre pays. Aucun accès à la toile ici.

import { TERRE_DIXIEMES } from '../vueMondeTerre'

/** Une ligne : sommets [lon0, lat0, lon1, lat1, ...] en degrés, et son rectangle englobant (pour ne pas dessiner hors de l'écran). */
export type Ligne = { pts: Float32Array; ouest: number; sud: number; est: number; nord: number }
export type FondDetaille = { terres: Ligne[]; frontieres: Ligne[] }

type Topologie = {
  transform?: { scale: [number, number]; translate: [number, number] }
  arcs: number[][][]
  objects: Record<string, { geometries?: Geometrie[] } & Geometrie>
}
type Geometrie = { type?: string; arcs?: unknown; geometries?: Geometrie[] }

function enLigne(pts: number[]): Ligne {
  let ouest = Infinity, sud = Infinity, est = -Infinity, nord = -Infinity
  for (let i = 0; i < pts.length; i += 2) {
    ouest = Math.min(ouest, pts[i]); est = Math.max(est, pts[i])
    sud = Math.min(sud, pts[i + 1]); nord = Math.max(nord, pts[i + 1])
  }
  return { pts: Float32Array.from(pts), ouest, sud, est, nord }
}

/** Arcs décodés en degrés : [lon, lat, lon, lat, ...] (les deltas quantifiés sont cumulés puis mis à l'échelle). */
export function decoderArcs(topo: Pick<Topologie, 'arcs' | 'transform'>): number[][] {
  const [sx, sy] = topo.transform?.scale ?? [1, 1]
  const [tx, ty] = topo.transform?.translate ?? [0, 0]
  return topo.arcs.map((arc) => {
    let x = 0, y = 0
    const sortie: number[] = []
    for (const p of arc) {
      if (!Array.isArray(p) || p.length < 2) continue
      x += p[0]; y += p[1]
      sortie.push(x * sx + tx, y * sy + ty)
    }
    return sortie
  })
}

/** Un arc négatif (`~i`) se parcourt à l'envers. */
function sommetsArc(arcs: number[][], i: number): number[] {
  if (i >= 0) return arcs[i] ?? []
  const a = arcs[~i] ?? []
  const sortie: number[] = []
  for (let k = a.length - 2; k >= 0; k -= 2) sortie.push(a[k], a[k + 1])
  return sortie
}

function collecterAnneaux(g: Geometrie | undefined, sortie: number[][][]): void {
  if (!g) return
  if (g.type === 'GeometryCollection') { for (const s of g.geometries ?? []) collecterAnneaux(s, sortie); return }
  if (g.type === 'Polygon' && Array.isArray(g.arcs)) sortie.push(g.arcs as number[][])
  if (g.type === 'MultiPolygon' && Array.isArray(g.arcs)) for (const p of g.arcs as number[][][]) sortie.push(p)
}

/** Anneaux (contours fermés) de tous les polygones de l'objet nommé : chaque anneau = liste d'indices d'arcs. */
function anneauxDe(topo: Topologie, objet: string): number[][] {
  const polys: number[][][] = []
  collecterAnneaux(topo.objects[objet], polys)
  return polys.flat()
}

/** Contours des terres : un anneau = ses arcs mis bout à bout (le premier sommet d'un arc est le dernier du précédent). */
export function contoursTerres(topo: Topologie, objet = 'land'): Ligne[] {
  const arcs = decoderArcs(topo)
  return anneauxDe(topo, objet).map((anneau) => {
    const pts: number[] = []
    anneau.forEach((i) => {
      const s = sommetsArc(arcs, i)
      pts.push(...(pts.length ? s.slice(2) : s))
    })
    return enLigne(pts)
  }).filter((l) => l.pts.length >= 6)
}

/** Frontières : les arcs que se partagent deux pays (un arc utilisé une seule fois est une côte, déjà dessinée par les terres). */
export function frontieresEntrePays(topo: Topologie, objet = 'countries'): Ligne[] {
  const arcs = decoderArcs(topo)
  const emplois = new Map<number, number>()
  for (const anneau of anneauxDe(topo, objet)) for (const i of anneau) emplois.set(i < 0 ? ~i : i, (emplois.get(i < 0 ? ~i : i) ?? 0) + 1)
  const lignes: Ligne[] = []
  for (const [i, n] of emplois) if (n >= 2 && (arcs[i]?.length ?? 0) >= 4) lignes.push(enLigne(arcs[i]))
  return lignes
}

let legeres: Ligne[] | null = null
/** Fond léger du bundle (110 m) sous la même forme : sert tant que le fond détaillé n'est pas chargé. */
export const terresLegeres = (): Ligne[] => (legeres ??= TERRE_DIXIEMES.map((r) => enLigne(r.map((v) => v / 10))))

export function fondDepuis(terres: Topologie, pays: Topologie): FondDetaille {
  return { terres: contoursTerres(terres), frontieres: frontieresEntrePays(pays) }
}

let enCours: Promise<FondDetaille> | null = null
let pret: FondDetaille | null = null

/** Fond déjà chargé, ou null (à ce moment on dessine le fond léger du bundle). */
export const fondPret = (): FondDetaille | null => pret

/** Charge le fond détaillé une seule fois, à la demande (deux fichiers, environ 1,3 Mo, dans un bloc à part). */
export function chargerFond(): Promise<FondDetaille> {
  enCours ??= Promise.all([import('world-atlas/land-50m.json'), import('world-atlas/countries-50m.json')])
    .then(([t, p]) => { pret = fondDepuis(t.default as unknown as Topologie, p.default as unknown as Topologie); return pret })
    .catch((e: unknown) => { enCours = null; throw e })
  return enCours
}
