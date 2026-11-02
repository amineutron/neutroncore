import { useCallback, useState } from 'react'

// Préférence d'écran qui se souvient de son état (filtres activables, panneaux ouverts) : localStorage,
// jamais bloquant. Le stockage peut manquer (fenêtre privée) ou contenir autre chose : on retombe sur le défaut.

export function lirePref<T>(cle: string, defaut: T, valide: (x: unknown) => x is T): T {
  try {
    const brut = localStorage.getItem(cle)
    if (brut === null) return defaut
    const v: unknown = JSON.parse(brut)
    return valide(v) ? v : defaut
  } catch {
    return defaut
  }
}

export function ecrirePref(cle: string, valeur: unknown): void {
  try { localStorage.setItem(cle, JSON.stringify(valeur)) } catch { /* stockage indisponible : la préférence ne survit pas au rechargement */ }
}

export function usePref<T>(cle: string, defaut: T, valide: (x: unknown) => x is T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => lirePref(cle, defaut, valide))
  const set = useCallback((n: T) => { setV(n); ecrirePref(cle, n) }, [cle])
  return [v, set]
}

export const estTexte = (x: unknown): x is string => typeof x === 'string'
export const estBool = (x: unknown): x is boolean => typeof x === 'boolean'
