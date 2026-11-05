import { useEffect, useMemo, useRef, useState } from 'react'
import { apiPost, DEMO, getApiKey } from '../../lib/api'
import type { SocketLike } from '../../lib/djLiaison'
import { LIAISON_AMBILIGHT_ARRETEE, LiaisonAmbilight, type EtatAmbilight, type ReponseAmbilight } from '../../lib/djLiaisonAmbilight'

const urlCanal = () => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/djlight/ambilight`

/** DJ Light sur l'Ambilight. La liaison est détruite avec l'écran : la télé retrouve alors son style d'avant. */
export function useAmbilight(): { etat: EtatAmbilight; liaison: LiaisonAmbilight } {
  const [etat, setEtat] = useState<EtatAmbilight>(LIAISON_AMBILIGHT_ARRETEE)
  const liaison = useMemo(() => new LiaisonAmbilight({
    demarrer: (voie) => (DEMO
      ? Promise.resolve<ReponseAmbilight>({ success: false, error: 'indisponible en démonstration : aucune télé n’est branchée' })
      : apiPost<ReponseAmbilight>('/djlight/ambilight', { actif: true, voie })),
    arreter: () => (DEMO ? Promise.resolve({}) : apiPost('/djlight/ambilight', { actif: false })),
    ouvrir: () => new WebSocket(urlCanal()) as unknown as SocketLike,
    cle: getApiKey,
    surEtat: setEtat,
  }), [])
  const vivant = useRef(liaison)
  vivant.current = liaison
  // quitter l'écran (ou fermer l'onglet) ne laisse pas l'Ambilight pris : l'API le rend de toute façon au bout de quelques secondes
  useEffect(() => {
    const quitter = () => { void vivant.current.arreter() }
    window.addEventListener('pagehide', quitter)
    return () => { window.removeEventListener('pagehide', quitter); quitter() }
  }, [])
  return { etat, liaison }
}
