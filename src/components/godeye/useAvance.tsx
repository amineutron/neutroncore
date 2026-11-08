import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiGet, apiPut } from '../../lib/api'
import { corpsReglages, CLE_AVANCE, AVANCE_DEFAUT, empreinte, lireAvanceStockee, lireReglagesServeur, type Avance } from '../../lib/godeye/reglagesServeur'
import { lireFraicheur, type FraicheurServeur, type Pastille } from '../../lib/godeye/fraicheur'
import type { CoucheId } from '../../lib/godeye/modele'
import { lireZones, type ZoneVue } from '../../lib/godeye/rotation'
import type { Elements } from '../../lib/godeye/elements'
import type { Filtres } from '../../lib/godeye/filtres'

/** Ce que partagent le panneau de réglages, la fraîcheur et le résumé sans passer par chaque composant intermédiaire. */
export type ContexteAvance = {
  avance: Avance
  onAvance: (a: Avance) => void
  zones: ZoneVue[]
  pastilles: Pastille[]
}
const DEFAUT: ContexteAvance = { avance: AVANCE_DEFAUT, onAvance: () => {}, zones: [], pastilles: [] }
const Ctx = createContext<ContexteAvance>(DEFAUT)
export const useContexteAvance = (): ContexteAvance => useContext(Ctx)
export const FournisseurAvance = ({ valeur, children }: { valeur: ContexteAvance; children: ReactNode }) => <Ctx.Provider value={valeur}>{children}</Ctx.Provider>

const lireLocal = (): Avance => { try { return lireAvanceStockee(localStorage.getItem(CLE_AVANCE)) } catch { return AVANCE_DEFAUT } }

/** Durée d'historique et rotation : copie navigateur, mise à jour immédiate. */
export function useAvance(): [Avance, (a: Avance) => void] {
  const [avance, setAvance] = useState<Avance>(lireLocal)
  const changer = useCallback((a: Avance) => {
    setAvance(a)
    try { localStorage.setItem(CLE_AVANCE, JSON.stringify(a)) } catch { /* sans stockage : le serveur garde le réglage */ }
  }, [])
  return [avance, changer]
}

/** Zones surveillées (pour la rotation et le choix d'une zone à la télé) ; une liste vide si l'API ne les connaît pas. */
export function useListeZones(actif = true): ZoneVue[] {
  const [zones, setZones] = useState<ZoneVue[]>([])
  useEffect(() => {
    if (!actif) return
    let vivant = true
    apiGet('/godeye/zones').then((r) => { if (vivant) setZones(lireZones(r)) }).catch(() => { /* pas de zones : rotation sur le monde seulement */ })
    return () => { vivant = false }
  }, [actif])
  return zones
}

/** Fraîcheur annoncée par le serveur (flux de fond), relue toutes les 60 s ; ignorée si l'API ne la connaît pas. */
export function useFraicheurServeur(actif: boolean): Partial<Record<CoucheId, FraicheurServeur>> {
  const [f, setF] = useState<Partial<Record<CoucheId, FraicheurServeur>>>({})
  useEffect(() => {
    if (!actif) return
    let vivant = true
    const un = () => { if (!document.hidden) apiGet('/godeye/fraicheur').then((r) => { if (vivant) setF(lireFraicheur(r)) }).catch(() => { /* garde la dernière */ }) }
    un()
    const t = window.setInterval(un, 60_000)
    return () => { vivant = false; window.clearInterval(t) }
  }, [actif])
  return f
}

type Sync = {
  filtres: Filtres; elements: Elements; avance: Avance
  appliquerServeur: (r: { filtres: Filtres | null; elements: Elements | null; avance: Avance | null }) => void
}

/**
 * Synchronise elements, filtres, historique et rotation avec le serveur. À l'ouverture le serveur gagne (ses parties vides
 * restent celles du navigateur et lui sont envoyées) ; ensuite écriture différée de 1,5 s. Tant que la lecture n'a pas réussi
 * on n'écrit rien : une panne passagère ne doit pas écraser les réglages du serveur avec une copie locale.
 */
export function useReglagesServeur(p: Sync): void {
  const etat = useRef<{ pret: boolean; derniere: string }>({ pret: false, derniere: '' })
  const courant = useRef(p)
  courant.current = p

  useEffect(() => {
    let vivant = true
    let essai = 0
    let timer = 0
    const lire = async () => {
      try {
        const r = lireReglagesServeur(await apiGet('/godeye/reglages'))
        if (!vivant || !r) throw new Error('réponse inutilisable')
        const c = courant.current
        c.appliquerServeur(r)
        const fusion = corpsReglages(r.elements ?? c.elements, r.filtres ?? c.filtres, r.avance ?? c.avance)
        etat.current = { pret: true, derniere: empreinte(fusion) }
        // une partie encore vide côté serveur : on lui envoie la version du navigateur
        if (!r.elements || !r.filtres || !r.avance) apiPut('/godeye/reglages', fusion).catch(() => { etat.current.derniere = '' })
      } catch {
        if (vivant && essai++ < 3) timer = window.setTimeout(() => void lire(), 30_000 * essai)
      }
    }
    void lire()
    return () => { vivant = false; window.clearTimeout(timer) }
  }, [])

  const corps = useMemo(() => empreinte(corpsReglages(p.elements, p.filtres, p.avance)), [p.elements, p.filtres, p.avance])
  useEffect(() => {
    if (!etat.current.pret) return
    if (corps === etat.current.derniere) return
    const t = window.setTimeout(() => {
      const c = courant.current
      apiPut('/godeye/reglages', corpsReglages(c.elements, c.filtres, c.avance)).then(() => { etat.current.derniere = corps }).catch(() => { /* réessayé au prochain changement */ })
    }, 1500)
    return () => window.clearTimeout(t)
  }, [corps])
}
