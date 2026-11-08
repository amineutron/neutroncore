import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPut, withConfirm } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { corpsZone, erreursZone, ID_BROUILLON, lireZone, lireZones, ZONES_MAX, type Zone, type ZoneBrouillon } from '../../lib/godeye/zones'

export type EtatZones = {
  zones: readonly Zone[]
  chargees: boolean
  erreur: string
  occupe: boolean
  brouillon: ZoneBrouillon | null
  setBrouillon: (z: ZoneBrouillon | null) => void
  enregistrer: (z: ZoneBrouillon) => Promise<boolean>
  basculer: (z: Zone, champ: 'actif' | 'notifier') => Promise<void>
  supprimer: (z: Zone) => Promise<boolean>
  /** Zones à dessiner : les actives, plus le brouillon en cours d'édition. */
  dessinees: readonly ZoneBrouillon[]
  complet: boolean
}

const message = (e: unknown, defaut: string): string => (e instanceof Error ? e.message : defaut)

/** Zones surveillées : lues une fois (pas de relevé en boucle : l'évaluation est faite par le serveur) puis tenues à jour par les actions. */
export function useZonesSurveillees(): EtatZones {
  const [zones, setZones] = useState<readonly Zone[]>([])
  const [chargees, setChargees] = useState(false)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [brouillon, setBrouillon] = useState<ZoneBrouillon | null>(null)

  useEffect(() => {
    let vivant = true
    apiGet('/godeye/zones')
      .then((r) => { if (vivant) { setZones(lireZones(r)); setErreur('') } })
      .catch((e: unknown) => { if (vivant) setErreur(`zones indisponibles (${message(e, 'erreur')})`) })
      .finally(() => { if (vivant) setChargees(true) })
    return () => { vivant = false }
  }, [])

  const enregistrer = useCallback(async (z: ZoneBrouillon): Promise<boolean> => {
    const err = erreursZone(z)
    if (err.length) { toast(err[0], 'warn'); return false }
    if (!z.id && zones.length >= ZONES_MAX) { toast(`Limite atteinte : ${ZONES_MAX} zones au plus.`, 'warn'); return false }
    setOccupe(true)
    try {
      const r = lireZone(await apiPut(`/godeye/zones/${z.id ? encodeURIComponent(z.id) : 'new'}`, corpsZone(z)))
      if (!r) throw new Error('réponse inattendue du serveur')
      setZones((l) => (l.some((x) => x.id === r.id) ? l.map((x) => (x.id === r.id ? r : x)) : [...l, r]))
      toast(`zone « ${r.nom} » enregistrée`, 'ok')
      return true
    } catch (e) { toast(message(e, 'enregistrement impossible'), 'crit'); return false } finally { setOccupe(false) }
  }, [zones.length])

  const basculer = useCallback(async (z: Zone, champ: 'actif' | 'notifier') => {
    const suivante = { ...z, [champ]: !z[champ] }
    setZones((l) => l.map((x) => (x.id === z.id ? suivante : x)))   // retour immédiat, annulé si le serveur refuse
    try {
      const r = lireZone(await apiPut(`/godeye/zones/${encodeURIComponent(z.id)}`, corpsZone(suivante)))
      if (r) setZones((l) => l.map((x) => (x.id === r.id ? r : x)))
    } catch (e) {
      setZones((l) => l.map((x) => (x.id === z.id ? z : x)))
      toast(message(e, 'modification impossible'), 'crit')
    }
  }, [])

  const supprimer = useCallback(async (z: Zone): Promise<boolean> => {
    setOccupe(true)
    try {
      await apiDelete(`/godeye/zones/${encodeURIComponent(z.id)}`, await withConfirm('godeye_zone_supprimer'))
      setZones((l) => l.filter((x) => x.id !== z.id))
      return true
    } catch (e) { toast(message(e, 'suppression impossible'), 'crit'); return false } finally { setOccupe(false) }
  }, [])

  const dessinees = useMemo<readonly ZoneBrouillon[]>(() => {
    const edite = brouillon?.id
    const actives = zones.filter((z) => z.actif && z.id !== edite)
    return brouillon ? [...actives, { ...brouillon, id: ID_BROUILLON }] : actives
  }, [zones, brouillon])

  return { zones, chargees, erreur, occupe, brouillon, setBrouillon, enregistrer, basculer, supprimer, dessinees, complet: zones.length >= ZONES_MAX }
}
