import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Nuancier : colore toute la pièce d'un geste. Rangé par familles (blancs pour la
// lumière utile, chauds pour le soir, saturés pour l'ambiance), chaque teinte avec
// son code hexa ; une couleur libre se saisit au sélecteur ou en hexa.
type Swatch = { name: string; hex: string }
export const SWATCH_GROUPS: { label: string; swatches: Swatch[] }[] = [
  { label: 'blancs', swatches: [
    { name: 'bougie', hex: '#ffb46b' }, { name: 'blanc chaud', hex: '#ffd6a5' }, { name: 'ivoire', hex: '#ffe9c9' },
    { name: 'blanc', hex: '#fff6ec' }, { name: 'lune', hex: '#eef3ff' }, { name: 'blanc froid', hex: '#dff0ff' },
  ] },
  { label: 'chauds', swatches: [
    { name: 'braise', hex: '#ff6a1a' }, { name: 'orange', hex: '#ff8c2e' }, { name: 'ambre', hex: '#f6c177' },
    { name: 'or', hex: '#ffc83d' }, { name: 'miel', hex: '#e9a23b' }, { name: 'citron', hex: '#e5e04a' },
  ] },
  { label: 'rouges et roses', swatches: [
    { name: 'rouge', hex: '#e0302e' }, { name: 'carmin', hex: '#b3122e' }, { name: 'corail', hex: '#ff6b5a' },
    { name: 'saumon', hex: '#ff9e8a' }, { name: 'rose', hex: '#eb6f92' }, { name: 'fuchsia', hex: '#ff3ea5' },
  ] },
  { label: 'violets', swatches: [
    { name: 'magenta', hex: '#c03aa8' }, { name: 'orchidée', hex: '#d17be0' }, { name: 'lavande', hex: '#b39dff' },
    { name: 'violet', hex: '#7d4ce0' }, { name: 'améthyste', hex: '#9b59d0' }, { name: 'prune', hex: '#6b2d7a' },
  ] },
  { label: 'bleus', swatches: [
    { name: 'indigo', hex: '#3b4ce0' }, { name: 'nuit', hex: '#1f3a93' }, { name: 'bleu', hex: '#2f8ff0' },
    { name: 'azur', hex: '#5ab8ff' }, { name: 'ciel', hex: '#9fd8ff' }, { name: 'cyan', hex: '#2ed1d9' },
  ] },
  { label: 'verts', swatches: [
    { name: 'turquoise', hex: '#1fc7b0' }, { name: 'menthe', hex: '#3ddc97' }, { name: 'vert', hex: '#4caf50' },
    { name: 'émeraude', hex: '#1f9e6e' }, { name: 'anis', hex: '#a8e05a' }, { name: 'sapin', hex: '#2e6b3a' },
  ] },
]
export const SWATCHES: Swatch[] = SWATCH_GROUPS.flatMap((g) => g.swatches)

const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i
/** "#ABC" / "abc" / "#aabbcc" -> "#aabbcc" ; null si ce n'est pas un code hexa. */
export function normalizeHex(v: string): string | null {
  const m = HEX_RE.exec(v.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return `#${h.toLowerCase()}`
}

const POP_W = 324

type Props = { disabled?: boolean; onPick: (hex: string, name: string) => void }

export function ColorPalette({ disabled, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('#f6c177')
  const [hexText, setHexText] = useState('#f6c177')
  const [hover, setHover] = useState<Swatch | null>(null)
  const [at, setAt] = useState<{ top: number; left: number; maxH: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const typed = normalizeHex(hexText)

  // le nuancier est rendu dans <body> (portail) : une carte qui masque ce qui
  // dépasse (animation de dépliage) ne peut plus le couper
  function toggle() {
    if (open) { setOpen(false); return }
    const r = box.current?.getBoundingClientRect()
    if (r) {
      const top = r.bottom + 8
      setAt({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8)), maxH: window.innerHeight - top - 12 })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (!box.current?.contains(t) && !pop.current?.contains(t)) setOpen(false)
    }
    // on ferme au défilement de la page, pas à celui du nuancier lui-même
    const onScroll = (e: Event) => { if (!pop.current?.contains(e.target as Node)) setOpen(false) }
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', close)
    }
  }, [open])

  const pick = (hex: string, name: string) => { setOpen(false); onPick(hex, name) }
  const pickCustom = (hex: string) => { setCustom(hex); setHexText(hex) }

  return (
    <div className="palette" ref={box}>
      <button type="button" className="btn sm palette-btn" disabled={disabled} aria-expanded={open} onClick={toggle}>
        <span className="palette-ico" aria-hidden />couleur
      </button>
      {open && at && createPortal(
        <div className="palette-pop" role="dialog" aria-label="Nuancier" ref={pop}
          style={{ top: at.top, left: at.left, maxHeight: at.maxH }}>
          <div className="palette-preview">
            <span className="palette-dot" style={{ background: hover?.hex ?? custom }} />
            <b>{hover?.name ?? 'survole une teinte'}</b>
            <code>{hover?.hex ?? ''}</code>
          </div>
          {SWATCH_GROUPS.map((g) => (
            <section key={g.label} className="palette-group">
              <h4>{g.label}</h4>
              <div className="palette-grid">
                {g.swatches.map((s) => (
                  <button key={s.hex} type="button" className="palette-sw" title={`${s.name} ${s.hex}`}
                    aria-label={`${s.name} ${s.hex}`}
                    onMouseEnter={() => setHover(s)} onFocus={() => setHover(s)}
                    onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)}
                    onClick={() => pick(s.hex, s.name)}>
                    <span className="palette-chip" style={{ background: s.hex, boxShadow: `0 0 10px ${s.hex}55` }} />
                    <code>{s.hex}</code>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <div className="palette-custom">
            <input type="color" value={custom} onChange={(e) => pickCustom(e.target.value)} aria-label="Couleur libre" />
            <input type="text" className={`palette-hex ${typed ? '' : 'bad'}`} value={hexText} maxLength={7}
              spellCheck={false} aria-label="Code hexa"
              onChange={(e) => { setHexText(e.target.value); const h = normalizeHex(e.target.value); if (h) setCustom(h) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && typed) pick(typed, typed) }} />
            <button type="button" className="btn sm solid" disabled={!typed} onClick={() => typed && pick(typed, typed)}>appliquer</button>
          </div>
          <p className="palette-note">Toute la pièce prend la couleur ; une scène ou hue beat la remplace ensuite.</p>
        </div>,
        document.body,
      )}
    </div>
  )
}
