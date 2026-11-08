import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { helpOf } from '../../lib/vmHelp'

// Pastille « ? » : un clic ouvre une bulle pedagogique (texte de lib/vmHelp), qui se ferme
// par Echap, clic ailleurs ou defilement.
export function Q({ k }: { k: string }) {
  const h = helpOf(k)
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return
    const r = btn.current.getBoundingClientRect()
    const { offsetWidth: w, offsetHeight: ph } = pop.current
    const x = Math.max(12, Math.min(r.left - 8, window.innerWidth - w - 12))
    let y = r.bottom + 8
    if (y + ph > window.innerHeight - 12) y = Math.max(12, r.top - ph - 8)
    setAt({ x, y })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  if (!h) return null
  return (
    <>
      <button ref={btn} type="button" className={`vh-q${open ? ' on' : ''}`} aria-label={`aide : ${h.t}`} aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>?</button>
      {open && createPortal(
        <div ref={pop} className="vh-pop" role="tooltip" style={at ? { left: at.x, top: at.y } : { left: -9999, top: 0 }}>
          <h4>{h.t}</h4>
          {h.p.map((t, i) => <p key={i}>{t}</p>)}
          {h.table && (
            <table>
              <thead><tr>{h.table.head.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{h.table.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? 'mono' : undefined}>{c}</td>)}</tr>)}</tbody>
            </table>
          )}
        </div>, document.body)}
    </>
  )
}

/** Fenetre modale generique : focus pris a l'ouverture et rendu a la fermeture, Tab reste dans la fenetre,
 *  Echap ferme (sauf si une bulle d'aide est ouverte : elle se ferme d'abord), le fond ferme au mousedown
 *  (un glisser de selection relache sur le fond ne perd pas la saisie). */
export function Modal({ title, sub, onClose, children, footer }: {
  title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; footer: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)   // les dialogues passent une fonction neuve a chaque rendu : l'effet ne doit pas se rejouer
  close.current = onClose
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const first = box.current?.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=radio]),select,textarea')
    ;(first ?? box.current)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (!document.querySelector('.vh-pop')) close.current(); return }
      if (e.key !== 'Tab' || !box.current) return
      const f = [...box.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[href]')]
      if (!f.length) return
      const i = f.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.() }
  }, [])
  return createPortal(
    <div className="vh-modal vh" onMouseDown={(e) => { if (e.target === e.currentTarget) close.current() }}>
      <div ref={box} tabIndex={-1} className="vh-dlg" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2>{sub && <p>{sub}</p>}</header>
        <div className="mb">{children}</div>
        <footer>{footer}</footer>
      </div>
    </div>, document.body)
}
