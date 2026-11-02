import { Card, Loader } from '../ui'
import { UsageChart } from './UsageChart'
import {
  avertissementTarif, fmtCout, fmtTokens, type Cumul, type Filtres, type Ligne, type Mode, type RapportUsage,
} from '../../lib/historique'

const MODES: { id: Mode; label: string }[] = [
  { id: 'cout', label: 'coût' }, { id: 'hors_cache', label: 'tokens (hors cache)' }, { id: 'tout', label: 'tokens (avec cache)' },
]

function Tableau({ titre, lignes, devise }: { titre: string; lignes: (Cumul & { cle: string })[]; devise: string }) {
  if (!lignes.length) return null
  return (
    <Card title={titre}>
      <div className="scroll-x">
        <table className="hi-table">
          <thead><tr><th /><th>entrée</th><th>sortie</th><th>cache lu</th><th>cache écrit</th><th>coût</th></tr></thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.cle}>
                <td>{l.cle}</td><td>{fmtTokens(l.entree)}</td><td>{fmtTokens(l.sortie)}</td>
                <td>{fmtTokens(l.lecture)}</td><td>{fmtTokens(l.ecriture)}</td><td>{fmtCout(l.cout, devise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function Usage({ r, f, onMode }: { r: RapportUsage | null; f: Filtres; onMode: (m: Mode) => void }) {
  if (!r) return <Loader label="calcul de l'usage" />
  const t = r.total as Cumul
  const vide = !t || t.messages === undefined
  const kpi = (l: string, v: string) => <div className="card hi-kpi" key={l}><div className="v">{v}</div><div className="l">{l}</div></div>
  const warn = avertissementTarif(r)
  const sessions: Ligne[] = r.par_session.map((s) => ({ ...s, cle: s.titre }))
  return (
    <>
      {vide ? <Card><div className="pdesc">aucune activité pour ces filtres.</div></Card> : (
        <div className="hi-kpis">
          {kpi('coût estimé', fmtCout(t.cout, r.devise))}
          {kpi('tokens de sortie', fmtTokens(t.sortie))}
          {kpi('tokens d\'entrée', fmtTokens(t.entree))}
          {kpi('cache lu', fmtTokens(t.lecture))}
          {kpi('cache écrit', fmtTokens(t.ecriture))}
          {kpi('réponses', String(t.messages))}
        </div>
      )}
      {warn && <div className="hi-warn">{warn}</div>}
      <Card title="par jour">
        <div className="hi-bar">
          {MODES.map((m) => <button key={m.id} className={`btn sm ${f.mode === m.id ? 'solid' : ''}`} onClick={() => onMode(m.id)}>{m.label}</button>)}
        </div>
        <UsageChart lignes={r.par_jour} mode={f.mode} devise={r.devise} />
      </Card>
      <div className="grid" style={{ marginTop: 14 }}>
        <Tableau titre="par projet" lignes={r.par_projet} devise={r.devise} />
        <Tableau titre="par modèle" lignes={r.par_modele} devise={r.devise} />
        <Tableau titre="sessions les plus coûteuses" lignes={sessions} devise={r.devise} />
      </div>
    </>
  )
}
