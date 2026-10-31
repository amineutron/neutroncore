import { useState } from 'react'
import {
  ecrireStocke, heure, libelleCanal, lireStocke, nomOutil, requete, verdict,
  type Evenement, type HistoriqueResp,
} from '../../lib/lyraMemoire'
import { useLyraData, useRetard } from '../../lib/useLyraData'
import { Chip, Loader } from '../ui'
import { HistoStats } from './HistoStats'

const CLE = 'neutroncore_lm_historique'
type Reglage = { outil: string; succes: string; periode: string }
const PERIODES: [string, string][] = [['7', '7 jours'], ['30', '30 jours'], ['', 'tout']]

const jourDe = (e: Evenement) => (e.at ? new Date(e.at * 1000).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'sans date')
const debut = (jours: string) => (jours ? new Date(Date.now() - Number(jours) * 86400_000).toLocaleDateString('sv-SE') : '')

/** Onglet « historique vocal » : ce qui a ete dit, compris, execute, et si ca a marche. Aucun son. */
export function HistoriqueTab() {
  const [reglage, setReglage] = useState<Reglage>(() => lireStocke<Reglage>(CLE, { outil: '', succes: '', periode: '30' }))
  const [q, setQ] = useState('')
  const qd = useRetard(q)
  const { data, erreur } = useLyraData<HistoriqueResp>(
    `/lyra/historique${requete({ q: qd, outil: reglage.outil, succes: reglage.succes, du: debut(reglage.periode), limite: 200 })}`)
  const regler = (r: Partial<Reglage>) => { const n = { ...reglage, ...r }; setReglage(n); ecrireStocke(CLE, n) }

  if (!data) return erreur ? <div className="lm-empty">lyra est injoignable : {erreur}</div> : <Loader label="lecture de l'historique" />
  let dernier = ''
  return (
    <div>
      <div className="lm-bar">
        <input className="lm-search" type="search" placeholder="chercher une phrase ou un outil..." value={q}
          aria-label="chercher" onChange={(e) => setQ(e.target.value)} />
        <select className="lm-select" value={reglage.periode} aria-label="période" onChange={(e) => regler({ periode: e.target.value })}>
          {PERIODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="lm-select" value={reglage.outil} aria-label="outil" onChange={(e) => regler({ outil: e.target.value })}>
          <option value="">tous les outils</option>
          {data.outils.map((o) => <option key={o} value={o}>{nomOutil(o)}</option>)}
        </select>
        <select className="lm-select" value={reglage.succes} aria-label="résultat" onChange={(e) => regler({ succes: e.target.value })}>
          <option value="">tous les résultats</option><option value="oui">ce qui a marché</option><option value="non">ce qui a raté</option>
        </select>
      </div>
      <p className="lm-note">{data.note}</p>
      <HistoStats stats={data.stats} />
      {!data.evenements.length && <div className="lm-empty">rien ne correspond à ces filtres</div>}
      {data.evenements.map((e) => {
        const jour = jourDe(e)
        const titre = jour !== dernier ? <div className="lm-day">{jour}</div> : null
        dernier = jour
        return (
          <div key={e.id}>
            {titre}
            <div className="lm-ev">
              <span className="h">{heure(e.at)}</span>
              <div>
                <div className="ph">{e.phrase || (e.source === 'erreur' ? `l'outil ${nomOutil(e.outil)} a échoué` : '(phrase vide)')}</div>
                <div className="co">
                  {libelleCanal(e.canal) && <>{libelleCanal(e.canal)} - </>}
                  {e.outil ? <>outil : {nomOutil(e.outil)}</> : 'aucun outil choisi'}
                  {e.confiance !== null && <> - sûre à {Math.round(e.confiance * 100)} %</>}
                  {e.detail && <> - {e.detail}</>}
                </div>
              </div>
              <Chip tone={e.succes === true ? 'ok' : e.succes === false ? 'crit' : undefined}>{verdict(e)}</Chip>
            </div>
          </div>
        )
      })}
      {data.n > data.evenements.length && <p className="lm-note">{data.n - data.evenements.length} autres : resserre les filtres.</p>}
    </div>
  )
}
