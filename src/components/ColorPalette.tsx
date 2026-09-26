import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Nuancier : colore toute la pièce d'un geste. Tons chauds pour le soir, froids
// pour la concentration, quelques saturés pour l'ambiance, et une couleur libre.
export const SWATCHES: { name: string; hex: string }[] = [
  { name: 'bougie', hex: '#ff9a3c' }, { name: 'ambre', hex: '#f6c177' }, { name: 'blanc chaud', hex: '#ffe2b8' },
  { name: 'blanc', hex: '#fff6ec' }, { name: 'blanc froid', hex: '#dff0ff' }, { name: 'rose', hex: '#eb6f92' },
  { name: 'corail', hex: '#ff6b5a' }, { name: 'rouge', hex: '#e0302e' }, { name: 'magenta', hex: '#c03aa8' },
  { name: 'violet', hex: '#7d4ce0' }, { name: 'indigo', hex: '#3b4ce0' }, { name: 'bleu', hex: '#2f8ff0' },
  { name: 'cyan', hex: '#2ed1d9' }, { name: 'menthe', hex: '#3ddc97' }, { name: 'vert', hex: '#4caf50' },
  { name: 'citron', hex: '#e5e04a' },
]

type Props = { disabled?: boolean; onPick: (hex: string, name: string) => void }

export function ColorPalette({ disabled, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('#f6c177')
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  // le nuancier est rendu dans <body> (portail) : une carte qui masque ce qui
  // dépasse (animation de dépliage) ne peut plus le couper
  function toggle() {
    if (open) { setOpen(false); return }
    const r = box.current?.getBoundingClientRect()
    if (r) setAt({ top: r.bottom + 8, left: Math.min(r.left, window.innerWidth - 252) })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (!box.current?.contains(t) && !pop.current?.contains(t)) setOpen(false)
    }
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close)
    }
  }, [open])

  const pick = (hex: string, name: string) => { setOpen(false); onPick(hex, name) }

  return (
    <div className="palette" ref={box}>
      <button type="button" className="btn sm palette-btn" disabled={disabled} aria-expanded={open} onClick={toggle}>
        <span className="palette-ico" aria-hidden />couleur
      </button>
      {open && at && createPortal(
        <div className="palette-pop" role="dialog" aria-label="Nuancier" ref={pop} style={{ top: at.top, left: at.left }}>
          <div className="palette-grid">
            {SWATCHES.map((s) => (
              <button key={s.hex} type="button" className="palette-sw" title={s.name} aria-label={s.name}
                style={{ background: s.hex, boxShadow: `0 0 12px ${s.hex}55` }} onClick={() => pick(s.hex, s.name)} />
            ))}
          </div>
          <label className="palette-custom">
            <input type="color" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Couleur libre" />
            <span>autre couleur</span>
            <button type="button" className="btn sm solid" onClick={() => pick(custom, custom)}>appliquer</button>
          </label>
          <p className="palette-note">Toute la pièce prend la couleur ; une scène ou hue beat la remplace ensuite.</p>
        </div>,
        document.body,
      )}
    </div>
  )
}
