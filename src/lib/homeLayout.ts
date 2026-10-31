// Disposition des widgets de l'accueil : logique pure (aucun acces DOM ici).
// Stockee dans les reglages (cle `homeLayout` de neutroncore_settings).

export type WidgetSize = 1 | 2 | 3   // s / m / l
export type HomeLayout = {
  order: string[]
  hidden: Record<string, boolean>
  sizes: Record<string, WidgetSize>
}
export type Rect = { left: number; top: number; width: number; height: number }
export type Point = { x: number; y: number }

// colonnes de la grille (6) occupees par taille : s = un tiers, m = moitie, l = pleine largeur
export const SPAN: Record<WidgetSize, number> = { 1: 2, 2: 3, 3: 6 }
export const SIZE_LABEL: Record<WidgetSize, string> = { 1: 's', 2: 'm', 3: 'l' }
export const DEFAULT_SIZE: WidgetSize = 3   // l'accueil d'avant : tout en pleine largeur

export function defaultLayout(ids: string[]): HomeLayout {
  return { order: [...ids], hidden: {}, sizes: {} }
}

const isSize = (v: unknown): v is WidgetSize => v === 1 || v === 2 || v === 3

// Relit une valeur brute (fichier, localStorage) : ignore l'inconnu, ajoute les
// nouveaux widgets en fin d'ordre. Ne leve jamais.
export function normalizeLayout(raw: unknown, ids: string[]): HomeLayout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const known = new Set(ids)
  const saved = Array.isArray(r.order) ? r.order.filter((x): x is string => typeof x === 'string' && known.has(x)) : []
  const order = [...new Set(saved), ...ids.filter((id) => !saved.includes(id))]
  const hidden: Record<string, boolean> = {}
  const sizes: Record<string, WidgetSize> = {}
  const h = (r.hidden && typeof r.hidden === 'object' ? r.hidden : {}) as Record<string, unknown>
  const s = (r.sizes && typeof r.sizes === 'object' ? r.sizes : {}) as Record<string, unknown>
  for (const id of order) {
    if (h[id] === true) hidden[id] = true
    if (isSize(s[id])) sizes[id] = s[id]
  }
  return { order, hidden, sizes }
}

export const sizeOf = (l: HomeLayout, id: string): WidgetSize => l.sizes[id] ?? DEFAULT_SIZE
export const visibleIds = (l: HomeLayout): string[] => l.order.filter((id) => !l.hidden[id])
export const hiddenIds = (l: HomeLayout): string[] => l.order.filter((id) => l.hidden[id])

// Deplace l'element a l'index `from` vers l'index `to` (copie, jamais en place).
export function reorder(order: string[], from: number, to: number): string[] {
  if (from < 0 || from >= order.length) return order
  const t = Math.max(0, Math.min(order.length - 1, to))
  if (t === from) return order
  const next = order.filter((_, i) => i !== from)
  next.splice(t, 0, order[from])
  return next
}

export const withSize = (l: HomeLayout, id: string, size: WidgetSize): HomeLayout =>
  ({ ...l, sizes: { ...l.sizes, [id]: size } })

export function withHidden(l: HomeLayout, id: string, hide: boolean): HomeLayout {
  const hidden = { ...l.hidden }
  if (hide) hidden[id] = true
  else delete hidden[id]
  return { ...l, hidden }
}

// Remet un nouvel ordre des widgets VISIBLES dans l'ordre complet : les masques
// gardent leur place, les visibles prennent les places des visibles.
export function mergeVisibleOrder(l: HomeLayout, newVisible: string[]): HomeLayout {
  const queue = [...newVisible]
  const order = l.order.map((id) => (l.hidden[id] ? id : queue.shift() ?? id))
  return { ...l, order }
}

export const withOrder = (l: HomeLayout, order: string[]): HomeLayout => ({ ...l, order })

// ---------- geometrie du glisser-deposer ----------
// Le mode tele applique `zoom` sur :root. getBoundingClientRect et clientX/Y sont
// alors en coordonnees VISUELLES, alors que left/top/transform s'ecrivent en
// coordonnees LOCALES (visuelles / zoom). Toute la logique ci-dessous parle en
// local ; le composant convertit une fois a l'entree avec ces deux fonctions.
export const toLocalPoint = (p: Point, zoom: number): Point => ({ x: p.x / zoom, y: p.y / zoom })
export const toLocalRect = (r: Rect, zoom: number): Rect =>
  ({ left: r.left / zoom, top: r.top / zoom, width: r.width / zoom, height: r.height / zoom })

export function safeZoom(z: unknown): number {
  const n = typeof z === 'string' ? parseFloat(z) : typeof z === 'number' ? z : 1
  return Number.isFinite(n) && n > 0.05 && n < 20 ? n : 1
}

const inside = (p: Point, r: Rect) =>
  p.x >= r.left && p.x <= r.left + r.width && p.y >= r.top && p.y <= r.top + r.height

// Position de la souris (locale) -> index de la case visee. Dans une case = cette
// case ; entre deux cases (gouttiere) ou hors grille = la case la plus proche
// (distance au rectangle, pas au centre : une grande case reste visee de loin).
export function indexAtPoint(p: Point, rects: Rect[]): number {
  if (rects.length === 0) return -1
  const hit = rects.findIndex((r) => inside(p, r))
  if (hit >= 0) return hit
  let best = 0
  let bestD = Infinity
  rects.forEach((r, i) => {
    const dx = Math.max(r.left - p.x, 0, p.x - (r.left + r.width))
    const dy = Math.max(r.top - p.y, 0, p.y - (r.top + r.height))
    const d = dx * dx + dy * dy
    if (d < bestD) { bestD = d; best = i }
  })
  return best
}

// Raccourci : point et rectangles VISUELS + zoom du root -> index.
export function indexAtVisualPoint(p: Point, visualRects: Rect[], zoom: number): number {
  const z = safeZoom(zoom)
  return indexAtPoint(toLocalPoint(p, z), visualRects.map((r) => toLocalRect(r, z)))
}

// Ordre apercu pendant un glisser : la case `from` d'origine passe a la case visee.
export function previewOrder(startOrder: string[], from: number, hover: number): string[] {
  return hover < 0 ? startOrder : reorder(startOrder, from, hover)
}

// ---------- stockage dans les reglages ----------
export type SettingsStore = { read: () => Record<string, unknown>; write: (patch: Record<string, unknown>) => void }

export function loadLayout(store: SettingsStore, ids: string[]): HomeLayout {
  try { return normalizeLayout(store.read().homeLayout, ids) } catch { return defaultLayout(ids) }
}
export function persistLayout(store: SettingsStore, layout: HomeLayout): void {
  store.write({ homeLayout: layout })
}
