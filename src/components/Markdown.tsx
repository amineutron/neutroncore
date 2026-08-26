import type { ReactNode } from 'react'

// Rendu léger (sans dépendance) des réponses de Claude : blocs de code
// ``` séparés du texte (avec langue et copie), titres, listes, code inline,
// gras. Le but est de distinguer d'un coup d'œil commandes et explications.

type Block = { kind: 'code'; lang: string; body: string } | { kind: 'text'; body: string }

export function splitBlocks(src: string): Block[] {
  const out: Block[] = []
  const re = /```([\w+-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g
  let last = 0
  for (const m of src.matchAll(re)) {
    const idx = m.index ?? 0
    if (idx > last) out.push({ kind: 'text', body: src.slice(last, idx) })
    out.push({ kind: 'code', lang: m[1] || '', body: m[2].replace(/\n$/, '') })
    last = idx + m[0].length
  }
  if (last < src.length) out.push({ kind: 'text', body: src.slice(last) })
  return out.filter((b) => b.body.trim())
}

function inline(text: string, key: string): ReactNode[] {
  // `code` et **gras**
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) return <code key={`${key}-${i}`} className="md-code">{p.slice(1, -1)}</code>
    if (p.startsWith('**') && p.endsWith('**')) return <b key={`${key}-${i}`}>{p.slice(2, -2)}</b>
    return p
  })
}

function TextBlock({ body }: { body: string }) {
  const lines = body.replace(/^\n+|\n+$/g, '').split('\n')
  const nodes: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      nodes.push(<ul key={`ul-${nodes.length}`} className="md-list">{list.map((l, i) => <li key={i}>{inline(l, `li${i}`)}</li>)}</ul>)
      list = []
    }
  }
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '')
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    const li = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.*)$/)
    if (h) { flush(); nodes.push(<div key={i} className="md-h">{inline(h[2], `h${i}`)}</div>) }
    else if (li) list.push(li[1])
    else if (!line.trim()) { flush(); nodes.push(<div key={i} className="md-gap" />) }
    else { flush(); nodes.push(<div key={i}>{inline(line, `p${i}`)}</div>) }
  })
  flush()
  return <div className="md-text">{nodes}</div>
}

function copy(text: string) {
  try { navigator.clipboard?.writeText(text) } catch { /* presse-papiers indisponible */ }
}

export function Markdown({ text }: { text: string }) {
  return (
    <>
      {splitBlocks(text).map((b, i) => b.kind === 'code' ? (
        <div key={i} className="md-pre">
          <div className="md-pre-bar">
            <span>{b.lang || 'commande'}</span>
            <button type="button" onClick={() => copy(b.body)}>copier</button>
          </div>
          <pre>{b.body}</pre>
        </div>
      ) : <TextBlock key={i} body={b.body} />)}
    </>
  )
}
