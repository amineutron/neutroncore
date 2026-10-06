import { useId, useRef } from 'react'
import { fromSvg, toSvg, type Plan } from '../lib/plan'

export type Measured = { left: string[]; top: string[]; right: string[]; bottom: string[] }

// Vue de dessus de la pièce, en centimètres. Les lampes se déplacent au doigt
// ou à la souris ; la TV et le ruban LED sont affichés mais restent à HALO.
export function RoomPlan({ plan, colors, selected, measured, onSelect, onMove }: {
  plan: Plan
  colors: Record<string, string>          // id de lampe -> couleur quand elle est allumée
  selected: string | null
  measured: Measured | null               // couleurs Ambilight mesurées par la TV
  onSelect: (id: string | null) => void
  onMove: (id: string, xy: { x: number; y: number }) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  // un seul glissement à la fois, lié à SON pointeur (un second doigt ne le détourne pas)
  const drag = useRef<{ id: string; pointer: number } | null>(null)
  const blur = useId()
  const { w, h } = plan.roomDims
  const unit = Math.max(w, h) / 100       // tailles relatives à la pièce, quel que soit le zoom
  const pad = unit * 6

  // point écran -> centimètres du dessin (la matrice tient compte du zoom du mode télé)
  function point(e: React.PointerEvent): { x: number; y: number } | null {
    const ctm = svg.current?.getScreenCTM()
    if (!ctm || ctm.a * ctm.d - ctm.b * ctm.c === 0) return null   // matrice non inversible (dessin sans taille)
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || drag.current.pointer !== e.pointerId) return
    const p = point(e)
    if (p) onMove(drag.current.id, fromSvg(p, plan.roomDims))
  }
  const stop = (e: React.PointerEvent) => { if (drag.current?.pointer === e.pointerId) drag.current = null }
  function grab(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    onSelect(id)
    if (drag.current || !e.isPrimary || e.button !== 0) return
    drag.current = { id, pointer: e.pointerId }
    try { svg.current?.setPointerCapture(e.pointerId) } catch { drag.current = null }
  }
  // au clavier : flèches = 5 cm, avec Maj = 20 cm
  function nudge(e: React.KeyboardEvent, id: string) {
    const d = e.shiftKey ? 20 : 5
    const delta: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }
    const move = delta[e.key]
    if (!move) return
    e.preventDefault()
    const pos = plan.configs[id].pos
    onMove(id, { x: pos.x + move[0], y: pos.y + move[1] })
  }

  const tv = plan.tv ? toSvg(plan.tv.pos, plan.roomDims) : null
  const tvW = unit * 24
  const strip = plan.strip
  const glow = (list: string[] | undefined) => list?.[Math.floor(list.length / 2)]

  return (
    <svg ref={svg} className="rp" viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}
      role="group" aria-label={`Plan de la pièce, ${Math.round(w)} par ${Math.round(h)} centimètres. Flèches pour déplacer la lampe sélectionnée.`}
      onPointerMove={onPointerMove} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onSelect(null) }}>
      <rect className="rp-room" x={0} y={0} width={w} height={h} rx={unit * 1.5} onPointerDown={() => onSelect(null)} />
      {/* repère : un trait tous les mètres */}
      {Array.from({ length: Math.floor(w / 100) }, (_, i) => <line key={`v${i}`} className="rp-grid" x1={(i + 1) * 100} y1={0} x2={(i + 1) * 100} y2={h} />)}
      {Array.from({ length: Math.floor(h / 100) }, (_, i) => <line key={`h${i}`} className="rp-grid" x1={0} y1={(i + 1) * 100} x2={w} y2={(i + 1) * 100} />)}

      {strip && (() => {
        const a = toSvg(strip.pos, plan.roomDims), b = toSvg(strip.stripEnd, plan.roomDims)
        return <line className="rp-strip" x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={unit * 1.4} />
      })()}

      {tv && (
        <g>
          {measured && (['left', 'top', 'right'] as const).map((side, i) => {
            const c = glow(measured[side])
            return c ? <circle key={side} cx={tv.x + (i - 1) * tvW * 0.42} cy={tv.y} r={unit * 9} fill={c} opacity={0.55} filter={`url(#${blur})`} pointerEvents="none" /> : null
          })}
          <rect className="rp-tv" x={tv.x - tvW / 2} y={tv.y - unit * 1.2} width={tvW} height={unit * 2.4} rx={unit * 0.6} />
          <text className="rp-label" x={tv.x} y={tv.y + unit * 6} fontSize={unit * 3} textAnchor="middle">tv</text>
        </g>
      )}

      {Object.entries(plan.configs).map(([id, cfg]) => {
        const p = toSvg(cfg.pos, plan.roomDims)
        const color = colors[id]
        return (
          <g key={id} className={`rp-light ${selected === id ? 'sel' : ''}`} tabIndex={0} role="button"
            aria-label={`${cfg.name}, à ${Math.round(p.x)} centimètres du mur gauche et ${Math.round(p.y)} du mur de la télé`}
            onFocus={() => onSelect(id)} onKeyDown={(e) => nudge(e, id)} onPointerDown={(e) => grab(e, id)}>
            {/* halo décoratif : ne doit pas capter les clics destinés à une lampe voisine */}
            {color && <circle cx={p.x} cy={p.y} r={unit * 9} fill={color} opacity={0.3} filter={`url(#${blur})`} pointerEvents="none" />}
            {/* cible tactile large, invisible */}
            <circle cx={p.x} cy={p.y} r={unit * 6} fill="transparent" />
            <circle className="rp-dot" cx={p.x} cy={p.y} r={unit * 2.6} fill={color ?? 'var(--off)'} strokeWidth={unit * 0.5} />
            <text className="rp-label" x={p.x} y={p.y - unit * 4.4} fontSize={unit * 3} textAnchor="middle">{cfg.name.toLowerCase()}</text>
          </g>
        )
      })}
      <defs><filter id={blur} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation={unit * 3} /></filter></defs>
    </svg>
  )
}
