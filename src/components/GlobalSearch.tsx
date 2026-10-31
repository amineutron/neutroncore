import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import './resume/resume.css'
import { getFavs, subscribeFavs, type Command } from '../lib/palette'
import { commandesTrouvees, grouper, hitsEnCommandes, MIN_Q, problemes, SOURCES, surligner } from '../lib/recherche'
import { useFiltres, useSearch, useSearchActions } from './recherche/useSearch'

type Row = { cmd: Command & { detail?: string }; group: string }

function Marked({ text, q }: { text: string; q: string }) {
  return <>{surligner(text, q).map((m, i) => (m.hit ? <mark key={i}>{m.t}</mark> : <span key={i}>{m.t}</span>))}</>
}

// Barre de recherche globale : films/séries, sessions Claude, notifications, projets, docs CLAUDE.md,
// automatisations et commandes de la palette. Filtres par source retenus ; une source lente est signalée
// sans retarder les autres. Flèches + Entrée comme la palette.
export function GlobalSearch({ commands, openNotifs, onClose }: { commands: Command[]; openNotifs: () => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const [actives, toggle] = useFiltres()
  const favs = useSyncExternalStore(subscribeFavs, getFavs)
  const { data, loading, error } = useSearch(query, actives)
  const { actions, ecrans } = useSearchActions(commands, openNotifs)
  const list = useRef<HTMLDivElement>(null)

  const rows = useMemo<Row[]>(() => {
    const cmds = commandesTrouvees(commands, query, favs).map((cmd) => ({ cmd, group: 'commandes' }))
    const hits = data ? hitsEnCommandes(data.resultats, ecrans, actions, data.sources) : []
    // regroupés comme grouper() : le groupe du meilleur résultat d'abord
    const ordre = grouper(data?.resultats ?? [], data?.sources).map((g) => g.label)
    const byGroup = [...hits].sort((a, b) => ordre.indexOf(a.group) - ordre.indexOf(b.group))
    return [...cmds, ...byGroup.map((cmd) => ({ cmd, group: cmd.group }))]
  }, [commands, query, favs, data, ecrans, actions])

  useEffect(() => { setSel(0) }, [query, data])
  useEffect(() => { list.current?.querySelector('.pl-row.sel')?.scrollIntoView({ block: 'nearest' }) }, [sel])
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    return () => { before?.focus?.() }
  }, [])

  const launch = (r: Row) => { onClose(); void r.cmd.run() }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && e.target instanceof HTMLInputElement && rows[sel]) { e.preventDefault(); launch(rows[sel]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }
  const q = query.trim()
  const pbs = data ? problemes(data.sources) : []

  return (
    <div className="pre-modal nc-palette" onClick={onClose}>
      <div className="inner gs" role="dialog" aria-modal="true" aria-label="Recherche globale" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="pl-input">
          <input autoFocus value={query} placeholder="chercher un film, une session, une note, une commande…" aria-label="Rechercher partout"
            onChange={(e) => setQuery(e.target.value)} />
          <span className="x" onClick={onClose}>échap</span>
        </div>
        <div className="gs-filters" role="group" aria-label="Sources">
          {SOURCES.map((s) => (
            <button key={s.id} type="button" className={`gs-chip ${actives.includes(s.id) ? 'on' : ''}`} aria-pressed={actives.includes(s.id)} onClick={() => toggle(s.id)}>{s.label}</button>
          ))}
        </div>
        <div className="pl-list" ref={list} role="listbox">
          {rows.map((r, i) => (
            <div key={r.cmd.id} role="option" aria-selected={i === sel} className={`pl-row gs-row ${i === sel ? 'sel' : ''}`}
              onMouseMove={() => setSel(i)} onClick={() => launch(r)}>
              <span className="pl-group">{r.group}</span>
              <span className="pl-label"><Marked text={r.cmd.label} q={q} />{r.cmd.detail && <small className="gs-detail"><Marked text={r.cmd.detail} q={q} /></small>}</span>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="pl-empty">
              {q.length < MIN_Q ? `tape au moins ${MIN_Q} lettres` : loading ? 'recherche…' : error ? `recherche indisponible (${error})` : 'aucun résultat'}
            </div>
          )}
        </div>
        <div className="pl-foot">
          <span>↑↓ choisir</span><span>entrée ouvrir</span>
          {loading && rows.length > 0 && <span>recherche en cours…</span>}
          {pbs.map((p) => <span key={p} className="gs-warn">{p}</span>)}
        </div>
      </div>
    </div>
  )
}
