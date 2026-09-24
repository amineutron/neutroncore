import { useCallback, useEffect, useState } from 'react'
import { apiGet } from './api'

// VMs KVM : GET /services/vms passe par le daemon Lyra (fedora.vm_status,
// 3 a 7 s). Aucune boucle de fond : on ne demande la liste que quand un
// ecran l'affiche, ou pendant qu'une VM demarree via Lyra est suivie.
export type Vm = { name: string; display_name: string; status: string; type: string; extra: Record<string, string> }
export type VmList = { vms: Vm[]; fetched_at: string | null; stale: boolean; error: string | null }

// dernier etat connu, garde entre deux montages d'ecran pour afficher
// quelque chose pendant l'appel suivant
let lastKnown: VmList | null = null

export async function fetchVms(): Promise<VmList> {
  const res = await apiGet<VmList>('/services/vms')
  if (res.vms.length > 0 || !res.stale) lastKnown = res
  return res
}

// Chargement a l'ouverture de l'ecran + refresh() manuel, sans polling.
export function useVms(): { data: VmList | null; loading: boolean; error: string | null; refresh: () => void } {
  const [data, setData] = useState<VmList | null>(lastKnown)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    fetchVms()
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { data, loading, error, refresh }
}
