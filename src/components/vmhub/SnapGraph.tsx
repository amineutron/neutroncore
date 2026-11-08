import { useEffect, useMemo, useRef, useState } from 'react'
import { fitView, laneOf, layout, neighbor, panBy, px, py, zoomAt, type NavKey, type SnapNode, type View } from '../../lib/vmSnapTree'

export type SnapMeta = Record<string, { when?: string; pin?: boolean; ram?: boolean }>
const NOW = 'maintenant'

/** Arbre interactif : glisser pour deplacer, molette pour zoomer, fleches pour naviguer, clic pour choisir. */
export function SnapGraph({ nodes, head, selected, meta, dirty, running, onSelect, resetKey }: {
  nodes: SnapNode[]; head: string | null; selected: string; meta: SnapMeta; dirty: boolean; running: boolean
  onSelect: (name: string) => void; resetKey: string
}) {
  const L = useMemo(() => layout(nodes, head), [nodes, head])
  const svg = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View | null>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean; name: string | null } | null>(null)

  // ajuste a l'ouverture, a chaque changement de machine, et tant que l'utilisateur n'a pas bouge la vue
  // (la largeur du dessin n'est connue qu'apres la mise en page)
  const touched = useRef(false)
  const Lref = useRef(L)
  Lref.current = L
  useEffect(() => {
    const el = svg.current
    if (!el) return
    touched.current = false
    const refit = () => { if (!touched.current && el.clientWidth > 0) setView(fitView(Lref.current, el.clientWidth, el.clientHeight || 440)) }
    refit()
    const ro = new ResizeObserver(refit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [resetKey])

  useEffect(() => {
    const el = svg.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      touched.current = true
      const r = el.getBoundingClientRect()
      setView((v) => (v ? zoomAt(v, e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top) : v))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])

  const down = (e: React.PointerEvent) => {
    const t = (e.target as Element).closest('[data-sid]') as HTMLElement | null
    drag.current = { x: e.clientX, y: e.clientY, moved: false, name: t?.dataset.sid ?? null }
    try { svg.current?.setPointerCapture(e.pointerId) } catch { /* pointeur synthetique */ }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true
    if (d.moved) {
      touched.current = true
      d.x = e.clientX; d.y = e.clientY
      setView((v) => (v ? panBy(v, dx, dy) : v))
    }
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved && d.name) onSelect(d.name)
  }
  const key = (e: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    // depuis « maintenant », gauche revient au snapshot courant
    // gauche depuis « maintenant » : snapshot courant ; droite depuis le courant sans enfant : « maintenant »
    const leaf = selected === head && !nodes.some((n) => n.parent === selected)
    const t = selected === NOW ? (e.key === 'ArrowLeft' ? head : null) : e.key === 'ArrowRight' && leaf ? NOW : neighbor(nodes, selected, e.key as NavKey)
    if (t) { e.preventDefault(); onSelect(t) }
  }

  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    `M${px(a.x)},${py(a.y)} C${px(a.x) + 75},${py(a.y)} ${px(b.x) - 75},${py(b.y)} ${px(b.x)},${py(b.y)}`
  const col = (y: number) => `var(--vh-l${laneOf(y)})`

  return (
    <svg ref={svg} className="vh-gsvg" tabIndex={0} role="application" aria-label="arbre des snapshots, flèches pour naviguer, entrée pour agir dans le panneau"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null }} onKeyDown={key}>
      <g transform={view ? `translate(${view.x},${view.y}) scale(${view.k})` : undefined}>
        {nodes.map((n) => n.parent && L.pos[n.parent] && L.pos[n.name]
          ? <path key={`e-${n.name}`} className="vh-edge" d={curve(L.pos[n.parent], L.pos[n.name])} stroke={col(L.pos[n.name].y)} /> : null)}
        {head && L.pos[head] && <path className="vh-edge g" d={curve(L.pos[head], L.ghost)} />}
        {nodes.map((n) => {
          const p = L.pos[n.name]
          const m = meta[n.name] ?? {}
          return (
            <g key={n.name} className={`vh-nd${n.name === selected ? ' sel' : ''}${n.name === head ? ' head' : ''}`} data-sid={n.name} transform={`translate(${px(p.x)},${py(p.y)})`}>
              <title>{n.name}</title>
              <circle className="sring" r={19} /><circle className="ring" r={15} /><circle className="dotc" r={9} fill={col(p.y)} />
              {m.pin && <path d="M0,-17 l2.2,4.4 4.8,.7 -3.5,3.4 .8,4.8 -4.3,-2.3 -4.3,2.3 .8,-4.8 -3.5,-3.4 4.8,-.7z" fill="var(--gold)" transform="translate(0,-4) scale(.75)" />}
              {m.ram && <rect x={9} y={-14} width={9} height={9} rx={2} fill="var(--vh-l3)" />}
              <text className="nm" y={31} textAnchor="middle">{n.name.length > 17 ? `${n.name.slice(0, 16)}…` : n.name}</text>
              <text className="dt" y={44} textAnchor="middle">{m.when ?? ''}</text>
            </g>
          )
        })}
        <g className={`vh-nd ghost${selected === NOW ? ' sel' : ''}`} data-sid={NOW} transform={`translate(${px(L.ghost.x)},${py(L.ghost.y)})`}>
          <circle className="sring" r={19} /><circle className="dotc" r={9} />
          <text className="nm" y={31} textAnchor="middle">maintenant</text>
          <text className="dt" y={44} textAnchor="middle">{dirty ? '● modifié' : running ? 'en marche' : 'à jour'}</text>
        </g>
      </g>
    </svg>
  )
}

export { NOW as NOW_NODE }
