import { useEffect, useRef, useState } from 'react'

/** « Failed to fetch » ne dit rien à l'utilisateur : c'est une coupure de connexion (API redémarrée, réseau, serveur arrêté). */
function message(e: unknown): string {
  if (e instanceof TypeError) return 'connexion impossible (API ou réseau coupé)'
  return e instanceof Error ? e.message : 'source injoignable'
}

export type EtatFlux = { charge: boolean; erreur: string; maj: number | null }
export const FLUX_REPOS: EtatFlux = { charge: false, erreur: '', maj: null }

/**
 * Charge une source tout de suite puis toutes les `periodeMs` (onglet visible seulement), tant que `actif`.
 * `cle` relance le chargement quand ce que la source demande change (zone, période...). Un changement de clé
 * annule le chargement en cours ; la dernière valeur lue reste affichée pendant le suivant.
 */
export function useFlux(actif: boolean, cle: string, periodeMs: number, charger: (signal: AbortSignal) => Promise<void>): EtatFlux {
  const [etat, setEtat] = useState<EtatFlux>(FLUX_REPOS)
  const chargerRef = useRef(charger)
  chargerRef.current = charger

  useEffect(() => {
    if (!actif) { setEtat(FLUX_REPOS); return }
    const ctl = new AbortController()
    const un = async () => {
      setEtat((e) => ({ ...e, charge: true }))
      try {
        await chargerRef.current(ctl.signal)
        if (!ctl.signal.aborted) setEtat({ charge: false, erreur: '', maj: Date.now() })
      } catch (e) {
        if (ctl.signal.aborted) return
        setEtat((p) => ({ ...p, charge: false, erreur: message(e) }))
      }
    }
    void un()
    const t = window.setInterval(() => { if (!document.hidden) void un() }, periodeMs)
    return () => { ctl.abort(); window.clearInterval(t) }
  }, [actif, cle, periodeMs])

  return etat
}
