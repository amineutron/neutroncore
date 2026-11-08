import { useMemo, useRef, useState } from 'react'
import { FILTERS, FMT_LABEL, FMT_TIME, hasUi, highlight, search, selected, sizeText, type LibEntry, type LibFilter } from '../../lib/vmLibrary'
import { Btn } from '../ui'
import { Q } from './Help'

function Hl({ text, q }: { text: string; q: string }) {
  return <>{highlight(text, q).map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</>
}

/** Bibliotheque d'images : recherche reactive a chaque lettre, filtres, plusieurs editions par distribution. */
export function Library({ entries, onDeploy, loading, error, dirMissing }: { entries: LibEntry[]; onDeploy: (e: LibEntry) => void; loading: boolean; error: string | null; dirMissing: boolean }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState<LibFilter>('tout')
  const [choice, setChoice] = useState<Record<string, string>>({})
  const shown = useRef<Set<string>>(new Set())
  const groups = useMemo(() => search(entries, q, f), [entries, q, f])
  const nv = groups.reduce((s, g) => s + g.vars.length, 0)
  const prev = shown.current
  if (!entries.length) return <div className="vh-empty" role="status">{loading ? 'chargement du catalogue…' : error ? `catalogue indisponible : ${error}` : 'le catalogue est vide'}</div>
  shown.current = new Set(groups.map((g) => g.dist))   // seules les cartes qui apparaissent s'animent

  return (
    <div className="vh-enter">
      <div className="vh-ph"><h2>bibliothèque d'images<Q k="lib-fmt" /></h2><span className="lite">Tailles et durées indicatives. Une image téléchargée reste en cache pour les déploiements suivants.{dirMissing ? ' Le dossier d\'images est absent : rien n\'est en cache.' : ''}</span></div>
      <div className="vh-lsearch">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="chercher : debian, kde, léger, cloud, tuilage…" aria-label="chercher une image" autoComplete="off" />
        <Q k="lib-search" />
        <span className="lite" aria-live="polite">{groups.length} distribution(s), {nv} édition(s)</span>
      </div>
      <div className="vh-chips" style={{ margin: '12px 0' }} role="group" aria-label="filtres">
        {FILTERS.map((t) => <button key={t} className={`vh-chip${f === t ? ' on' : ''}`} onClick={() => setF(t)}>{t}</button>)}
      </div>
      <details className="vh-how" style={{ marginBottom: 14 }}>
        <summary>comprendre les trois formats</summary>
        <ul>
          <li><b>{FMT_LABEL.cloud}</b> (~{FMT_TIME.cloud}) : disque déjà installé, configuré au premier démarrage (cloud-init).</li>
          <li><b>{FMT_LABEL.vb}</b> (~{FMT_TIME.vb}) : assemblée à la demande par virt-builder, avec clé ssh et mot de passe injectés.</li>
          <li><b>{FMT_LABEL.iso}</b> (~{FMT_TIME.iso}) : installateur à dérouler. Le plus flexible, le plus long.</li>
        </ul>
      </details>
      <div className="vh-cards">
        {groups.map((g, i) => {
          const sel = selected(g, choice[g.dist])
          const grp = (label: string, arr: LibEntry[]) => arr.length > 0 && (
            <>
              <div className="vh-edg">{label}</div>
              <div className="vh-eds">{arr.map((l) => (
                <button key={l.id} className={`vh-ed${l.id === sel.id ? ' on' : ''}`} onClick={() => setChoice((c) => ({ ...c, [g.dist]: l.id }))}><Hl text={l.ver} q={q} /></button>
              ))}</div>
            </>
          )
          return (
            <div key={g.dist} className={`vh-box vh-lc${prev.has(g.dist) ? '' : ' new'}`} style={{ ['--i' as string]: i }}>
              <div className="vh-row" style={{ justifyContent: 'space-between' }}><b className="mono"><Hl text={sel.nom} q={q} /></b><span className="lite">{g.vars.length} édition(s)</span></div>
              {g.vars.length > 1 && <>{grp('sans interface', g.vars.filter((l) => !hasUi(l)))}{grp('avec interface', g.vars.filter(hasUi))}</>}
              <div className="vh-tags">
                <span className="vh-tag">{FMT_LABEL[sel.fmt]}</span><span className="vh-tag">{hasUi(sel) ? sel.ui : 'sans interface'}</span><span className="vh-tag">{sel.pk}</span>
                <span className={`vh-tag${sel.cached ? ' ok' : ''}`}>{sel.cached ? 'en cache' : sizeText(sel.mb)}</span>
              </div>
              <p><Hl text={sel.desc} q={q} /></p>
              <div className="lite">idéal pour : {sel.pour} · recommandé : {sel.ram} Mo, {sel.disk} Go · source : {sel.src}</div>
              <div className="vh-foot">
                <Btn sm solid disabled={!sel.deployable} onClick={() => onDeploy(sel)}>déployer</Btn>
                {!sel.deployable && <span className="lite" title={sel.reason}>indisponible : {sel.reason}</span>}
              </div>
            </div>
          )
        })}
        {groups.length === 0 && (
          <div className="vh-empty" style={{ gridColumn: '1/-1' }}>
            aucune image ne correspond à « {q} ».
            <div style={{ marginTop: 8 }}><Btn sm onClick={() => { setQ(''); setF('tout') }}>effacer la recherche</Btn></div>
          </div>
        )}
      </div>
    </div>
  )
}
