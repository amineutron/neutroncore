import { useEffect, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { CLE_NOTE_RAPIDE } from '../../lib/minuteurs'
import {
  chargerFiltresNotes, lireSaisie, quand, requeteNotes, sauverFiltresNotes, type FiltresNotes, type ListeNotes, type Note,
} from '../../lib/notes'
import { usePoll } from '../../lib/poll'
import { Btn, Card, Chip, Loader } from '../ui'
import './minuteurs.css'

const RECENTES = 8

// Notes rapides : une ligne pour capturer (« #projet texte » ou le sélecteur), recherche, épinglage, corbeille.
export function NotesPanel() {
  const [q, setQ] = useState('')
  const [filtres, setFiltres] = useState<FiltresNotes>(chargerFiltresNotes)
  const [toutes, setToutes] = useState(false)
  const [saisie, setSaisie] = useState('')
  const [projet, setProjet] = useState('')
  const [modif, setModif] = useState<{ id: string; texte: string } | null>(null)
  const champ = useRef<HTMLInputElement>(null)
  const liste = usePoll<ListeNotes>(() => apiGet(`/notes${requeteNotes(q, filtres)}`), 30000)

  useEffect(() => { sauverFiltresNotes(filtres); liste.refresh() }, [filtres]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(liste.refresh, 250); return () => clearTimeout(t) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let demande = ''
    try { demande = sessionStorage.getItem(CLE_NOTE_RAPIDE) ?? ''; sessionStorage.removeItem(CLE_NOTE_RAPIDE) } catch { /* stockage indisponible */ }
    if (demande) champ.current?.focus()
  }, [])

  async function ajouter() {
    const lu = lireSaisie(saisie, projet)
    if (!lu) return
    try {
      await apiPost('/notes', { ...lu, source: 'hub' })
      setSaisie('')
      liste.refresh()
    } catch (e) { toast((e as Error).message, 'crit') }
  }

  async function agir(fn: () => Promise<unknown>, message?: string) {
    try { await fn(); liste.refresh(); if (message) toast(message) } catch (e) { toast((e as Error).message, 'crit') }
  }

  async function retirer(n: Note) {
    if (!(await confirmDialog({ title: 'retirer cette note ?', body: n.texte.slice(0, 120), ok: 'retirer', danger: true }))) return
    await agir(() => apiDelete(`/notes/${n.id}`), 'note mise à la corbeille')
  }

  const d = liste.data
  const filtre = (p: Partial<FiltresNotes>) => setFiltres({ ...filtres, ...p })
  return (
    <>
      <div className="mn-notes-add hero">
        <input ref={champ} className="grow" value={saisie} onChange={(e) => setSaisie(e.target.value)} maxLength={1000}
          placeholder="une idée, une tâche… (#projet au début pour la ranger)" aria-label="nouvelle note" autoFocus
          onKeyDown={(e) => e.key === 'Enter' && ajouter()} />
        <select value={projet} onChange={(e) => setProjet(e.target.value)} aria-label="projet">
          <option value="">sans projet</option>
          {(d?.projets ?? []).map((p) => <option key={p.projet} value={p.projet}>{p.projet}</option>)}
        </select>
        <Btn solid disabled={!saisie.trim()} onClick={ajouter}>noter</Btn>
      </div>
      <div className="mn-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="chercher dans les notes" aria-label="chercher" /></div>
      <div className="mn-filters">
        <button className={`chip ${filtres.projet === null ? 'on' : ''}`} onClick={() => filtre({ projet: null })}>toutes{d ? ` (${d.total})` : ''}</button>
        <button className={`chip ${filtres.epinglees ? 'on' : ''}`} onClick={() => filtre({ epinglees: !filtres.epinglees })}>épinglées{d ? ` (${d.epinglees})` : ''}</button>
        <button className={`chip ${filtres.projet === '' ? 'on' : ''}`} onClick={() => filtre({ projet: filtres.projet === '' ? null : '' })}>sans projet</button>
        {(d?.projets ?? []).map((p) => (
          <button key={p.projet} className={`chip ${filtres.projet === p.projet ? 'on' : ''}`}
            onClick={() => filtre({ projet: filtres.projet === p.projet ? null : p.projet })}>{p.projet} ({p.notes})</button>
        ))}
      </div>
      {!d ? <Loader /> : d.notes.length === 0 ? (
        <Card><span className="lite">{q || filtres.epinglees || filtres.projet !== null ? 'aucune note ne correspond' : 'aucune note : écris-en une ci-dessus'}</span></Card>
      ) : (
        <div className="mn-notes-list">
          {(toutes || q.trim() ? d.notes : d.notes.slice(0, RECENTES)).map((n) => (
            <div key={n.id} className={`mn-note ${n.epingle ? 'pin' : ''}`}>
              <div className="txt">
                {modif?.id === n.id ? (
                  <input className="grow" autoFocus value={modif.texte} style={{ width: '100%' }} onChange={(e) => setModif({ id: n.id, texte: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setModif(null)
                      if (e.key === 'Enter') void agir(() => apiPut(`/notes/${n.id}`, { texte: modif.texte })).then(() => setModif(null))
                    }} />
                ) : n.texte}
                <div className="meta">
                  {n.projet && <Chip tone="gold">{n.projet}</Chip>}
                  <span>{quand(n.modifie)}</span>
                  {n.source !== 'hub' && <span>via {n.source}</span>}
                </div>
              </div>
              <div className="acts">
                <button onClick={() => agir(() => apiPut(`/notes/${n.id}`, { epingle: !n.epingle }))}>{n.epingle ? 'désépingler' : 'épingler'}</button>
                <button onClick={() => setModif({ id: n.id, texte: n.texte })}>modifier</button>
                <button onClick={() => retirer(n)}>retirer</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {d && !q.trim() && d.notes.length > RECENTES && (
        <div style={{ marginTop: 10 }}><Btn sm onClick={() => setToutes(!toutes)}>{toutes ? 'seulement les récentes' : `voir toutes (${d.notes.length})`}</Btn></div>
      )}
      {d && d.corbeille > 0 && <Corbeille n={d.corbeille} onChange={liste.refresh} />}
    </>
  )
}

function Corbeille({ n, onChange }: { n: number; onChange: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const corb = usePoll<{ notes: Note[] }>(() => apiGet('/notes/corbeille'), 60000, ouvert)
  async function rendre(id: string) {
    try { await apiPost(`/notes/${id}/restaurer`); corb.refresh(); onChange() } catch (e) { toast((e as Error).message, 'crit') }
  }
  async function vider() {
    if (!(await confirmDialog({ title: 'vider la corbeille ?', body: 'Les notes seront effacées pour de bon.', ok: 'vider', danger: true }))) return
    try { await apiDelete('/notes/corbeille'); corb.refresh(); onChange() } catch (e) { toast((e as Error).message, 'crit') }
  }
  return (
    <div style={{ marginTop: 14 }}>
      <Btn sm onClick={() => setOuvert(!ouvert)}>corbeille ({n})</Btn>
      {ouvert && (
        <div className="mn-notes-list" style={{ marginTop: 8 }}>
          {(corb.data?.notes ?? []).map((x) => (
            <div key={x.id} className="mn-note">
              <div className="txt">{x.texte}</div>
              <div className="acts"><button onClick={() => rendre(x.id)}>restaurer</button></div>
            </div>
          ))}
          <div><Btn sm danger onClick={vider}>vider la corbeille</Btn></div>
        </div>
      )}
    </div>
  )
}
