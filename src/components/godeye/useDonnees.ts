import { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, DEMO } from '../../lib/api'
import { lireUsgs, FLUX_USGS } from '../../lib/vueMonde'
import { DONNEES_VIDES, type Boite, type CoucheId, type Donnees, type GroupeSat, type SourceInfo } from '../../lib/godeye/modele'
import type { Filtres } from '../../lib/godeye/filtres'
import { creerOrbites, positions, type Orbite } from '../../lib/godeye/orbites'
import { lireAvionsApi, lireEonet, lireInfosApi, lireNaviresApi, lireTle, MAX_PAR_GROUPE, URL_CELESTRAK, URL_EONET } from '../../lib/godeye/sources'
import { arrondir, cleBoite, MONDE, requeteBoite } from '../../lib/godeye/zone'
import { evenementsDemo, infosDemo, tleDemo } from '../../mock/data/godeye'
import { seismesDemo } from '../../mock/data/vueMonde'
import { FLUX_REPOS, useFlux, type EtatFlux } from './useFlux'

const MINUTE = 60_000
const TTL_ORBITES_MS = 2 * 60 * MINUTE   // CelesTrak demande de ne pas relire un groupe plus d'une fois toutes les 2 h
const orbitesVues = new Map<GroupeSat, { t: number; orbites: Orbite[] }>()

async function json(url: string, signal: AbortSignal): Promise<unknown> {
  const r = await fetch(url, { signal, cache: 'no-store' })
  if (!r.ok) throw new Error(`${new URL(url).hostname} a répondu ${r.status}`)
  return r.json()
}

async function texte(url: string, signal: AbortSignal): Promise<string> {
  const r = await fetch(url, { signal, cache: 'no-store' })
  if (!r.ok) throw new Error(`${new URL(url).hostname} a répondu ${r.status}`)
  return r.text()
}

export type Sortie = {
  donnees: Donnees
  maintenant: number
  etats: Record<CoucheId, EtatFlux>
  /** Texte de couverture de la source d'avions ("250 mn autour de..."), vide si inconnu. */
  couvreAvions: string
  /** État de chaque flux d'actualités (pour les puces de sources et les pannes). */
  sourcesInfos: SourceInfo[]
  orbites: readonly Orbite[]
}

/** Charge les couches allumées ; une couche coupée ne fait aucune requête. `boite` = zone visible (non arrondie). */
export function useDonnees(f: Filtres, boite: Boite | null): Sortie {
  const [infos, setInfos] = useState<{ liste: Donnees['infos']; sources: SourceInfo[] }>({ liste: [], sources: [] })
  const [seismes, setSeismes] = useState(DONNEES_VIDES.seismes)
  const [evenements, setEvenements] = useState(DONNEES_VIDES.evenements)
  const [avions, setAvions] = useState({ liste: DONNEES_VIDES.avions, releve: 0, couvre: '' })
  const [navires, setNavires] = useState({ liste: DONNEES_VIDES.navires, releve: 0 })
  const [orbites, setOrbites] = useState<Orbite[]>([])
  const [maintenant, setMaintenant] = useState(() => Date.now())

  const zone = useMemo(() => arrondir(boite ?? MONDE), [boite])
  const cleZone = cleBoite(zone)
  const zoneRef = useRef(zone)
  zoneRef.current = zone
  const groupesCle = f.satellites.groupes.join(',')

  const etatSeismes = useFlux(f.couches.seismes, f.seismes.periode, 5 * MINUTE, async (signal) => {
    const liste = DEMO ? seismesDemo() : lireUsgs(await json(FLUX_USGS[f.seismes.periode], signal))
    if (!signal.aborted) setSeismes(liste)
  })
  const etatInfos = useFlux(f.couches.infos, 'infos', 5 * MINUTE, async (signal) => {
    const r = DEMO ? infosDemo() : await apiGet('/godeye/infos')
    if (!signal.aborted) { const l = lireInfosApi(r); setInfos({ liste: l.infos, sources: l.sources }) }
  })
  const etatEvenements = useFlux(f.couches.evenements, String(f.evenements.jours), 15 * MINUTE, async (signal) => {
    const liste = DEMO ? evenementsDemo() : lireEonet(await json(URL_EONET(f.evenements.jours), signal))
    if (!signal.aborted) setEvenements(liste)
  })
  const modeAvions = f.avions.mode
  const etatAvions = useFlux(f.couches.avions, `${modeAvions}|${modeAvions === 'zone' ? cleZone : ''}`, 10_000, async (signal) => {
    const chemin = modeAvions === 'militaires' ? '/godeye/avions?mode=militaires' : `/godeye/avions?mode=zone&${requeteBoite(zoneRef.current)}`
    const r = await apiGet<{ couvre?: string }>(chemin)
    if (!signal.aborted) setAvions({ liste: lireAvionsApi(r), releve: Date.now(), couvre: typeof r.couvre === 'string' ? r.couvre : '' })
  })
  const etatNavires = useFlux(f.couches.navires, cleZone, MINUTE, async (signal) => {
    const r = await apiGet(`/godeye/navires?${requeteBoite(zoneRef.current)}`)
    if (!signal.aborted) setNavires({ liste: lireNaviresApi(r), releve: Date.now() })
  })

  // satellites : éléments orbitaux par groupe (gardés 2 h), puis position recalculée chaque seconde
  const etatSat = useFlux(f.couches.satellites, groupesCle, 30 * MINUTE, async (signal) => {
    const maintenantMs = Date.now()
    const tous: Orbite[] = []
    for (const g of f.satellites.groupes) {
      let vu = orbitesVues.get(g)
      if (!vu || maintenantMs - vu.t > TTL_ORBITES_MS) {
        const tles = DEMO ? lireTle(tleDemo()) : lireTle(await texte(URL_CELESTRAK(g), signal), MAX_PAR_GROUPE[g] ?? 800)
        vu = { t: maintenantMs, orbites: creerOrbites(tles, g) }
        orbitesVues.set(g, vu)
      }
      tous.push(...vu.orbites)
    }
    if (!signal.aborted) setOrbites(tous)
  })

  const mobiles = f.couches.avions || f.couches.navires || f.couches.satellites
  useEffect(() => {
    if (!mobiles) return
    const t = window.setInterval(() => { if (!document.hidden) setMaintenant(Date.now()) }, 1000)
    return () => window.clearInterval(t)
  }, [mobiles])

  const satellites = useMemo(
    () => (f.couches.satellites ? positions(orbites.filter((o) => f.satellites.groupes.includes(o.groupe)), new Date(maintenant)) : []),
    [f.couches.satellites, f.satellites.groupes, orbites, maintenant],
  )

  const donnees = useMemo<Donnees>(() => ({
    seismes, evenements, infos: infos.liste, satellites, avions: avions.liste, navires: navires.liste,
    releveAvions: avions.releve, releveNavires: navires.releve,
  }), [seismes, evenements, infos.liste, satellites, avions, navires])

  const etats: Record<CoucheId, EtatFlux> = {
    seismes: etatSeismes, infos: etatInfos, evenements: etatEvenements, avions: etatAvions, navires: etatNavires, satellites: etatSat, cyber: FLUX_REPOS,
  }
  return { donnees, maintenant, etats, couvreAvions: avions.couvre, orbites, sourcesInfos: infos.sources }
}
