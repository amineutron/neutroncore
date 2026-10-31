import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api'
import { Card, Chip, Loader } from '../ui'
import {
  KINDS, fmtHeure, fmtJour, fmtTokens, jourLocal, type DetailSession, type Filtres, type Kind, type SessionVue,
} from '../../lib/historique'

const QS = (o: Record<string, string>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString()

function Detail({ id, f, onNatures }: { id: string; f: Filtres; onNatures: (n: Kind[]) => void }) {
  const [d, setD] = useState<DetailSession | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let vivant = true
    apiGet<DetailSession>(`/journal/sessions/${id}?${QS({ q: f.q, limit: '1000' })}`)
      .then((r) => vivant && (setD(r), setErr('')))
      .catch((e: Error) => vivant && setErr(e.message))
    return () => { vivant = false }
  }, [id, f.q])
  if (err) return <div className="hi-warn">{err}</div>
  if (!d) return <Loader label="chargement" />
  const evs = d.evenements.filter((e) => f.natures.includes(e.kind))
  const toggle = (k: Kind) => onNatures(f.natures.includes(k) ? f.natures.filter((n) => n !== k) : [...f.natures, k])
  let dernierJour = ''
  return (
    <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
      <div className="hi-bar">
        {KINDS.map((k) => (
          <button key={k.id} className={`btn sm ${f.natures.includes(k.id) ? 'solid' : ''}`} onClick={() => toggle(k.id)}>{k.label}</button>
        ))}
      </div>
      {d.tronque && <div className="hi-warn">journal tronqué : seuls les premiers événements de chaque transcript sont gardés.</div>}
      {evs.length === 0 && <div className="pdesc">aucun événement pour ces filtres.</div>}
      {evs.map((e, i) => {
        const j = jourLocal(new Date(e.at * 1000))
        const titre = j !== dernierJour ? <div className="hi-day">{fmtJour(j)}</div> : null
        dernierJour = j
        return (
          <div key={i}>
            {titre}
            <div className={`hi-ev ${e.agent ? 'ag' : ''}`}>
              <span className="t">{fmtHeure(e.at)}</span>
              <span className={`k ${e.kind}`}>{KINDS.find((k) => k.id === e.kind)?.label ?? e.kind}</span>
              <span className="x">{e.text}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Journal({ sessions, f, onNatures }: { sessions: SessionVue[] | null; f: Filtres; onNatures: (n: Kind[]) => void }) {
  const [ouverte, setOuverte] = useState('')
  if (!sessions) return <Loader label="lecture du journal" />
  if (!sessions.length) return <Card><div className="pdesc">aucune session pour ces filtres.</div></Card>
  return (
    <div className="hi-sess">
      {sessions.map((s) => (
        <div key={s.id} className={`hi-card ${ouverte === s.id ? 'on' : ''}`} onClick={() => setOuverte(ouverte === s.id ? '' : s.id)}>
          <div className="top">
            <span className="ti">{s.title || s.id.slice(0, 8)}</span>
            <Chip tone="gold">{s.projet}</Chip>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              {fmtJour(jourLocal(new Date(s.fin * 1000)))} {fmtHeure(s.debut)}-{fmtHeure(s.fin)}
            </span>
          </div>
          <div className="meta">
            <Chip>{s.fichiers} fichiers</Chip><Chip>{s.commandes} commandes</Chip>
            {s.commits > 0 && <Chip tone="ok">{s.commits} commits</Chip>}
            <Chip>{s.prompts} demandes</Chip><Chip>{fmtTokens(s.tokens)} tokens</Chip>
            {s.sous_agents > 0 && <Chip>{s.sous_agents} sous-agents</Chip>}
            {s.correspondances !== undefined && <Chip tone="rose">{s.correspondances} correspondances</Chip>}
          </div>
          {s.extraits?.map((x, i) => <div key={i} className="ex">{x}</div>)}
          {ouverte === s.id && <Detail id={s.id} f={f} onNatures={onNatures} />}
        </div>
      ))}
    </div>
  )
}
