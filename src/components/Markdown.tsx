import type { ReactNode } from 'react'
import { inline, markerLabel, parse, type Block } from '../lib/markdown'

// Rendu des réponses de Claude, sans dépendance. L'analyse est dans lib/markdown.ts (testée) ;
// ici on ne fait que poser les blocs : code et schémas en chasse fixe défilant de côté,
// tableaux dans un cadre défilant, listes avec leurs numéros d'origine.

function Inline({ text }: { text: string }): ReactNode {
  return inline(text).map((s, i) => {
    if (s.kind === 'code') return <code key={i} className="md-code">{s.text}</code>
    if (s.kind === 'bold') return <b key={i}>{s.text}</b>
    if (s.kind === 'italic') return <i key={i}>{s.text}</i>
    if (s.kind === 'strike') return <s key={i}>{s.text}</s>
    if (s.kind === 'link') return <a key={i} className="md-link" href={s.href} target="_blank" rel="noreferrer noopener">{s.text}</a>
    return s.text
  })
}

/** Texte sur plusieurs lignes : chaque retour à la ligne est gardé. */
function Lines({ text }: { text: string }) {
  return text.split('\n').map((l, i) => <span key={i}>{i > 0 && <br />}<Inline text={l} /></span>)
}

function copy(text: string) {
  try { void navigator.clipboard?.writeText(text) } catch { /* presse-papiers indisponible */ }
}

function Pre({ label, body }: { label: string; body: string }) {
  return (
    <div className="md-pre">
      <div className="md-pre-bar"><span>{label}</span><button type="button" onClick={() => copy(body)}>copier</button></div>
      <pre>{body}</pre>
    </div>
  )
}

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case 'code': return <Pre label={b.lang || 'commande'} body={b.body} />
    case 'ascii': return <Pre label="schéma" body={b.body} />
    case 'heading': return <div className={`md-h md-h${Math.min(b.level, 3)}`} role="heading" aria-level={Math.min(b.level + 2, 6)}><Inline text={b.text} /></div>
    case 'rule': return <hr className="md-rule" />
    case 'quote': return <blockquote className="md-quote"><Lines text={b.text} /></blockquote>
    case 'para': return <p className="md-p"><Lines text={b.text} /></p>
    case 'list': return (
      <div className="md-list" role="list">
        {b.items.map((it, i) => (
          <div key={i} role="listitem" className={`md-li ${it.checked === true ? 'done' : ''}`} style={{ paddingLeft: it.depth * 16 }}>
            <span className="md-marker" aria-hidden={it.checked !== undefined}>{it.checked === undefined ? markerLabel(it.marker) : it.checked ? '☑' : '☐'}</span>
            <span className="md-li-text">{it.checked !== undefined && <span className="sr">{it.checked ? 'fait : ' : 'à faire : '}</span>}<Lines text={it.text} /></span>
          </div>
        ))}
      </div>
    )
    case 'table': return (
      <div className="md-table-wrap" tabIndex={0} role="region" aria-label="tableau, défile horizontalement">
        <table className="md-table">
          <thead><tr>{b.head.map((h, i) => <th key={i} style={{ textAlign: b.align[i] }}><Inline text={h} /></th>)}</tr></thead>
          <tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ textAlign: b.align[ci] }}><Inline text={c} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }
}

export function Markdown({ text }: { text: string }) {
  return <div className="md-text">{parse(text).map((b, i) => <BlockView key={i} b={b} />)}</div>
}
