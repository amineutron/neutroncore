import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from '../lib/color'

// Nuancier : colore toute la pièce d'un geste. Canevas saturation × luminosité,
// curseur de teinte, code hexa éditable et les dernières couleurs appliquées.

const RECENT_STORAGE_SLOT = 'neutroncore_recent_colors'
const RECENT_MAX = 8
const POP_W = 300
const START: Hsv = { h: 36, s: 0.52, v: 0.96 } // ambre du branding

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_STORAGE_SLOT) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && normalizeHex(x) === x) : []
  } catch { return [] }
}
function saveRecent(list: string[]) {
  try { localStorage.setItem(RECENT_STORAGE_SLOT, JSON.stringify(list)) } catch { /* stockage indisponible : sans mémoire */ }
}

type Props = { disabled?: boolean; onPick: (hex: string, name: string) => void }

export function ColorPalette({ disabled, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [hsv, setHsv] = useState<Hsv>(START)
  const [hexText, setHexText] = useState(hsvToHex(START))
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const [at, setAt] = useState<{ top: number; left: number; maxH: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const hex = hsvToHex(hsv)
  const typed = normalizeHex(hexText)

  const setColor = (next: Hsv) => { setHsv(next); setHexText(hsvToHex(next)) }

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

  // glisser dans le canevas : x = saturation, y = luminosité (haut = clair)
  function fromPointer(e: React.PointerEvent) {
    const r = area.current?.getBoundingClientRect()
    if (!r) return
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    setColor({ ...hsv, s, v })
  }
  function onAreaKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 0.1 : 0.02
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (!d[e.key]) return
    e.preventDefault()
    const [ds, dv] = d[e.key]
    setColor({ ...hsv, s: Math.min(1, Math.max(0, hsv.s + ds)), v: Math.min(1, Math.max(0, hsv.v + dv)) })
  }

  function apply(color: string) {
    const next = [color, ...recent.filter((c) => c !== color)].slice(0, RECENT_MAX)
    setRecent(next); saveRecent(next)
    setOpen(false)
    onPick(color, color)
  }

  return (
    <div className="palette" ref={box}>
      <button type="button" className="btn sm palette-btn" disabled={disabled} aria-expanded={open} onClick={toggle}>
        <span className="palette-ico" aria-hidden />couleur
      </button>
      {open && at && createPortal(
        <div className="palette-pop" role="dialog" aria-label="Nuancier" ref={pop}
          style={{ top: at.top, left: at.left, maxHeight: at.maxH, ['--hue' as string]: `hsl(${hsv.h} 100% 50%)` }}>
          <div ref={area} className="cv-area" role="slider" tabIndex={0} aria-label="Saturation et luminosité"
            aria-valuetext={hex}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); fromPointer(e) }}
            onPointerMove={(e) => { if (e.buttons) fromPointer(e) }}
            onKeyDown={onAreaKey}>
            <span className="cv-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
          </div>
          <input type="range" className="cv-hue" min={0} max={359} step={1} value={Math.round(hsv.h)}
            aria-label="Teinte" onChange={(e) => setColor({ ...hsv, h: Number(e.target.value) })} />
          <div className="palette-custom">
            <span className="palette-dot" style={{ background: typed ?? hex }} />
            <input type="text" className={`palette-hex ${typed ? '' : 'bad'}`} value={hexText} maxLength={7}
              spellCheck={false} aria-label="Code hexa"
              onChange={(e) => {
                setHexText(e.target.value)
                const next = hexToHsv(e.target.value)
                if (next) setHsv(next.s === 0 ? { ...next, h: hsv.h } : next) // un gris garde la teinte choisie
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && typed) apply(typed) }} />
            <button type="button" className="btn sm solid" disabled={!typed} onClick={() => typed && apply(typed)}>appliquer</button>
          </div>
          {recent.length > 0 && (
            <div className="palette-recent">
              <span>récentes</span>
              {recent.map((c) => (
                <button key={c} type="button" className="palette-rsw" title={c} aria-label={`réappliquer ${c}`}
                  style={{ background: c }} onClick={() => { const v = hexToHsv(c); if (v) setColor(v); apply(c) }} />
              ))}
            </div>
          )}
          <p className="palette-note">Toute la pièce prend la couleur ; une scène ou hue beat la remplace ensuite.</p>
        </div>,
        document.body,
      )}
    </div>
  )
}
