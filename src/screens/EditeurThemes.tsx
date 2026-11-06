import { useMemo, useRef, useState } from 'react'
import { PageTitle, Eyebrow } from '../components/ui'
import { confirmDialog, toast } from '../lib/dialog'
import { getSettings, saveSettings, type Settings } from '../lib/settings'
import { ThemePreview } from '../components/themes/ThemePreview'
import { ContrastPanel } from '../components/themes/ContrastPanel'
import { TokenFields } from '../components/themes/TokenFields'
import '../components/themes/editeurThemes.css'
import {
  BUILTIN, duplicateTheme, exportThemes, importThemes, installPersoStyles, loadThemes, newTheme, persoValue,
  removeTheme, saveThemes, upsertTheme, withDerivedSofts, MAX_THEMES, type BuiltinId, type CustomTheme, type TokenName,
} from '../lib/themes'

const applyTheme = (value: string) => saveSettings({ theme: value } as unknown as Partial<Settings>)

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function EditeurThemes() {
  const [themes, setThemes] = useState<CustomTheme[]>(() => loadThemes(localStorage))
  const [draft, setDraft] = useState<CustomTheme | null>(null)
  const [base, setBase] = useState<BuiltinId>('neutron')
  const [io, setIo] = useState('')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const active = getSettings().theme as string
  const taken = useMemo(() => themes.map((t) => t.id), [themes])
  const saved = draft ? themes.find((t) => t.id === draft.id) : undefined
  const dirty = draft !== null && JSON.stringify(saved) !== JSON.stringify(draft)

  function persist(next: CustomTheme[]) {
    setThemes(next)
    saveThemes(localStorage, next)
    installPersoStyles(next)   // la feuille injectee suit : un theme actif se met a jour en direct
  }
  async function leave(): Promise<boolean> {
    return !dirty || confirmDialog({ title: 'abandonner les changements ?', body: 'Le theme en cours a des modifications non enregistrees.', ok: 'abandonner', danger: true })
  }
  async function pick(t: CustomTheme | null) {
    if (await leave()) setDraft(t ? { ...t, tokens: { ...t.tokens } } : null)
  }
  async function create() {
    if (themes.length >= MAX_THEMES) { toast(`limite de ${MAX_THEMES} themes`, 'warn'); return }
    if (!(await leave())) return
    const b = BUILTIN[base]
    setDraft(newTheme(`perso ${b.label}`, b, taken))
  }
  function edit(name: TokenName, v: string) {
    if (!draft) return
    const tokens = { ...draft.tokens, [name]: v }
    // les translucides suivent l'accent tant qu'on ne les regle pas a la main
    setDraft({ ...draft, tokens: name === 'gold' || name === 'rose' ? withDerivedSofts(tokens, draft.dark) : tokens })
  }
  function save() {
    if (!draft || !draft.name.trim()) { toast('donne un nom au theme', 'warn'); return }
    persist(upsertTheme(themes, { ...draft, name: draft.name.trim() }))
    toast('theme enregistré')
  }
  async function remove(t: CustomTheme) {
    if (!(await confirmDialog({ title: `supprimer « ${t.name} » ?`, body: 'Pense à exporter le theme si tu veux le garder.', ok: 'supprimer', danger: true }))) return
    if (active === persoValue(t.id)) applyTheme('neutron')
    persist(removeTheme(themes, t.id))
    if (draft?.id === t.id) setDraft(null)
  }
  function doImport(text: string) {
    const r = importThemes(text, themes)
    if (r.themes.length) persist([...themes, ...r.themes])
    setMsg(r.errors.join(' · ') || `${r.themes.length} theme(s) importé(s)`)
    if (r.themes.length) setIo('')
  }

  return (
    <>
      <PageTitle help="themes" title="éditeur de thèmes" desc="Crée tes propres thèmes à partir des variables du design system, avec contrôle de contraste." />
      <div className="th-layout">
        <div>
          <Eyebrow>mes thèmes</Eyebrow>
          <div className="th-list">
            {themes.length === 0 && <span className="th-msg" style={{ color: 'var(--faint)' }}>aucun thème perso</span>}
            {themes.map((t) => (
              <button key={t.id} className={`th-item ${draft?.id === t.id ? 'on' : ''}`} onClick={() => pick(t)}>
                <span className="sw">{[t.tokens.ink, t.tokens.gold, t.tokens.rose].map((c, i) => <i key={i} style={{ background: c }} />)}</span>
                <span style={{ flex: 1 }}>{t.name}</span>
                {active === persoValue(t.id) && <span className="chip">actif</span>}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select value={base} onChange={(e) => setBase(e.target.value as BuiltinId)} aria-label="theme de depart" className="th-name" style={{ minWidth: 0 }}>
              {(Object.keys(BUILTIN) as BuiltinId[]).map((k) => <option key={k} value={k}>partir de {BUILTIN[k].label}</option>)}
            </select>
            <button className="btn sm solid" onClick={create}>nouveau</button>
          </div>
        </div>

        <div>
          {!draft && <p style={{ color: 'var(--muted)' }}>Choisis un thème à gauche, ou crée-en un à partir d'un thème intégré.</p>}
          {draft && (
            <>
              <div className="th-actions">
                <input className="th-name" value={draft.name} maxLength={32} aria-label="nom du theme" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <label style={{ fontSize: 12 }}><input type="checkbox" checked={draft.dark} onChange={(e) => setDraft({ ...draft, dark: e.target.checked })} /> thème sombre</label>
                <button className="btn sm solid" onClick={save} disabled={!dirty}>enregistrer</button>
                <button className="btn sm" disabled={dirty || !saved} title={dirty ? 'enregistre d\'abord' : ''} onClick={() => applyTheme(persoValue(draft.id))}>appliquer</button>
                {saved && <button className="btn sm" onClick={async () => { if (await leave()) setDraft(duplicateTheme(saved, taken)) }}>dupliquer</button>}
                {saved && <button className="btn sm danger" onClick={() => remove(saved)}>supprimer</button>}
              </div>
              <Eyebrow>aperçu en direct</Eyebrow>
              <ThemePreview theme={draft} />
              <div style={{ height: 14 }} />
              <Eyebrow>contraste</Eyebrow>
              <ContrastPanel theme={draft} />
              <div style={{ height: 14 }} />
              <Eyebrow>couleurs</Eyebrow>
              <TokenFields tokens={draft.tokens} onChange={edit} />
            </>
          )}
          <div style={{ height: 18 }} />
          <Eyebrow>import / export</Eyebrow>
          <div className="th-actions">
            <button className="btn sm" disabled={themes.length === 0} onClick={() => download('neutroncore-themes.json', exportThemes(themes))}>exporter tout</button>
            {saved && <button className="btn sm" onClick={() => download(`theme-${saved.id}.json`, exportThemes([saved]))}>exporter celui-ci</button>}
            <button className="btn sm" onClick={() => fileRef.current?.click()}>importer un fichier</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden
              onChange={async (e) => { const f = e.target.files?.[0]; if (f) doImport(await f.text()); e.target.value = '' }} />
          </div>
          <textarea className="th-io" value={io} onChange={(e) => setIo(e.target.value)} placeholder="ou colle ici le JSON d'un thème" aria-label="JSON a importer" />
          <div className="th-actions"><button className="btn sm" disabled={!io.trim()} onClick={() => doImport(io)}>importer le texte</button></div>
          {msg && <div className="th-msg" role="status">{msg}</div>}
        </div>
      </div>
    </>
  )
}
