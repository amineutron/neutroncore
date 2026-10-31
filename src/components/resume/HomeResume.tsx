import { useContext } from 'react'
import { apiGet } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { NavContext } from '../../App'
import { ECRAN_RESUME, type Briefing } from '../../lib/resume'
import { BriefingView } from './BriefingView'
import { Btn, Eyebrow } from '../ui'

// Résumé du matin sur l'accueil et en mode télé (source `resume` de TvDashboard).
// Sur l'accueil : masqué si le réglage « afficher sur l'accueil » est coupé. En mode télé : toujours affiché.
export function HomeResume({ tv = false }: { tv?: boolean }) {
  const navigate = useContext(NavContext)
  const r = usePoll<{ resume: Briefing; accueil: boolean }>(() => apiGet('/resume'), 300_000)
  if (!tv && (!r.data || !r.data.accueil)) return null
  return (
    <div className={`card rs-home ${tv ? 'tv' : ''}`}>
      <div className="rs-home-head">
        <Eyebrow>résumé du matin</Eyebrow>
        {!tv && <Btn sm onClick={() => navigate(ECRAN_RESUME)}>ouvrir</Btn>}
      </div>
      {r.data ? <BriefingView b={r.data.resume} tv={tv} />
        : <p className="rs-note">{r.error ? `indisponible (${r.error})` : 'chargement…'}</p>}
    </div>
  )
}
