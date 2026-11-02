import { useEffect, useRef, useState } from 'react'
import { MinuteurCard, type ActionMinuteur } from '../components/minuteurs/MinuteurCard'
import { MinuteurHero } from '../components/minuteurs/MinuteurHero'
import { MinuteurForm } from '../components/minuteurs/MinuteurForm'
import { NotesPanel } from '../components/minuteurs/NotesPanel'
import { ReglagesMinuteurs } from '../components/minuteurs/ReglagesMinuteurs'
import { useTick } from '../components/minuteurs/useTick'
import '../components/minuteurs/minuteurs.css'
import { Btn, Card, Loader, PageTitle } from '../components/ui'
import { apiDelete, apiGet, apiPost } from '../lib/api'
import { toast } from '../lib/dialog'
import { chargerFiltres, choisirPrincipal, filtrer, sauverFiltres, type Etat, type Filtres } from '../lib/minuteurs'
import { usePoll } from '../lib/poll'

// Minuteurs (cuisine, pomodoro…) et notes rapides, deux onglets d'un même écran.
export function Minuteurs() {
  const [filtres, setFiltres] = useState<Filtres>(chargerFiltres)
  const etat = usePoll<Etat>(() => apiGet('/minuteurs'), 5000)
  const [choisi, setChoisi] = useState<string | null>(null)
  const [reglagesOuverts, setReglagesOuverts] = useState(false)
  const releve = useRef(Date.now())
  const now = useTick(250)
  useEffect(() => { releve.current = Date.now() }, [etat.data])
  useEffect(() => { sauverFiltres(filtres) }, [filtres])

  async function agir(id: string, action: ActionMinuteur) {
    try {
      if (action === 'supprimer') await apiDelete(`/minuteurs/${id}`)
      else await apiPost(`/minuteurs/${id}/${action === 'plus' ? 'ajouter' : action}`, action === 'plus' ? { secondes: 60 } : undefined)
      etat.refresh()
    } catch (e) { toast((e as Error).message, 'crit') }
  }

  async function couperSonnerie() {
    try { await apiPost('/minuteurs/arreter-sonnerie'); etat.refresh() } catch (e) { toast((e as Error).message, 'crit') }
  }

  const d = etat.data
  const principal = d ? choisirPrincipal(filtrer(d.minuteurs, { ...filtres, type: 'tous', finis: true }), choisi) : null
  const autres = d ? filtrer(d.minuteurs, filtres).filter((t) => t.id !== principal?.id) : []
  const set = (p: Partial<Filtres>) => setFiltres({ ...filtres, ...p })
  return (
    <>
      <PageTitle title="minuteurs & notes" desc="un carnet de notes toujours à portée, et des minuteurs nommés avec un grand compte à rebours" help="minuteurs" />
      <div className="mn-layout">
        <div className="mn-col-notes">
          <Card title="notes" lite="saisie rapide, recherche, épingles"><NotesPanel /></Card>
        </div>
        <div className="mn-col-timers">
          <div className="mn-timers-head">
            <b>minuteurs</b>
            {d && (
              <button className="btn sm" style={{ marginLeft: 'auto' }} aria-pressed={reglagesOuverts} onClick={() => setReglagesOuverts(!reglagesOuverts)}>
                {reglagesOuverts ? 'fermer les réglages' : 'réglages'}
              </button>
            )}
          </div>
          {!d ? (etat.error ? <Card><span className="lite">{etat.error}</span></Card> : <Loader />) : (
            <>
              {d.sonnerie_en_cours && (
                <div className="mn-ring"><span>une sonnerie de minuteur est en cours</span><Btn sm solid onClick={couperSonnerie}>arrêter</Btn></div>
              )}
              {reglagesOuverts && <ReglagesMinuteurs reglages={d.reglages} onSaved={etat.refresh} />}
              {principal && <MinuteurHero t={principal} releveA={releve.current} now={now} onAction={agir} />}
              <div style={{ margin: '12px 0' }}>
                <MinuteurForm reglages={d.reglages} onDone={etat.refresh} />
              </div>
              {autres.length > 0 && (
                <>
                  <div className="mn-filters">
                    {(['tous', 'minuteur', 'pomodoro'] as const).map((t) => (
                      <button key={t} className={`chip ${filtres.type === t ? 'on' : ''}`} onClick={() => set({ type: t })}>{t === 'tous' ? 'tous' : t === 'minuteur' ? 'minuteurs' : 'pomodoros'}</button>
                    ))}
                    <button className={`chip ${filtres.finis ? 'on' : ''}`} onClick={() => set({ finis: !filtres.finis })}>terminés</button>
                  </div>
                  <div className="mn-list small">
                    {autres.map((t) => <MinuteurCard key={t.id} t={t} releveA={releve.current} now={now} onAction={agir} onSelect={setChoisi} />)}
                  </div>
                </>
              )}
              {d.minuteurs.length === 0 && <Card><span className="lite">aucun minuteur : lance-en un ci-dessus</span></Card>}
            </>
          )}
        </div>
      </div>
    </>
  )
}
