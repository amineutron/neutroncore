import { apiGet, apiPut } from '../lib/api'
import { usePoll, fmtAgo } from '../lib/poll'
import { toast } from '../lib/dialog'
import { aTraiter, conseil, trierDepots, type EtatBranches } from '../lib/branches'
import { Btn, Card, Chip } from './ui'

// Branches et PR des projets suivis. Chaque session Claude Code lancée d'ici sur un de ces projets
// travaille sur sa propre branche : cette carte montre ce qui traîne et ce qui est en conflit.
export function Branches() {
  const etat = usePoll<EtatBranches>(() => apiGet('/branches'), 300000)
  const d = etat.data
  const relire = async () => { try { await apiGet('/branches?frais=1'); etat.refresh() } catch { toast('relevé impossible', 'crit') } }
  const basculer = async () => {
    if (!d) return
    try {
      await apiPut('/branches/reglages', { depots: d.depots.map((x) => x.depot), par_session: !d.par_session })
      toast(d.par_session ? 'les sessions repartent dans le dossier du projet' : 'chaque session aura sa propre branche')
      etat.refresh()
    } catch { toast('réglage refusé', 'crit') }
  }
  return (
    <Card title="branches & pr" lite={d ? d.resume.phrase : 'relevé…'} style={{ marginBottom: 14 }}>
      {etat.error && !d && <Chip tone="crit">API injoignable : {etat.error}</Chip>}
      {d && (
        <>
          <div className="br-head">
            <label className="at-check"><input type="checkbox" checked={d.par_session} onChange={() => void basculer()} /> une branche par session Claude Code lancée d'ici</label>
            <Btn sm onClick={() => void relire()}>actualiser</Btn>
          </div>
          <p className="au-note">Une session lancée à la racine d'un projet suivi travaille dans son propre dossier, sur sa propre branche : plusieurs sessions ne se gênent plus. Le point de la semaine arrive chaque lundi dans les notifications.</p>
          {trierDepots(d.depots).map((dep) => (
            <details key={dep.depot} className="br-depot" open={aTraiter(dep)}>
              <summary>
                <b>{dep.depot}</b>
                {dep.erreur ? <Chip tone="crit">{dep.erreur}</Chip> : <>
                  <span className="br-meta">sur {dep.courante || '?'}{dep.modifies ? ` · ${dep.modifies} fichier${dep.modifies > 1 ? 's' : ''} modifié${dep.modifies > 1 ? 's' : ''}` : ''}</span>
                  {dep.branches.length === 0 && <span className="br-meta">rien en attente</span>}
                  {dep.branches.some((b) => b.conflit) && <Chip tone="crit">conflit</Chip>}
                  {dep.prs === null && dep.github && <span className="br-meta">PR illisibles (GitHub injoignable)</span>}
                </>}
              </summary>
              {dep.branches.map((b) => {
                const c = conseil(b)
                const pr = dep.prs?.find((p) => p.numero === b.pr)
                return (
                  <div key={b.nom} className="br-branche">
                    <code>{b.nom}</code>
                    <span className={`br-etat ${c.tone}`}>{c.texte}</span>
                    {b.le && <span className="br-meta">{fmtAgo(Date.parse(b.le) / 1000)}</span>}
                    {pr?.url.startsWith('https://') && <a className="btn sm" href={pr.url} target="_blank" rel="noreferrer">ouvrir la PR</a>}
                  </div>
                )
              })}
              {dep.sessions.length > 0 && <p className="br-meta">{dep.sessions.length} dossier{dep.sessions.length > 1 ? 's' : ''} de session : {dep.sessions.map((s) => s.branche || s.dossier).join(', ')}</p>}
            </details>
          ))}
        </>
      )}
    </Card>
  )
}
