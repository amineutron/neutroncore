import { useId, useRef } from 'react'
import { segEnds, segHeight, type Plan } from '../lib/plan'
import { heightFromFloor } from '../lib/plan'
import { backWalls, heightDelta, orbit, project, wallCorners, type P3, type View } from '../lib/plan3d'
import type { Measured } from './RoomPlan'
import { segId, segIndex } from './RoomPlan'

const SIZE = 600            // unités du dessin (le SVG s'adapte à sa carte)
const TV_W = 100, TV_H = 57 // téléviseur 45 pouces, en cm
const TAP_PX = 5            // en dessous, un appui est un toucher (sélection), pas une rotation

// Vue 3D de la pièce : sol quadrillé, murs du fond, TV, ruban LED et lampes sur
// leur tige. Glisser le fond tourne la vue ; glisser une lampe vers le haut ou
// le bas règle sa HAUTEUR (sa place au sol se règle dans la vue de dessus).
export function RoomPlan3D({ plan, colors, selected, measured, view, onView, onSelect, onHeight }: {
  plan: Plan; colors: Record<string, string>; selected: string | null; measured: Measured | null
  view: View; onView: (fn: (v: View) => View) => void; onSelect: (id: string | null) => void
  onHeight: (id: string, heightCm: number) => void
}) {
  // pick : objet sous le doigt à l'appui ; il n'est sélectionné qu'au relâchement, si on n'a pas tourné
  // lift : hauteur (cm) de la lampe saisie, mise à jour pendant le glissement ; null = on tourne la vue
  const drag = useRef<{ pointer: number; x: number; y: number; moved: number; pick: string | null; lift: number | null } | null>(null)
  const picked = useRef<string | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const blur = useId()
  const dims = plan.roomDims
  const pr = (p: P3) => project(p, view, dims, SIZE)
  const pts = (list: P3[]) => list.map(pr).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const hw = dims.w / 2, hh = dims.h / 2
  const floor: P3[] = [{ x: -hw, y: -hh, z: 0 }, { x: hw, y: -hh, z: 0 }, { x: hw, y: hh, z: 0 }, { x: -hw, y: hh, z: 0 }]

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const pick = picked.current   // posé juste avant par l'objet touché (l'événement remonte jusqu'ici)
    picked.current = null
    if (!e.isPrimary || e.button !== 0) return
    const lamp = pick ? plan.configs[pick] : undefined
    const seg = pick ? plan.strip?.segs?.[segIndex(pick)] : undefined
    // une lampe ou un segment du ruban se règle en hauteur ; le fond fait tourner la vue
    drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, pick, lift: lamp ? heightFromFloor(lamp.pos.z, dims) : seg ? segHeight(seg, dims) : null }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { drag.current = null }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    const moved = d.moved + Math.abs(dx) + Math.abs(dy)
    if (d.lift === null || !d.pick) {
      onView((v) => orbit(v, dx, dy))
      drag.current = { ...d, x: e.clientX, y: e.clientY, moved }
      return
    }
    // pixels écran -> unités du dessin (la matrice tient compte de la taille affichée et du zoom télé)
    const scale = svg.current?.getScreenCTM()?.d || 1
    const lift = Math.min(dims.d, Math.max(0, d.lift + heightDelta(dy / scale, view, dims, SIZE)))
    drag.current = { ...d, x: e.clientX, y: e.clientY, moved, lift }
    if (moved >= TAP_PX) onHeight(d.pick, Math.round(lift))
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    if (d.moved < TAP_PX) onSelect(d.pick)
    drag.current = null
  }
  const cancel = (e: React.PointerEvent) => { if (drag.current?.pointer === e.pointerId) drag.current = null }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return   // une touche sur un objet focalisé ne tourne pas la vue
    const step: Record<string, [number, number]> = { ArrowLeft: [-25, 0], ArrowRight: [25, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }
    const d = step[e.key]
    if (!d) return
    e.preventDefault()
    onView((v) => orbit(v, d[0], d[1]))
  }
  // props communes aux objets sélectionnables (toucher, ou Entrée / Espace au clavier)
  const pickable = (id: string, label: string) => ({
    className: `rp3-pick ${selected === id ? 'sel' : ''}`, tabIndex: 0, role: 'button', 'aria-label': label, 'aria-pressed': selected === id,
    onPointerDown: () => { picked.current = id },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id) } },
  })

  // tout ce qui a un volume est trié du fond vers l'avant : ce qui est devant se dessine par-dessus
  const items: { depth: number; node: React.ReactNode }[] = []

  const tv = plan.tv
  if (tv) {
    // rectangle vertical sur son mur ; tv.pos.z = hauteur de son centre depuis le sol
    const quad: P3[] = [
      { x: tv.pos.x - TV_W / 2, y: tv.pos.y, z: tv.pos.z - TV_H / 2 }, { x: tv.pos.x + TV_W / 2, y: tv.pos.y, z: tv.pos.z - TV_H / 2 },
      { x: tv.pos.x + TV_W / 2, y: tv.pos.y, z: tv.pos.z + TV_H / 2 }, { x: tv.pos.x - TV_W / 2, y: tv.pos.y, z: tv.pos.z + TV_H / 2 },
    ]
    const glow = measured ? [measured.left, measured.top, measured.right].map((l) => l[Math.floor(l.length / 2)]).filter(Boolean) : []
    items.push({
      depth: pr({ x: tv.pos.x, y: tv.pos.y, z: tv.pos.z }).depth,
      node: (
        <g key="tv" pointerEvents="none">
          {glow.map((c, i) => {
            const p = pr({ x: quad[0].x + (TV_W * (i + 0.5)) / glow.length, y: tv.pos.y, z: tv.pos.z })
            return <circle key={i} cx={p.x} cy={p.y} r={46} fill={c} opacity={0.5} filter={`url(#${blur})`} />
          })}
          <polygon className="rp-tv" points={pts(quad)} />
        </g>
      ),
    })
  }

  ;(plan.strip?.segs ?? []).forEach((sg, i) => {
    const haut = segHeight(sg, dims)
    const [a, b] = segEnds(sg).map((e) => pr({ ...e, z: haut }))
    const pied = pr({ x: sg.pos.x, y: sg.pos.y, z: 0 }), milieu = pr({ x: sg.pos.x, y: sg.pos.y, z: haut })
    items.push({
      depth: (a.depth + b.depth) / 2,
      node: (
        <g key={segId(i)} {...pickable(segId(i), `Segment ${i + 1} du ruban LED, à ${Math.round(haut)} centimètres du sol. Flèches haut et bas pour régler la hauteur.`)}
          className={`rp3-pick ${selected === segId(i) ? 'sel' : ''}`}
          onKeyDown={(e) => {
            const step = e.key === 'ArrowUp' ? 5 : e.key === 'ArrowDown' ? -5 : 0
            if (step) { e.preventDefault(); onHeight(segId(i), Math.round(haut) + step * (e.shiftKey ? 4 : 1)) }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(segId(i)) }
          }}>
          {selected === segId(i) && <line className="rp3-stem" x1={pied.x} y1={pied.y} x2={milieu.x} y2={milieu.y} />}
          {/* trait épais invisible : cible tactile */}
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={26} strokeLinecap="round" />
          <line className="rp-strip" x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={5} />
        </g>
      ),
    })
  })

  Object.entries(plan.configs).forEach(([id, cfg]) => {
    const z = cfg.pos.z + dims.d / 2   // pos.z des lampes est centré sur la mi-hauteur
    const foot = pr({ x: cfg.pos.x, y: cfg.pos.y, z: 0 }), head = pr({ x: cfg.pos.x, y: cfg.pos.y, z })
    const color = colors[id]
    const pool = 30 + z * 0.12
    items.push({
      depth: head.depth,
      node: (
        <g key={id} {...pickable(id, `${cfg.name}, à ${Math.round(z)} centimètres du sol. Flèches haut et bas pour régler la hauteur.`)}
          className={`rp3-pick rp3-lamp ${selected === id ? 'sel' : ''}`}
          onKeyDown={(e) => {
            const step = e.key === 'ArrowUp' ? 5 : e.key === 'ArrowDown' ? -5 : 0
            if (step) { e.preventDefault(); onHeight(id, Math.round(z) + step * (e.shiftKey ? 4 : 1)) }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id) }
          }}>
          {color && <ellipse cx={foot.x} cy={foot.y} rx={pool} ry={pool * Math.sin((view.tilt * Math.PI) / 180)} fill={color} opacity={0.22} filter={`url(#${blur})`} pointerEvents="none" />}
          <line className="rp3-stem" x1={foot.x} y1={foot.y} x2={head.x} y2={head.y} />
          <circle className="rp3-foot" cx={foot.x} cy={foot.y} r={3} />
          {color && <circle cx={head.x} cy={head.y} r={20} fill={color} opacity={0.35} filter={`url(#${blur})`} pointerEvents="none" />}
          <circle cx={head.x} cy={head.y} r={20} fill="transparent" />
          <circle className="rp-dot" cx={head.x} cy={head.y} r={8} fill={color ?? 'var(--off)'} strokeWidth={1.5} />
          <text className="rp-label" x={head.x} y={head.y - 14} fontSize={12} textAnchor="middle">{cfg.name.toLowerCase()}</text>
        </g>
      ),
    })
  })

  return (
    <svg ref={svg} className="rp rp3" viewBox={`0 0 ${SIZE} ${SIZE}`} tabIndex={0} role="group"
      aria-label="Vue 3D de la pièce. Glisser le fond ou flèches pour tourner autour ; glisser une lampe de haut en bas pour régler sa hauteur."
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={cancel}
      onLostPointerCapture={cancel} onKeyDown={onKeyDown}>
      {backWalls(view).map((w) => <polygon key={w} className="rp3-wall" points={pts(wallCorners(w, dims))} />)}
      <polygon className="rp3-floor" points={pts(floor)} />
      {Array.from({ length: Math.max(0, Math.ceil(dims.w / 100) - 1) }, (_, i) => {
        const x = -hw + (i + 1) * 100, a = pr({ x, y: -hh, z: 0 }), b = pr({ x, y: hh, z: 0 })
        return <line key={`gx${i}`} className="rp-grid" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      })}
      {Array.from({ length: Math.max(0, Math.ceil(dims.h / 100) - 1) }, (_, i) => {
        const y = -hh + (i + 1) * 100, a = pr({ x: -hw, y, z: 0 }), b = pr({ x: hw, y, z: 0 })
        return <line key={`gy${i}`} className="rp-grid" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      })}
      {[...items].sort((a, b) => a.depth - b.depth).map((it) => it.node)}
      <defs><filter id={blur} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation={12} /></filter></defs>
    </svg>
  )
}
