// « Ça sonne » : bandeau sur tous les écrans (et sur le téléphone), ou grand bouton en tête de
// l'accueil et de l'agenda (`grand`), tant qu'une sonnerie de rappel joue. Relevé toutes les 10 s,
// page visible seulement.
import { apiGet, apiPost } from '../lib/api'
import { toast } from '../lib/dialog'
import { usePoll } from '../lib/poll'
import type { EnCours } from '../lib/rappels'

export function RappelEnCours({ enabled, grand = false }: { enabled: boolean; grand?: boolean }) {
  const etat = usePoll<{ en_cours: EnCours }>(() => apiGet('/agenda/rappels/en-cours'), 10000, enabled)
  const r = etat.data?.en_cours
  if (!r || r.type !== 'rappel') return null
  async function arreter() {
    try {
      await apiPost('/agenda/rappels/arreter')
    } catch (e) { toast(`arrêt impossible : ${e instanceof Error ? e.message : String(e)}`, 'warn') }
    etat.refresh()
  }
  if (grand) {
    return (
      <button className="rp-stop" onClick={arreter}>
        <span className="rp-stop-t">arrêter le réveil</span>
        <span className="rp-stop-d">{r.titre}</span>
      </button>
    )
  }
  return (
    <div className="rp-sonne" role="alert">
      <b>rappel</b>
      <span>{r.titre}</span>
      <button className="btn sm solid" onClick={arreter}>arrêter la sonnerie</button>
    </div>
  )
}
