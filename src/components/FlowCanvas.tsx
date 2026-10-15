import type { Flow, FlowNode } from '../lib/automations'

const W = 184, H = 66, GAP_X = 46, GAP_Y = 26, PAD = 10
const x = (n: FlowNode) => PAD + n.col * (W + GAP_X)
const y = (n: FlowNode) => PAD + n.row * (H + GAP_Y)

// Diagramme d'une automatisation, de gauche à droite : nœuds en HTML posés sur
// une grille, liens en SVG dessous. `results` colore les nœuds d'après un passage.
export function FlowCanvas({ flow, selected, results, onSelect }: {
  flow: Flow; selected?: string | null; results?: Record<string, 'ok' | 'fail' | 'idle' | 'off' | null>
  onSelect?: (node: FlowNode) => void
}) {
  const byId = Object.fromEntries(flow.nodes.map((n) => [n.id, n]))
  const width = PAD * 2 + flow.cols * W + (flow.cols - 1) * GAP_X
  const height = PAD * 2 + flow.rows * H + (flow.rows - 1) * GAP_Y
  return (
    <div className="fl-scroll">
      <div className="fl" style={{ width, height }}>
        <svg className="fl-edges" width={width} height={height} aria-hidden="true">
          {flow.edges.map((e) => {
            const a = byId[e.from], b = byId[e.to]
            if (!a || !b) return null
            const x1 = x(a) + W, y1 = y(a) + H / 2, x2 = x(b), y2 = y(b) + H / 2
            // sortie « faux » : part du bas de la porte, pour se lire comme une seconde sortie
            const down = b.row > a.row
            const sx = down ? x(a) + W / 2 : x1, sy = down ? y(a) + H : y1
            const d = down ? `M${sx},${sy} C${sx},${y2} ${x2 - GAP_X},${y2} ${x2},${y2}` : `M${sx},${sy} C${sx + GAP_X / 2},${sy} ${x2 - GAP_X / 2},${y2} ${x2},${y2}`
            const off = results && (results[e.to] === 'off' || results[e.from] === 'off')
            return (
              <g key={`${e.from}>${e.to}`} className={off ? 'off' : ''}>
                <path d={d} />
                {e.label && <text x={down ? sx + 8 : (sx + x2) / 2} y={down ? sy + 16 : sy - 6} textAnchor={down ? 'start' : 'middle'}>{e.label}</text>}
              </g>
            )
          })}
        </svg>
        {flow.nodes.map((n) => {
          const add = n.kind.startsWith('add')
          const cls = `fl-node ${n.kind} ${add ? 'add' : ''} ${selected === n.id ? 'sel' : ''} ${results?.[n.id] ?? ''}`
          const style = { left: x(n), top: y(n), width: W, height: H }
          const body = <><b>{n.title}</b><span>{n.text}</span></>
          return onSelect
            ? <button key={n.id} className={cls} style={style} aria-pressed={selected === n.id} title={n.text} onClick={() => onSelect(n)}>{body}</button>
            : <div key={n.id} className={cls} style={style} title={n.text} tabIndex={0} aria-label={`${n.title} : ${n.text}`}>{body}</div>
        })}
      </div>
    </div>
  )
}
