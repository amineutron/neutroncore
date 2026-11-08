import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { apiDelete, apiGet, apiPost } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { usePoll } from '../../lib/poll'
import type { Objet } from '../../lib/godeye/modele'
import type { Orbite } from '../../lib/godeye/orbites'
import { avecSuivi, lireSuivis, peutMarquer, sansSuivi, type Suivi } from '../../lib/godeye/suivi'
import { ajouterPoint, assembler, garderIds, traceSelection, traceSuivi, tracesSatellites, type Historique, type Polyligne } from '../../lib/godeye/trace'
import type { VueHandle } from './vues'

type Entree = {
  objets: readonly Objet[]
  objet: Objet | null
  orbites: readonly Orbite[]
  maintenant: number
  vue: RefObject<VueHandle | null>
  scene: RefObject<HTMLElement | null>
}

export type Exploration = {
  suivis: readonly Suivi[]
  polylignes: readonly Polyligne[]
  /** Identifiant de carte de l'objet que la vue garde au centre, ou null. */
  centreSur: string | null
  marquer: (o: Objet) => Promise<void>
  retirer: (s: Suivi) => Promise<void>
  basculerCentrage: (o: Objet) => void
}

/** Âge de position, marquage et centrage sur un objet en mouvement ; ne dessine rien, rend des polylignes. */
export function useExploration({ objets, objet, orbites, maintenant, vue, scene }: Entree): Exploration {
  const [suivis, setSuivis] = useState<Suivi[]>([])
  const [histo, setHisto] = useState<Historique>({})
  const [centreSur, setCentreSur] = useState<string | null>(null)

  const lecture = usePoll(() => apiGet('/godeye/suivis'), 60_000)
  useEffect(() => { if (lecture.data) setSuivis(lireSuivis(lecture.data)) }, [lecture.data])

  const marquer = useCallback(async (o: Objet) => {
    const p = peutMarquer(suivis, o)
    if (!p.ok) { toast(p.raison, 'warn'); return }
    try {
      await apiPost('/godeye/suivis', p.corps)
      setSuivis((l) => avecSuivi(l, { ...p.corps, depuis: Date.now(), points: [{ t: Date.now(), lon: o.lon, lat: o.lat }] }))
      toast(`${o.titre} marqué : sa position est enregistrée à partir de maintenant`, 'ok')
      lecture.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'marquage impossible', 'crit') }
  }, [suivis, lecture])

  const retirer = useCallback(async (s: Suivi) => {
    try {
      await apiDelete(`/godeye/suivis/${encodeURIComponent(s.id)}`)
      setSuivis((l) => sansSuivi(l, s))
    } catch (e) { toast(e instanceof Error ? e.message : 'retrait impossible', 'crit') }
  }, [])

  // positions relevées ici, seulement pour l'avion ou le navire sélectionné (les autres sont oubliés)
  const mobile = objet && (objet.couche === 'avions' || objet.couche === 'navires') ? objet : null
  const idMobile = mobile?.id ?? null
  const lonMobile = mobile?.lon, latMobile = mobile?.lat
  useEffect(() => {
    setHisto((h) => (idMobile && lonMobile !== undefined && latMobile !== undefined
      ? ajouterPoint(garderIds(h, [idMobile]), idMobile, { t: Date.now(), lon: lonMobile, lat: latMobile })
      : garderIds(h, [])))
  }, [idMobile, lonMobile, latMobile, maintenant])

  // satellites : trace des dernières minutes, recalculée une fois par minute (coûteux sur téléphone)
  const minute = Math.floor(maintenant / 60_000)
  const visibles = useMemo(() => new Set(objets.filter((o) => o.couche === 'satellites').map((o) => o.id.slice(4))), [objets])
  const selSat = objet?.couche === 'satellites' ? objet.id.slice(4) : null
  const ages = useMemo(
    () => tracesSatellites(orbites, visibles, minute * 60_000, { prioritaires: selSat ? [selSat] : [], max: 60 }),
    [orbites, visibles, minute, selSat],
  )

  const polylignes = useMemo(() => assembler(
    ages,
    suivis.map((s) => traceSuivi(`${s.type}:${s.id}`, s.points)),
    [idMobile ? traceSelection(idMobile, histo) : null],
  ), [ages, suivis, histo, idMobile])

  // centrage : la vue suit l'objet, sans changer le zoom ; un geste de l'utilisateur sur la scène l'arrête
  const cible = centreSur ? objets.find((o) => o.id === centreSur) ?? null : null
  useEffect(() => {
    if (!cible) return
    const v = vue.current?.lireVue()
    if (v) vue.current?.appliquerVue({ ...v, cx: cible.lon, cy: cible.lat })
  }, [cible, vue])
  useEffect(() => {
    if (!centreSur) return
    const el = scene.current
    if (!el) return
    const arret = (e: Event): void => { if (!(e.target as HTMLElement | null)?.closest?.('[data-bloque]')) setCentreSur(null) }
    el.addEventListener('pointerdown', arret)
    el.addEventListener('wheel', arret, { passive: true })
    return () => { el.removeEventListener('pointerdown', arret); el.removeEventListener('wheel', arret) }
  }, [centreSur, scene])
  useEffect(() => { if (centreSur && (!objet || objet.id !== centreSur)) setCentreSur(null) }, [objet, centreSur])

  const basculerCentrage = useCallback((o: Objet) => setCentreSur((c) => (c === o.id ? null : o.id)), [])
  return { suivis, polylignes, centreSur, marquer, retirer, basculerCentrage }
}
