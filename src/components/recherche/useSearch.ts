import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiGet } from '../../lib/api'
import { toast } from '../../lib/dialog'
import type { Command } from '../../lib/palette'
import {
  basculerSource, ecransDe, FILTRES_CLE, hitsEnCommandes, lireFiltres, MIN_Q, parametreSources,
  type Actions, type CommandeResultat, type Reponse, type SourceId,
} from '../../lib/recherche'
import { NavContext, type ScreenId } from '../../App'

const DEBOUNCE_MS = 250

/** Sources cochées, retenues dans localStorage. */
export function useFiltres(): [SourceId[], (id: SourceId) => void] {
  const [actives, setActives] = useState<SourceId[]>(() => {
    try { return lireFiltres(localStorage.getItem(FILTRES_CLE)) } catch { return lireFiltres(null) }
  })
  const basculer = useCallback((id: SourceId) => {
    setActives((cur) => {
      const next = basculerSource(cur, id)
      try { localStorage.setItem(FILTRES_CLE, JSON.stringify(next)) } catch { /* stockage indisponible : filtres de session */ }
      return next
    })
  }, [])
  return [actives, basculer]
}

/** GET /recherche avec anti-rebond ; une réponse périmée (saisie qui a changé depuis) est ignorée. */
export function useSearch(query: string, actives: SourceId[]) {
  const [data, setData] = useState<Reponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const seq = useRef(0)
  const q = query.trim()
  const filtre = parametreSources(actives)

  useEffect(() => {
    const mine = ++seq.current
    if (q.length < MIN_Q) { setData(null); setLoading(false); setError(''); return }
    setLoading(true)
    const t = setTimeout(() => {
      apiGet<Reponse>(`/recherche?q=${encodeURIComponent(q)}${filtre}`)
        .then((r) => { if (mine === seq.current) { setData(r); setError('') } })
        .catch((e: Error) => { if (mine === seq.current) { setData(null); setError(e.message) } })
        .finally(() => { if (mine === seq.current) setLoading(false) })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q, filtre])

  return { data, loading, error }
}

/** Actions d'un résultat : navigation (écran, session en lien profond), cloche, copie. */
export function useSearchActions(commands: Command[], openNotifs: () => void): { actions: Actions; ecrans: string[] } {
  const navigate = useContext(NavContext)
  const ecrans = useMemo(() => ecransDe(commands), [commands])
  const actions = useMemo<Actions>(() => ({
    allerA: (ecran, session) => {
      if (session) { try { sessionStorage.setItem('deepLinkTarget', session) } catch { /* stockage indisponible */ } }
      navigate(ecran as ScreenId)
    },
    ouvrirNotifs: openNotifs,
    copier: (texte) => { void navigator.clipboard?.writeText(texte).then(() => toast('chemin copié'), () => toast('copie impossible', 'warn')) },
  }), [navigate, openNotifs])
  return { actions, ecrans }
}

/** Pour la palette Ctrl+K : les résultats de la recherche globale sous forme de commandes (voir INTEGRATION.md). */
export function useSearchCommands(query: string, commands: Command[], openNotifs: () => void): { hits: CommandeResultat[]; loading: boolean } {
  const [actives] = useFiltres()
  const { data, loading } = useSearch(query, actives)
  const { actions, ecrans } = useSearchActions(commands, openNotifs)
  const hits = useMemo(() => (data ? hitsEnCommandes(data.resultats, ecrans, actions, data.sources) : []), [data, ecrans, actions])
  return { hits, loading }
}
