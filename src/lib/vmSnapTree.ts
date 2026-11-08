// Arbre des snapshots d'une VM : reconstruction, disposition, vue (zoom, deplacement),
// navigation au clavier. Pur et teste (vmSnapTree.test.ts). Iteratif : une chaine de
// plusieurs milliers de snapshots ne doit pas faire deborder la pile.

export type SnapIn = { name: string; depth: number; parent?: string | null }
export type SnapNode = { name: string; parent: string | null; depth: number }

/** Noeuds propres : parent explicite quand l'API le donne, sinon reconstruit depuis `depth`
 *  (liste en pre-ordre : le parent est le dernier noeud de profondeur depth-1 rencontre).
 *  Un parent inconnu, un auto-parent ou un doublon ne cassent rien : le noeud devient une racine. */
export function treeOf(snaps: SnapIn[]): SnapNode[] {
  const lastAt: string[] = []
  const names = new Set(snaps.map((s) => s.name))
  const seen = new Set<string>()
  const out: SnapNode[] = []
  for (const s of snaps) {
    if (seen.has(s.name)) continue
    seen.add(s.name)
    const depth = Math.max(0, Math.floor(s.depth) || 0)
    let parent: string | null
    if (s.parent !== undefined) parent = s.parent && names.has(s.parent) && s.parent !== s.name ? s.parent : null
    else parent = depth > 0 ? lastAt[depth - 1] ?? null : null
    lastAt[depth] = s.name
    lastAt.length = depth + 1
    out.push({ name: s.name, parent, depth })
  }
  return breakCycles(out)
}

/** Casse les cycles d'un parent explicite abime, en O(n) (le noeud qui referme le cycle devient racine). */
function breakCycles(nodes: SnapNode[]): SnapNode[] {
  const parent = new Map(nodes.map((n) => [n.name, n.parent]))
  const done = new Set<string>()
  const cut = new Set<string>()
  for (const n of nodes) {
    if (done.has(n.name)) continue
    const path = new Set<string>()
    let cur: string | null = n.name
    while (cur && !done.has(cur)) {
      if (path.has(cur)) { cut.add(cur); break }
      path.add(cur)
      cur = parent.get(cur) ?? null
    }
    path.forEach((p) => done.add(p))
  }
  return cut.size ? nodes.map((n) => (cut.has(n.name) ? { ...n, parent: null } : n)) : nodes
}

export const XS = 150
export const YS = 78
export const PAD = 64
export const LANE_COLORS = 6

export type Pos = { x: number; y: number }
export type Layout = {
  pos: Record<string, Pos>
  kids: Record<string, string[]>
  roots: string[]
  ghost: Pos
  lanes: number
  /** taille du dessin en pixels (marges comprises) */
  w: number
  h: number
}

/** Disposition gauche-droite : x = profondeur dans l'arbre, y = couloir. Un noeud prend le couloir de
 *  son premier enfant (la branche principale reste droite), les autres branches ouvrent un couloir.
 *  Le noeud fantome « maintenant » prolonge `head` (ou ouvre un couloir si head a deja des enfants). */
export function layout(nodes: SnapNode[], head: string | null): Layout {
  const kids: Record<string, string[]> = {}
  const roots: string[] = []
  const known = new Set(nodes.map((n) => n.name))
  for (const n of nodes) {
    if (n.parent && known.has(n.parent)) (kids[n.parent] ??= []).push(n.name)
    else roots.push(n.name)
  }
  const pos: Record<string, Pos> = {}
  const order: string[] = []
  const stack = [...roots].reverse()
  const depth: Record<string, number> = {}
  for (const r of roots) depth[r] = 0
  while (stack.length) {
    const n = stack.pop() as string
    if (pos[n]) continue
    pos[n] = { x: depth[n], y: 0 }
    order.push(n)
    const ch = kids[n] ?? []
    for (let i = ch.length - 1; i >= 0; i--) { depth[ch[i]] = depth[n] + 1; stack.push(ch[i]) }
  }
  let lane = 0
  for (const n of order) if (!(kids[n] ?? []).length) pos[n] = { ...pos[n], y: lane++ }
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i]
    const ch = kids[n] ?? []
    if (ch.length) pos[n] = { ...pos[n], y: pos[ch[0]].y }
  }
  const maxLane = lane - 1
  const hp = head ? pos[head] : undefined
  const ghost: Pos = !nodes.length ? { x: 0, y: 0 }
    : !hp ? { x: 0, y: maxLane + 1 }
    : (kids[head as string] ?? []).length ? { x: hp.x + 1, y: maxLane + 1 }
    : { x: hp.x + 1, y: hp.y }
  const maxX = order.reduce((m, n) => Math.max(m, pos[n].x), Math.max(ghost.x, 0))
  const maxY = Math.max(ghost.y, maxLane, 0)
  return { pos, kids, roots, ghost, lanes: maxY + 1, w: maxX * XS + 2 * PAD, h: maxY * YS + 2 * PAD }
}

export const px = (x: number): number => PAD + x * XS
export const py = (y: number): number => PAD + y * YS
export const laneOf = (y: number): number => ((y % LANE_COLORS) + LANE_COLORS) % LANE_COLORS

// ---------------------------------------------------------------- vue

export type View = { x: number; y: number; k: number }
export const K_MIN = 0.35
export const K_MAX = 2.6
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Vue qui montre tout l'arbre, centre, sans agrandir au-dela de 1,1. */
export function fitView(l: Pick<Layout, 'w' | 'h'>, cw: number, ch: number): View {
  const w = l.w + 40, h = l.h + 70
  const k = clamp(Math.min(cw / w, ch / h), 0.5, 1.1)
  return { k, x: (cw - l.w * k) / 2, y: (ch - l.h * k) / 2 - 6 * k }
}

/** Zoom autour d'un point de l'ecran (la zone sous le curseur ne bouge pas). */
export function zoomAt(v: View, factor: number, mx: number, my: number): View {
  const k = clamp(v.k * factor, K_MIN, K_MAX)
  return { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) }
}

export const panBy = (v: View, dx: number, dy: number): View => ({ ...v, x: v.x + dx, y: v.y + dy })

// ------------------------------------------------------- clavier, suppression

export type NavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

/** Noeud voisin : gauche = parent, droite = premier enfant, haut/bas = branche voisine. */
export function neighbor(nodes: SnapNode[], from: string, key: NavKey): string | null {
  const n = nodes.find((x) => x.name === from)
  if (!n) return null
  if (key === 'ArrowLeft') return n.parent
  const kids = nodes.filter((x) => x.parent === from)
  if (key === 'ArrowRight') return kids[0]?.name ?? null
  const sib = nodes.filter((x) => x.parent === n.parent)
  const i = sib.findIndex((x) => x.name === from)
  return sib[i + (key === 'ArrowDown' ? 1 : -1)]?.name ?? null
}

/** Effet d'une suppression : les enfants sont rattaches au parent. null = suppression refusee. */
export function afterDelete(nodes: SnapNode[], name: string): { nodes: SnapNode[]; moved: string[] } | { error: string } {
  const n = nodes.find((x) => x.name === name)
  if (!n) return { error: 'snapshot introuvable' }
  const kids = nodes.filter((x) => x.parent === name)
  if (!n.parent && kids.length > 1) return { error: 'cette racine porte plusieurs branches : supprime ou regroupe les branches d\'abord' }
  return {
    nodes: nodes.filter((x) => x.name !== name).map((x) => (x.parent === name ? { ...x, parent: n.parent } : x)),
    moved: kids.map((k) => k.name),
  }
}
