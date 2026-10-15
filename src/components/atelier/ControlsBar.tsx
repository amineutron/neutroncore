import { useState } from 'react'
import { NATURES, controlValue, controlsSummary, filterControls, piecesOfControl, type Controle, type Decompte } from '../../lib/atelier'
import { lireControle } from '../../lib/atelierControle'

const SHOWN = 80     // lignes affichées d'un coup : la liste complète peut dépasser 500 contrôles

// Un contrôle en échec, dit avec des mots : ce qui est vérifié, l'écart, ce que ça implique.
// Le texte brut du rapport reste accessible, replié.
function Echec({ c, pieces, onFocus, onAsk }: { c: Controle; pieces: string[]; onFocus: (noms: string[]) => void; onAsk: (c: Controle, liees: string[]) => void }) {
  const l = lireControle(c)
  const linked = piecesOfControl(c.nom, pieces)
  return (
    <article className="at-echec">
      <h4>{l.titre}</h4>
      <p className="at-echec-phrase">{l.phrase}</p>
      {l.ratio !== null && <div className="at-jauge" role="img" aria-label={`${Math.round(l.ratio * 100)} % de ce qui est demandé`}><i style={{ width: `${Math.round(l.ratio * 100)}%` }} /></div>}
      {l.consequence && <p>{l.consequence}</p>}
      <div className="at-row">
        {linked.length > 0 && <button type="button" className="btn sm" onClick={() => onFocus(linked)} title={linked.join(', ')}>voir la pièce</button>}
        <button type="button" className="btn sm" onClick={() => onAsk(c, linked)}>demander la correction</button>
      </div>
      <details>
        <summary>détail du calcul</summary>
        <ul>{l.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
        <code>{c.nom}</code> <span className="at-nature">{c.nature}</span>
      </details>
    </article>
  )
}

// Contrôles : un bandeau d'une ligne (les décomptes), qui se déploie. Les échecs viennent d'abord,
// expliqués ; la liste complète suit, filtrable.
export function ControlsBar({ controles, decompte, pieces, onFocus, onAsk }: {
  controles: Controle[]; decompte: Decompte; pieces: string[]; onFocus: (noms: string[]) => void; onAsk: (c: Controle, liees: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [nature, setNature] = useState('')
  const [tout, setTout] = useState(false)
  const [limit, setLimit] = useState(SHOWN)
  const s = controlsSummary(decompte)
  const echecs = open ? controles.filter((c) => !c.ok && c.nature !== 'indicateur') : []
  const list = open && tout ? filterControls(controles, { q, nature, echecs: false }) : []
  return (
    <div className={`at-controls ${open ? 'open' : ''}`}>
      <button type="button" className="at-controls-bar" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>contrôles</b>
        {s.total === 0 ? <span className="at-faint">aucun rapport</span> : s.parNature.map((n) => (
          <span key={n.cle} className={`at-count ${n.ok === n.total ? 'ok' : 'ko'}`} title={NATURES.find((x) => x.cle === n.cle)?.aide}>{n.label} <i>{n.ok}/{n.total}</i></span>
        ))}
        {s.echecs > 0 && <span className="chip crit">{s.echecs} à corriger</span>}
        <span className="at-chevron" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="at-controls-body">
          {echecs.length === 0
            ? <p className="at-faint">{s.total === 0 ? 'Aucun rapport de contrôle pour cette itération.' : 'Tous les contrôles passent.'}</p>
            : <div className="at-echecs">{echecs.map((c) => <Echec key={c.nom} c={c} pieces={pieces} onFocus={onFocus} onAsk={onAsk} />)}</div>}
          <p className="au-note">Seul le décompte « géométrie » est mesuré sur les formes. « calcul » est une première estimation de solidité, pas une simulation.</p>
          <button type="button" className="btn sm" aria-expanded={tout} onClick={() => setTout(!tout)}>{tout ? 'replier la liste complète' : `voir les ${controles.length} contrôles`}</button>
          {tout && (
            <>
              <div className="at-row">
                <input className="bp-text" value={q} placeholder="chercher un contrôle…" aria-label="Chercher un contrôle" onChange={(e) => { setQ(e.target.value); setLimit(SHOWN) }} />
                <select value={nature} aria-label="Nature" onChange={(e) => { setNature(e.target.value); setLimit(SHOWN) }}>
                  <option value="">toutes les natures</option>{NATURES.map((n) => <option key={n.cle} value={n.cle}>{n.label}</option>)}
                </select>
              </div>
              <div className="at-controls-list">
                {list.slice(0, limit).map((c) => {
                  const linked = piecesOfControl(c.nom, pieces)
                  const l = lireControle(c)
                  return (
                    <div key={c.nom} className={`at-control ${c.ok ? '' : 'ko'}`}>
                      <span className={`at-dot ${c.ok ? 'ok' : 'ko'}`} aria-label={c.ok ? 'passé' : 'en échec'} />
                      <div className="at-control-main">
                        <b>{l.titre}</b>
                        <p>{c.ok ? l.phrase : `${l.phrase} ${l.consequence}`}</p>
                        <code>{c.nom}</code>
                      </div>
                      <span className="at-control-val" title="mesure / limite">{controlValue(c)}</span>
                      <span className="at-nature">{c.nature}</span>
                      {linked.length > 0 && <button type="button" className="btn sm" onClick={() => onFocus(linked)} title={linked.join(', ')}>voir</button>}
                    </div>
                  )
                })}
                {list.length === 0 && <p className="at-faint">Aucun contrôle ne correspond.</p>}
                {list.length > limit && <button type="button" className="btn sm" onClick={() => setLimit(limit + SHOWN)}>afficher la suite ({list.length - limit})</button>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
