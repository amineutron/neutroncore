import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getSettings, saveSettings, type Settings } from '../../lib/settings'
import {
  SIZE_LABEL, SPAN, hiddenIds, indexAtPoint, loadLayout, mergeVisibleOrder, persistLayout, previewOrder,
  reorder, safeZoom, sizeOf, toLocalPoint, toLocalRect, visibleIds, withHidden, withSize,
  type HomeLayout, type Point, type Rect, type SettingsStore, type WidgetSize,
} from '../../lib/homeLayout'
import './widgetGrid.css'

export type Widget = { id: string; label: string; node: ReactNode }

// Les reglages vivent dans neutroncore_settings ; `homeLayout` n'est pas (encore) dans
// le type Settings : on passe par un store non type (voir INTEGRATION.md pour le patch).
const store: SettingsStore = {
  read: () => getSettings() as unknown as Record<string, unknown>,
  write: (patch) => { saveSettings(patch as Partial<Settings>) },
}

type Drag = { id: string; order: string[]; pointer: Point }
type Session = { ids: string[]; rects: Rect[]; zoom: number; from: number }

const rootZoom = () => safeZoom(getComputedStyle(document.documentElement).zoom)

export function WidgetGrid({ widgets }: { widgets: Widget[] }) {
  const ids = useMemo(() => widgets.map((w) => w.id), [widgets])
  const [layout, setLayout] = useState<HomeLayout>(() => loadLayout(store, ids))
  const [editing, setEditing] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const session = useRef<Session | null>(null)

  const commit = (next: HomeLayout) => { setLayout(next); persistLayout(store, next) }
  const byId = new Map(widgets.map((w) => [w.id, w]))
  const shown = drag ? drag.order : visibleIds(layout).filter((id) => byId.has(id))

  function startDrag(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return
    const list = visibleIds(layout).filter((x) => byId.has(x))
    const zoom = rootZoom()
    // mesures VISUELLES converties une fois en local (zoom du mode tele)
    const rects = list.map((x) => {
      const el = grid.current?.querySelector<HTMLElement>(`[data-wg-id="${CSS.escape(x)}"]`)
      const r = el?.getBoundingClientRect()
      return toLocalRect({ left: r?.left ?? 0, top: r?.top ?? 0, width: r?.width ?? 0, height: r?.height ?? 0 }, zoom)
    })
    session.current = { ids: list, rects, zoom, from: list.indexOf(id) }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id, order: list, pointer: toLocalPoint({ x: e.clientX, y: e.clientY }, zoom) })
  }
  function moveDrag(e: React.PointerEvent) {
    const s = session.current
    if (!s || !drag) return
    const pointer = toLocalPoint({ x: e.clientX, y: e.clientY }, s.zoom)
    setDrag({ ...drag, pointer, order: previewOrder(s.ids, s.from, indexAtPoint(pointer, s.rects)) })
  }
  function endDrag(apply: boolean) {
    if (apply && drag) commit(mergeVisibleOrder(layout, drag.order))
    session.current = null
    setDrag(null)
  }
  function key(e: React.KeyboardEvent, id: string) {
    const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0
    if (!d) return
    e.preventDefault()
    const list = visibleIds(layout)
    const i = list.indexOf(id)
    commit(mergeVisibleOrder(layout, reorder(list, i, i + d)))
  }
  useEffect(() => {
    if (!drag) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') endDrag(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  })

  const hidden = hiddenIds(layout).filter((id) => byId.has(id))
  return (
    <>
      <div className="wg-bar">
        <button className={`btn sm ${editing ? 'solid' : ''}`} onClick={() => { setEditing(!editing); setDrag(null) }}>
          {editing ? 'terminer' : 'personnaliser l’accueil'}
        </button>
        {editing && <span className="wg-hint">glisse la poignée, ou flèches du clavier sur la poignée ; s / m / l = largeur</span>}
        {editing && (
          <button className="btn sm" onClick={() => commit({ order: ids, hidden: {}, sizes: {} })}>réinitialiser</button>
        )}
      </div>
      <div ref={grid} className={`wg-grid ${editing ? 'editing' : ''}`}>
        {shown.map((id, i) => {
          const w = byId.get(id)
          if (!w) return null
          const size = sizeOf(layout, id)
          return (
            <div key={id} data-wg-id={id} className={`wg-cell s${size} ${drag?.id === id ? 'dragging' : ''}`}
              style={{ gridColumn: `span ${SPAN[size]}`, order: i }}>
              {editing && (
                <div className="wg-tools">
                  <button className="wg-grip" aria-label={`déplacer ${w.label}`} title="glisser pour déplacer"
                    onPointerDown={(e) => startDrag(e, id)} onPointerMove={moveDrag}
                    onPointerUp={() => endDrag(true)} onPointerCancel={() => endDrag(false)}
                    onKeyDown={(e) => key(e, id)}>:::</button>
                  <b>{w.label}</b>
                  {([1, 2, 3] as WidgetSize[]).map((s) => (
                    <button key={s} className={`wg-sz ${s === size ? 'on' : ''}`} onClick={() => commit(withSize(layout, id, s))}>{SIZE_LABEL[s]}</button>
                  ))}
                  <button className="wg-sz" onClick={() => commit(withHidden(layout, id, true))}>masquer</button>
                </div>
              )}
              <div className="wg-body">{w.node}</div>
            </div>
          )
        })}
      </div>
      {editing && hidden.length > 0 && (
        <div className="wg-hidden">
          <span className="wg-hint">masqués :</span>
          {hidden.map((id) => (
            <button key={id} className="btn sm" onClick={() => commit(withHidden(layout, id, false))}>+ {byId.get(id)?.label}</button>
          ))}
        </div>
      )}
      {drag && (
        <div className="wg-ghost" style={{ left: drag.pointer.x + 14, top: drag.pointer.y + 14 }}>
          {byId.get(drag.id)?.label}
        </div>
      )}
    </>
  )
}
