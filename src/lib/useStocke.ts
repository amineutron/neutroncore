import { useCallback, useState } from 'react'
import { ecrireStocke, lireStocke } from './ciDeps'

/** État d'un objet de filtres qui se souvient de lui (localStorage, sans jamais planter s'il est indisponible). */
export function useStocke<T extends object>(cle: string, defaut: T): [T, (suite: Partial<T>) => void] {
  const [valeur, setValeur] = useState<T>(() => lireStocke(cle, defaut))
  const maj = useCallback((suite: Partial<T>) => {
    setValeur((v) => {
      const neuf = { ...v, ...suite }
      ecrireStocke(cle, neuf)
      return neuf
    })
  }, [cle])
  return [valeur, maj]
}
