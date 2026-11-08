import { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, DEMO } from '../../lib/api'
import { avecRepli, COUCHES_CACHEES, ecrireCache, fusionnerCache, lireCache, restaures, type CoucheCachee } from '../../lib/godeye/cache'
import { pastilles, type Pastille } from '../../lib/godeye/fraicheur'
import { besoinHistorique, completer, HISTORIQUE_VIDE, lireHistorique, type Historique } from '../../lib/godeye/historique'
import type { CoucheId, Donnees } from '../../lib/godeye/modele'
import type { Filtres } from '../../lib/godeye/filtres'
import { useFraicheurServeur } from './useAvance'
import type { EtatFlux } from './useFlux'

const stockage = (): Storage | null => { try { return window.localStorage } catch { return null } }

/**
 * Fiabilité des données : dernier état connu rechargé au démarrage (copie gardée dans le navigateur), historique du serveur
 * quand une source est tombée ou qu'on demande plus que le flux courant, et pastilles de fraîcheur par couche.
 * Rien ici ne bloque : une copie illisible ou un historique indisponible laissent simplement les données du flux.
 */
export function useFiabilite(donnees: Donnees, etats: Record<CoucheId, EtatFlux>, f: Filtres, maintenant: number, heuresHistorique: number): { donnees: Donnees; pastilles: Pastille[] } {
  const [cache] = useState(() => lireCache(DEMO ? null : stockage(), Date.now()))
  const majs = useMemo(() => Object.fromEntries(Object.entries(etats).map(([k, e]) => [k, e.maj])) as Record<CoucheId, number | null>, [etats])
  const serveur = useFraicheurServeur(true)

  // enregistrement du dernier état connu, au plus toutes les 20 s, des seules couches réellement lues
  const vu = useRef<Partial<Record<CoucheCachee, number>>>({})
  const dernierEcrit = useRef(0)
  useEffect(() => {
    if (DEMO) return
    const t = Date.now()
    if (t - dernierEcrit.current < 20_000) return
    const frais: Parameters<typeof fusionnerCache>[1] = {}
    for (const c of COUCHES_CACHEES) {
      const m = majs[c]
      if (m !== null && m !== vu.current[c] && !etats[c].erreur) { frais[c] = { t: m, liste: donnees[c] }; vu.current = { ...vu.current, [c]: m } }
    }
    if (Object.keys(frais).length === 0) return
    dernierEcrit.current = t
    ecrireCache(stockage(), fusionnerCache(lireCache(stockage(), t), frais))
  }, [donnees, etats, majs])

  // historique du serveur
  const [hist, setHist] = useState<Historique>(HISTORIQUE_VIDE)
  const veut = besoinHistorique({
    seismes: f.couches.seismes, evenements: f.couches.evenements, erreurSeismes: etats.seismes.erreur !== '', erreurEvenements: etats.evenements.erreur !== '',
    heuresDemandees: Math.max(f.seismes.heures, f.evenements.jours * 24), heuresHistorique: heuresHistorique,
  })
  useEffect(() => {
    if (!veut) { setHist(HISTORIQUE_VIDE); return }
    let vivant = true
    const un = () => apiGet(`/godeye/historique?heures=${heuresHistorique}`).then((r) => { if (vivant) setHist(lireHistorique(r)) }).catch(() => { /* garde le précédent */ })
    void un()
    const t = window.setInterval(() => { if (!document.hidden) void un() }, 5 * 60_000)
    return () => { vivant = false; window.clearInterval(t) }
  }, [veut, heuresHistorique])

  const sortie = useMemo(() => {
    const repli = avecRepli(donnees, cache, majs, f.couches)
    return completer(repli, hist, maintenant, Math.min(Math.max(f.seismes.heures, f.evenements.jours * 24), heuresHistorique))
  }, [donnees, cache, majs, f.couches, hist, maintenant, f.seismes.heures, f.evenements.jours, heuresHistorique])

  const liste = useMemo(() => pastilles({ filtresCouches: f.couches, etats, maintenant, restaures: restaures(cache, majs, f.couches), serveur }), [f.couches, etats, maintenant, cache, majs, serveur])
  return { donnees: sortie, pastilles: liste }
}
