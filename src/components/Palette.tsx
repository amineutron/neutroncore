import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getFavs, rank, setFavs, subscribeFavs, toggleFav, type Command } from '../lib/palette'

const MAX_ROWS = 60

// Palette de commandes (Ctrl+K) : chercher, flèches + Entrée pour lancer,
// étoile (ou Ctrl+D) pour épingler une commande en favori.
export function Palette({ commands, loading, onRun, onClose }: {
  commands: Command[]; loading: boolean; onRun: (c: Command) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const favs = useSyncExternalStore(subscribeFavs, getFavs)
  const list = useRef<HTMLDivElement>(null)
  // dernière position réelle du pointeur : le défilement au clavier émet des mousemove sans déplacement
  const mouse = useRef({ x: -1, y: -1 })
  // le focus revient à l'élément qui l'avait avant l'ouverture
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    return () => { before?.focus?.() }
  }, [])
  const rows = useMemo(() => rank(commands, query, favs).slice(0, MAX_ROWS), [commands, query, favs])
  const current = rows[Math.min(sel, rows.length - 1)]

  useEffect(() => { setSel(0) }, [query])
  useEffect(() => {
    list.current?.querySelector('.pl-row.sel')?.scrollIntoView({ block: 'nearest' })
  }, [sel, rows.length])

  const launch = (c: Command) => { onClose(); onRun(c) }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing) return
    // Entrée sur un bouton (étoile, échap) garde son rôle de bouton
    if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && current) { e.preventDefault(); launch(current) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key.toLowerCase() === 'd' && (e.ctrlKey || e.metaKey) && current) {
      e.preventDefault(); setFavs(toggleFav(favs, current.id))
    }
  }

  return (
    <div className="pre-modal nc-palette" onClick={onClose}>
      <div className="inner" role="dialog" aria-modal="true" aria-label="Palette de commandes"
        onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="pl-input">
          <input autoFocus value={query} placeholder="aller à, lancer, allumer…" aria-label="Chercher une commande"
            onChange={(e) => setQuery(e.target.value)} />
          <span className="x" onClick={onClose}>échap</span>
        </div>
        <div className="pl-list" ref={list} role="listbox">
          {rows.map((c, i) => {
            const fav = favs.includes(c.id)
            return (
              <div key={c.id} role="option" aria-selected={c === current} className={`pl-row ${c === current ? 'sel' : ''}`}
                onMouseMove={(e) => {
                  if (e.clientX === mouse.current.x && e.clientY === mouse.current.y) return
                  mouse.current = { x: e.clientX, y: e.clientY }
                  setSel(i)
                }}
                onClick={() => launch(c)}>
                <span className="pl-group">{c.group}</span>
                <span className="pl-label">{c.label}</span>
                <button className={`pl-star ${fav ? 'on' : ''}`} aria-pressed={fav}
                  aria-label={fav ? `Retirer ${c.label} des favoris` : `Ajouter ${c.label} aux favoris`}
                  onClick={(e) => { e.stopPropagation(); setFavs(toggleFav(favs, c.id)) }}>{fav ? '★' : '☆'}</button>
              </div>
            )
          })}
          {rows.length === 0 && <div className="pl-empty">{loading ? 'chargement…' : 'aucune commande ne correspond'}</div>}
        </div>
        <div className="pl-foot">
          <span>↑↓ choisir</span><span>entrée lancer</span><span>ctrl+d favori</span>
          {loading && rows.length > 0 && <span>scènes et favoris en cours de chargement…</span>}
        </div>
      </div>
    </div>
  )
}
