import { useState, type ReactNode } from 'react'
import { HELP } from '../lib/help'

// Primitives du design system neutroncore (tokens dans styles.css)

export function Card({ title, lite, children, style, tour }: {
  title?: string; lite?: string; children: ReactNode
  style?: React.CSSProperties; tour?: string
}) {
  return (
    <div className="card" style={style} data-tour={tour}>
      {title && (
        <h3>
          {title}
          {lite && <span className="lite">{lite}</span>}
        </h3>
      )}
      {children}
    </div>
  )
}

export function Dot({ s }: { s: 'ok' | 'warn' | 'crit' | 'off' }) {
  return <span className={`dot ${s}`} />
}

export function Chip({ tone, children }: { tone?: 'gold' | 'rose' | 'ok' | 'warn' | 'crit'; children: ReactNode }) {
  return <span className={`chip ${tone ?? ''}`}>{children}</span>
}

export function Bar({ pct, tone }: { pct: number; tone?: 'ok' | 'warn' | 'crit' }) {
  return (
    <div className={`bar ${tone ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

export function Btn({ solid, danger, sm, onClick, disabled, children }: {
  solid?: boolean; danger?: boolean; sm?: boolean; onClick?: () => void; disabled?: boolean; children: ReactNode
}) {
  return (
    <button
      className={`btn ${solid ? 'solid' : ''} ${danger ? 'danger' : ''} ${sm ? 'sm' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>
}

// Panneau d'aide d'un écran (ouvert par le bouton ? du titre)
function HelpPanel({ topic, onClose }: { topic: string; onClose: () => void }) {
  const h = HELP[topic]
  if (!h) return null
  return (
    <div className="pre-modal" onClick={onClose}>
      <div className="inner help-card" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          aide — {h.title}
          <span style={{ flex: 1 }} />
          <span className="x" onClick={onClose}>fermer</span>
        </div>
        <div className="help-body">
          <p className="help-intro">{h.intro}</p>
          {h.points.map(([label, text]) => (
            <div className="help-row" key={label}>
              <span className="k">{label}</span>
              <span className="v">{text}</span>
            </div>
          ))}
          {h.tip && <p className="help-tip">astuce : {h.tip}</p>}
        </div>
      </div>
    </div>
  )
}

export function PageTitle({ title, desc, help }: { title: string; desc: string; help?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="ptitle">
        <span className="t">{title}</span>
        {help && (
          <button className="help-btn" aria-label={`Aide : ${title}`} title="en savoir plus"
            onClick={() => setOpen(true)}>?</button>
        )}
      </div>
      <div className="pdesc">{desc}</div>
      {open && help && <HelpPanel topic={help} onClose={() => setOpen(false)} />}
    </>
  )
}

// Chargement localisé : à placer DANS la zone concernée (pas plein écran)
export function Loader({ label }: { label?: string }) {
  return (
    <div className="loader-zone">
      <span className="spinner" />
      {label ?? 'chargement…'}
    </div>
  )
}

// mappe un statut service → pastille
export function serviceTone(status: string): 'ok' | 'warn' | 'crit' | 'off' {
  if (status === 'up') return 'ok'
  if (status === 'starting') return 'warn'
  if (status === 'down') return 'crit'
  return 'off'
}
