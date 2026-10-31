// Enregistrement du service worker de la coque (public/sw.js).
// Invariant : la version du SW = BUILD_ID de la page qui l'enregistre, donc
// page, bundle et cache de la coque ont toujours le meme numero.
// Pas de SW : en dev, en demo, hors contexte securise (http sur le tailnet / coque
// Android), ou si l'utilisateur l'a coupe (localStorage neutroncore_no_sw=1).

export const NO_SW_KEY = 'neutroncore_no_sw'

export type RegisterEnv = {
  sw: ServiceWorkerContainer | undefined
  secure: boolean
  base: string
  buildId: string
  demo: boolean
  disabled: boolean
  caches?: CacheStorage
}

export type RegisterPlan = 'register' | 'unregister' | 'skip'

export function planRegistration(e: Pick<RegisterEnv, 'sw' | 'secure' | 'buildId' | 'demo' | 'disabled'>): RegisterPlan {
  if (!e.sw) return 'skip'
  if (e.demo) return 'skip'
  if (e.disabled || e.buildId === 'dev') return 'unregister'
  return e.secure ? 'register' : 'skip'
}

export function swUrl(base: string, buildId: string): string {
  return `${base}sw.js?v=${encodeURIComponent(buildId)}`
}

export async function applyRegistration(e: RegisterEnv): Promise<RegisterPlan> {
  const plan = planRegistration(e)
  try {
    if (plan === 'register') {
      await e.sw!.register(swUrl(e.base, e.buildId), { scope: e.base, updateViaCache: 'none' })
    } else if (plan === 'unregister') {
      const regs = await e.sw!.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
      if (e.caches) {
        const names = await e.caches.keys()
        await Promise.all(names.filter((n) => n.startsWith('nc-shell-')).map((n) => e.caches!.delete(n)))
      }
    }
  } catch {
    /* le SW est un bonus : jamais bloquant */
  }
  return plan
}
