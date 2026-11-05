import { useEffect, useMemo, useRef, useState } from 'react'
import { apiPost, DEMO, getApiKey } from '../../lib/api'
import { LIAISON_ARRETEE, LiaisonLampes, type EtatLiaison, type ReponseReel, type SocketLike } from '../../lib/djLiaison'

const urlCanal = () => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/djlight/lampes`

/** DJ Light sur les vraies lampes. La liaison est détruite avec l'écran : les lampes sont alors rendues à l'API. */
export function useLampesReelles(): { etat: EtatLiaison; liaison: LiaisonLampes } {
  const [etat, setEtat] = useState<EtatLiaison>(LIAISON_ARRETEE)
  const liaison = useMemo(() => new LiaisonLampes({
    reel: (actif) => (DEMO ? Promise.resolve<ReponseReel>({ success: false, error: 'indisponible en démonstration : aucune lampe n’est branchée' }) : apiPost<ReponseReel>('/djlight/reel', { actif })),
    ouvrir: () => {
      const ws = new WebSocket(urlCanal())
      ws.binaryType = 'arraybuffer'
      return ws as unknown as SocketLike
    },
    cle: getApiKey,
    surEtat: setEtat,
  }), [])
  const vivant = useRef(liaison)
  vivant.current = liaison
  // quitter l'écran (ou fermer l'onglet) ne laisse pas les lampes prises : l'API les rend de toute façon au bout de quelques secondes
  useEffect(() => {
    const quitter = () => { void vivant.current.arreter() }
    window.addEventListener('pagehide', quitter)
    return () => { window.removeEventListener('pagehide', quitter); quitter() }
  }, [])
  return { etat, liaison }
}
