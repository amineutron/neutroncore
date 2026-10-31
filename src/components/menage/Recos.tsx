import { useContext, useState } from 'react'
import { NavContext } from '../../App'
import { apiGet, apiPost, ApiError } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { setPrefill } from '../../lib/prefill'
import { usePoll } from '../../lib/poll'
import { origineRecos, type Recos as RecosT } from '../../lib/mediaMenage'
import { Btn, Card, Chip, Loader } from '../ui'

export function Recos() {
  const recos = usePoll<RecosT>(() => apiGet('/recos'), 600000)
  const [calcul, setCalcul] = useState(false)
  const navigate = useContext(NavContext)

  async function generer() {
    setCalcul(true)
    try { await apiPost('/recos/generer'); recos.refresh() }
    catch (e) { toast(e instanceof ApiError ? e.message : 'échec', 'crit') }
    finally { setCalcul(false) }
  }
  function demander(titre: string) {
    setPrefill(titre)
    navigate('demandes')
  }

  const d = recos.data
  if (!d) return recos.error ? <Card><p style={{ color: 'var(--crit)' }}>{recos.error}</p></Card> : <Loader />
  return (
    <>
      <Card title="quoi demander ensuite" lite="d'après ton historique plex et ta liste de suivi">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn solid disabled={calcul} onClick={generer}>{calcul ? 'réflexion…' : d.suggestions.length ? 'régénérer' : 'générer des suggestions'}</Btn>
          <Chip tone={d.source === 'modele' ? 'gold' : undefined}>{origineRecos(d)}</Chip>
          {d.genere > 0 && <span className="lite">{new Date(d.genere * 1000).toLocaleString('fr-FR')}</span>}
        </div>
        <p className="lite" style={{ marginTop: 8 }}>
          le modèle local ne tourne que si la carte graphique a de la place (vérifié avant) et se décharge aussitôt ; sinon, repli sur les recommandations d'overseerr.
          Les suggestions viennent d'un modèle : vérifie avant de demander.
        </p>
      </Card>
      {d.suggestions.length === 0 && d.genere > 0 && <Card><p className="lite">aucune suggestion exploitable cette fois.</p></Card>}
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {d.suggestions.map((s) => (
          <Card key={`${s.titre}${s.annee}`}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <strong>{s.titre}</strong> <span className="lite">{s.annee ?? ''} · {s.type}</span>
                <div className="lite">{s.raison}</div>
              </div>
              <Btn sm onClick={() => demander(s.titre)}>demander</Btn>
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
