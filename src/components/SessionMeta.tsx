import { useState } from 'react'
import { apiPut } from '../lib/api'
import type { SessionMeta } from '../lib/sessions'
import { PALETTE } from '../lib/sessions'
import { Btn } from './ui'
import { MASCOTS } from './Mascot'
import { ICON_IDS, ICONS } from '../lib/icons'
import { SessionGlyph } from './SessionGlyph'

// Fiche de personnalisation d'une session : nom, commentaire, couleur, épingle.
// Stockée côté API par sessionId (survit à la fermeture de la session).

export function SessionMetaEditor({ sessionId, meta, controllable, onSaved, onClose }: {
  sessionId: string; meta: SessionMeta; controllable: boolean
  onSaved: (meta: SessionMeta) => void; onClose: () => void
}) {
  const [alias, setAlias] = useState(meta.alias ?? '')
  const [comment, setComment] = useState(meta.comment ?? '')
  const [color, setColor] = useState(meta.color ?? '')
  const [pinned, setPinned] = useState(!!meta.pinned)
  const [icon, setIcon] = useState(meta.icon ?? '')
  const [iconBg, setIconBg] = useState(meta.icon_bg ?? '')
  const [tab, setTab] = useState<'lettres' | 'mascotte' | 'icone'>(meta.icon?.startsWith('mascot:') ? 'mascotte' : meta.icon?.startsWith('icon:') ? 'icone' : 'lettres')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setBusy(true); setErr('')
    try {
      const r = await apiPut<{ meta: SessionMeta; propagated: boolean }>(
        `/launcher/sessions/${sessionId}/meta`,
        { alias, comment, color, pinned, icon, icon_bg: iconBg },
      )
      onSaved(r.meta)
      onClose()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="cs-meta" onClick={(e) => e.stopPropagation()}>
      <label className="cs-field">
        <span>nom affiché</span>
        <input value={alias} maxLength={40} placeholder="(nom automatique)" onChange={(e) => setAlias(e.target.value)} />
      </label>
      <label className="cs-field">
        <span>commentaire (bandeau au-dessus)</span>
        <input value={comment} maxLength={200} placeholder="ex : ne pas toucher à ollama.py" onChange={(e) => setComment(e.target.value)} />
      </label>
      <div className="cs-field">
        <span>couleur</span>
        <div className="cs-palette">
          <button type="button" className={`sw none ${color === '' ? 'on' : ''}`} title="aucune" onClick={() => setColor('')}>×</button>
          {PALETTE.map((c) => (
            <button type="button" key={c} className={`sw ${color === c ? 'on' : ''}`} style={{ background: c }} title={c} onClick={() => setColor(c)} />
          ))}
          <input type="color" value={color || '#f6c177'} title="couleur libre" onChange={(e) => setColor(e.target.value)} />
        </div>
      </div>
      <div className="cs-field">
        <span>glyphe</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="cs-glyph-wrap" style={color ? ({ '--sc': color } as React.CSSProperties) : undefined}>
            <SessionGlyph meta={{ icon, icon_bg: iconBg, color }} fallback="aperçu" size={44} />
          </span>
          <div className="glyph-tabs">
            {(['lettres', 'mascotte', 'icone'] as const).map((k) => (
              <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); if (k === 'lettres') setIcon('') }}>{k === 'icone' ? 'icône' : k}</button>
            ))}
          </div>
        </div>
        {tab === 'mascotte' && (
          <div className="glyph-grid">
            {(['fast', 'slow'] as const).flatMap((kind) => MASCOTS[kind].map((mm) => {
              const id = `mascot:${kind}:${mm.name}`
              return (
                <button type="button" key={id} className={`glyph-pick ${icon === id ? 'on' : ''}`} title={`${mm.name} — ${mm.role}`} onClick={() => setIcon(id)}>
                  <SessionGlyph meta={{ icon: id, icon_bg: iconBg }} fallback="" size={40} />
                  <i>{mm.name}</i>
                </button>
              )
            }))}
          </div>
        )}
        {tab === 'icone' && (
          <div className="glyph-grid">
            {ICON_IDS.map((id) => (
              <button type="button" key={id} className={`glyph-pick ${icon === `icon:${id}` ? 'on' : ''}`} title={ICONS[id].label} onClick={() => setIcon(`icon:${id}`)}>
                <SessionGlyph meta={{ icon: `icon:${id}`, icon_bg: iconBg }} fallback="" size={40} />
                <i>{ICONS[id].label}</i>
              </button>
            ))}
          </div>
        )}
        {tab !== 'lettres' && (
          <div className="cs-palette" style={{ marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--faint)', marginRight: 4 }}>fond</span>
            <button type="button" className={`sw none ${iconBg === '' ? 'on' : ''}`} title="teinte de l’accent" onClick={() => setIconBg('')}>×</button>
            {PALETTE.map((c) => (
              <button type="button" key={c} className={`sw ${iconBg === c ? 'on' : ''}`} style={{ background: c }} title={c} onClick={() => setIconBg(c)} />
            ))}
            <button type="button" className={`sw ${iconBg === '#0e0a10' ? 'on' : ''}`} style={{ background: '#0e0a10' }} title="aubergine" onClick={() => setIconBg('#0e0a10')} />
            <input type="color" value={iconBg || '#1f1622'} title="fond libre" onChange={(e) => setIconBg(e.target.value)} />
          </div>
        )}
      </div>
      <label className="cs-check"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> épingler en tête</label>
      <div className="cs-note">
        {controllable
          ? 'Le nom est synchronisé avec la session : renommer ici renomme le terminal (/rename), et un /rename dans le terminal met à jour ce nom.'
          : 'Fenêtre injoignable : le nom ne sera pas poussé dans le terminal (un /rename côté terminal sera quand même repris ici).'}
      </div>
      {err && <div className="cs-err">{err}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn sm onClick={onClose}>annuler</Btn>
        <Btn sm solid disabled={busy} onClick={save}>{busy ? '…' : 'enregistrer'}</Btn>
      </div>
    </div>
  )
}
