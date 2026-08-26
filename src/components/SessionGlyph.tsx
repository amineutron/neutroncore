import { Mascot } from './Mascot'
import { Icon } from '../lib/icons'
import type { GlyphState, SessionMeta } from '../lib/sessions'
import { glyph as letters } from '../lib/sessions'

// Glyphe d'une session : lettres du dossier (défaut), mascotte ASCII animée
// (meta.icon = "mascot:<kind>:<name>") ou icône SVG ("icon:<id>"), sur un
// fond choisi (meta.icon_bg) ou teinté par la couleur d'accent de la fiche.

export function SessionGlyph({ meta, fallback, tone, state, size = 36 }: {
  meta: SessionMeta; fallback: string; tone?: 'wait' | 'busy' | 'idle'; state?: GlyphState; size?: number
}) {
  const icon = meta.icon ?? ''
  const style = meta.icon_bg ? { background: meta.icon_bg, borderColor: meta.icon_bg, width: size, height: size } : { width: size, height: size }
  if (icon.startsWith('mascot:')) {
    const [, kind, name] = icon.split(':')
    const st: GlyphState = state ?? (tone === 'busy' ? 'busy' : tone === 'wait' ? 'err' : 'idle')
    return (
      <span className="glyph glyph-mascot" style={style}>
        <Mascot kind={kind as 'fast' | 'slow'} name={name} state={st} size={Math.round(size / 6.5)} />
      </span>
    )
  }
  if (icon.startsWith('icon:')) {
    return <span className="glyph" style={style}><Icon id={icon.slice(5)} size={Math.round(size * 0.55)} /></span>
  }
  return <span className="glyph" style={style}>{letters(fallback)}</span>
}
