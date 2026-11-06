import { useCallback, useEffect, useState } from 'react'
import { apiGet } from './api'

/** Lecture d'une adresse qui se relit quand elle change ou sur `recharger()`. L'ancienne donnee reste
 *  affichee pendant le chargement (pas de clignotement a chaque frappe). */
export function useLyraData<T>(chemin: string): { data: T | null; erreur: string | null; charge: boolean; recharger: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [charge, setCharge] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let vivant = true
    setCharge(true)
    apiGet<T>(chemin)
      .then((d) => { if (vivant) { setData(d); setErreur(null) } })
      .catch((e: Error) => { if (vivant) setErreur(e.message) })
      .finally(() => { if (vivant) setCharge(false) })
    return () => { vivant = false }
  }, [chemin, tick])
  const recharger = useCallback(() => setTick((t) => t + 1), [])
  return { data, erreur, charge, recharger }
}

/** Valeur retardee : la recherche part 250 ms apres la derniere frappe. */
export function useRetard<T>(valeur: T, ms = 250): T {
  const [v, setV] = useState(valeur)
  useEffect(() => {
    const t = setTimeout(() => setV(valeur), ms)
    return () => clearTimeout(t)
  }, [valeur, ms])
  return v
}
