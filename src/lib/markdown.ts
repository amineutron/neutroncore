// Analyse du texte renvoyé par Claude (logique pure, testée) : on le découpe en blocs que
// l'interface sait rendre proprement sur un téléphone comme sur un écran large.
// Volontairement tolérant : un texte mal formé reste lisible, jamais avalé.

export type Align = 'left' | 'center' | 'right'
export type ListItem = { text: string; depth: number; marker: string; checked?: boolean }
export type Block =
  | { kind: 'code'; lang: string; body: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }
  | { kind: 'table'; head: string[]; align: Align[]; rows: string[][] }
  | { kind: 'ascii'; body: string }          // schéma, arborescence, cadre : chasse fixe, espaces gardés
  | { kind: 'quote'; text: string }
  | { kind: 'rule' }
  | { kind: 'para'; text: string }

const FENCE = /^\s{0,3}(```+|~~~+)\s*([\w+#.-]*)[^\n]*$/
// traits de boîte, blocs, formes géométriques, flèches : un schéma, pas une phrase
const DRAWING = /[─-╿▀-▟■-◿←-⇿⠀-⣿]/
const BORDER = /^\s*[+|][-=+|\s]{3,}[+|]?\s*$/            // +-----+----+
const TREE = /^\s*(?:[|`+]\s{0,3})*[|`+\\]--+\s/            // |-- fichier   `-- fichier
const ARROW = /-{2,}>|<-{2,}|={2,}>|<={2,}/                          // A --> B
const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/
const LIST = /^(\s*)([-*+•]|\d{1,3}[.)])\s+(.*)$/

export function isDrawingLine(line: string): boolean {
  if (!line.trim()) return false
  if (DRAWING.test(line) || BORDER.test(line) || TREE.test(line)) return true
  // une flèche fait un schéma dans une ligne courte (« A --> B »), pas dans une phrase qui en contient une
  if (ARROW.test(line) && line.trim().split(/\s+/).length <= 7) return true
  // ligne faite surtout de symboles (====, ----->, /\_/\) : au moins 6 caractères, plus de la moitié hors lettres et chiffres
  const t = line.trim()
  if (t.length >= 6 && !/^[-*+]\s/.test(t)) {
    const symbols = [...t].filter((c) => /[^\p{L}\p{N}\s.,;:!?'"()«»’%€]/u.test(c)).length
    if (symbols / t.length > 0.5) return true
  }
  return false
}

/** Cellules d'une ligne de tableau : `| a | b |` ou `a | b`. Un `\|` reste dans sa cellule. */
export function splitRow(line: string): string[] {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'))
}

function alignOf(cell: string): Align {
  const c = cell.trim()
  return c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'
}

function isRow(line: string): boolean {
  return line.includes('|') && splitRow(line).length >= 2
}

export function parse(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')
  const out: Block[] = []
  let para: string[] = []
  const flush = () => { if (para.length) { out.push({ kind: 'para', text: para.join('\n') }); para = [] } }
  let i = 0
  while (i < lines.length) {
    const line = lines[i].replace(/\s+$/, '')

    const fence = line.match(FENCE)
    if (fence) {                                   // bloc de code : jusqu'à la clôture, ou la fin (réponse coupée en plein bloc)
      flush()
      const body: string[] = []
      const mark = fence[1][0].repeat(3)
      i++
      while (i < lines.length && !lines[i].trim().startsWith(mark)) body.push(lines[i++])
      i++
      out.push({ kind: 'code', lang: fence[2] || '', body: body.join('\n').replace(/\n+$/, '') })
      continue
    }
    if (!line.trim()) { flush(); i++; continue }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?$/)
    if (heading) { flush(); out.push({ kind: 'heading', level: heading[1].length, text: heading[2] }); i++; continue }
    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) { flush(); out.push({ kind: 'rule' }); i++; continue }

    // tableau : une ligne d'en-tête, une ligne de tirets au même nombre de colonnes, puis les lignes
    if (isRow(line) && i + 1 < lines.length && SEPARATOR.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line), sep = splitRow(lines[i + 1])
      if (head.length === sep.length) {
        flush()
        const rows: string[][] = []
        i += 2
        while (i < lines.length && lines[i].trim() && lines[i].includes('|') && !SEPARATOR.test(lines[i])) {
          const cells = splitRow(lines[i++])
          rows.push(head.map((_, k) => cells[k] ?? ''))          // ligne trop courte complétée, trop longue coupée
        }
        out.push({ kind: 'table', head, align: sep.map(alignOf), rows })
        continue
      }
    }

    if (isDrawingLine(line)) {                     // schéma : on prend les lignes voisines, texte compris entre deux traits
      flush()
      const body = [line]
      i++
      while (i < lines.length) {
        const next = lines[i].replace(/\s+$/, '')
        const ahead = lines.slice(i + 1, i + 3).some(isDrawingLine)
        if (isDrawingLine(next) || (ahead && (next.trim() === '' ? lines[i + 1] !== undefined && isDrawingLine(lines[i + 1]) : true))) { body.push(next); i++ } else break
      }
      out.push({ kind: 'ascii', body: body.join('\n') })
      continue
    }

    if (/^\s{0,3}>/.test(line)) {
      flush()
      const quote: string[] = []
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) quote.push(lines[i++].replace(/^\s{0,3}>\s?/, ''))
      out.push({ kind: 'quote', text: quote.join('\n') })
      continue
    }

    const first = line.match(LIST)
    if (first) {
      flush()
      const items: ListItem[] = []
      const indents: number[] = []
      while (i < lines.length) {
        const m = lines[i].match(LIST)
        if (m) {
          const box = m[3].match(/^\[([ xX])\]\s+(.*)$/)
          indents.push(m[1].length)
          items.push({ text: box ? box[2] : m[3], depth: 0, marker: m[2], ...(box ? { checked: box[1] !== ' ' } : {}) })
          i++
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length && !isDrawingLine(lines[i])) {
          items[items.length - 1].text += `\n${lines[i].trim()}`       // suite d'un élément, renvoyée à la ligne
          i++
        } else if (!lines[i].trim() && i + 1 < lines.length && LIST.test(lines[i + 1])) {
          i++                                                           // ligne vide entre deux éléments : même liste
        } else break
      }
      // profondeur = rang du retrait parmi ceux de la liste (2, 3 ou 4 espaces par niveau : peu importe)
      const levels = [...new Set(indents)].sort((a, b) => a - b)
      out.push({ kind: 'list', ordered: /\d/.test(first[2]), items: items.map((it, k) => ({ ...it, depth: levels.indexOf(indents[k]) })) })
      continue
    }

    para.push(line)
    i++
  }
  flush()
  return out
}

export type Span = { kind: 'text' | 'code' | 'bold' | 'italic' | 'strike'; text: string } | { kind: 'link'; text: string; href: string }

/** Mise en forme dans une ligne. Un lien n'est cliquable que s'il est en http(s) : pas de `javascript:`. */
export function inline(text: string): Span[] {
  const out: Span[] = []
  const re = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|\[([^\]\n]+)\]\(([^)\s]+)\)|(?<![\w*])\*([^*\s][^*\n]*?)\*(?![\w*])|(?<![\w_])_([^_\s][^_\n]*?)_(?![\w_])/g
  let last = 0
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) })
    if (m[2] !== undefined) out.push({ kind: 'code', text: m[2].trim() || m[2] })
    else if (m[3] ?? m[4]) out.push({ kind: 'bold', text: m[3] ?? m[4] })
    else if (m[5]) out.push({ kind: 'strike', text: m[5] })
    else if (m[6]) out.push(/^https?:\/\//i.test(m[7]) ? { kind: 'link', text: m[6], href: m[7] } : { kind: 'text', text: `${m[6]} (${m[7]})` })
    else out.push({ kind: 'italic', text: m[8] ?? m[9] })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

/** Numéro affiché d'un élément de liste : celui écrit par Claude (« 3. »), pas un compteur
 * recalculé — une proposition « 2 » doit rester « 2 » quand on y répond par son numéro. */
export function markerLabel(marker: string): string {
  return /\d/.test(marker) ? marker.replace(')', '.') : '•'
}
