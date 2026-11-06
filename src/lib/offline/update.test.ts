import { describe, expect, it } from 'vitest'
import { applyRegistration, planRegistration, swUrl } from './register'
import { checkForUpdate, extractBuildId, isUpdateAvailable } from './update'

const html = (id: string) => `<script type="module" src="/app/assets/index-${id}.js"></script>`

describe('update', () => {
  it('extrait le hash du bundle', () => {
    expect(extractBuildId(html('Ab-12_x'))).toBe('Ab-12_x')
    expect(extractBuildId('<html></html>')).toBeNull()
  })
  it.each([
    ['abc', html('abc'), false],
    ['abc', html('def'), true],
    ['dev', html('def'), false], // dev : jamais d'alerte
    ['abc', '<html>erreur</html>', false], // index illisible : pas de fausse alerte
    ['', html('def'), false],
  ])('courant %s -> %s', (cur, h, exp) => expect(isUpdateAvailable(cur, h)).toBe(exp))

  it('checkForUpdate : jamais de levee hors ligne, jamais d\'alerte sur 503', async () => {
    const ko = (async () => { throw new TypeError('x') }) as unknown as typeof fetch
    expect(await checkForUpdate(ko, '/app/', 'abc')).toBe(false)
    const err = (async () => ({ ok: false, text: async () => html('zzz') })) as unknown as typeof fetch
    expect(await checkForUpdate(err, '/app/', 'abc')).toBe(false)
    const ok = (async () => ({ ok: true, text: async () => html('zzz') })) as unknown as typeof fetch
    expect(await checkForUpdate(ok, '/app/', 'abc')).toBe(true)
  })

  it('demande l\'index sans cache', async () => {
    let init: RequestInit | undefined
    await checkForUpdate((async (_u: string, i: RequestInit) => { init = i; return { ok: true, text: async () => '' } }) as unknown as typeof fetch, '/app/', 'a')
    expect(init?.cache).toBe('no-store')
  })
})

describe('register', () => {
  const sw = {} as ServiceWorkerContainer
  const base = { sw, secure: true, buildId: 'abc', demo: false, disabled: false }
  it.each([
    [{}, 'register'],
    [{ secure: false }, 'skip'], // http sur le tailnet / coque Android
    [{ sw: undefined }, 'skip'],
    [{ demo: true }, 'skip'],
    [{ buildId: 'dev' }, 'unregister'], // en dev, un vieux SW ne doit jamais survivre
    [{ disabled: true }, 'unregister'], // interrupteur de secours
  ])('%j -> %s', (over, plan) => expect(planRegistration({ ...base, ...over })).toBe(plan))

  it('l\'adresse porte le BUILD_ID (une version = une inscription neuve)', () => {
    expect(swUrl('/app/', 'a b')).toBe('/app/sw.js?v=a%20b')
  })

  it('register : portee /app/, jamais de cache HTTP du script', async () => {
    const calls: unknown[][] = []
    const env = { sw: { register: async (...a: unknown[]) => { calls.push(a) } } as unknown as ServiceWorkerContainer }
    await applyRegistration({ ...base, ...env, base: '/app/' })
    expect(calls[0]).toEqual(['/app/sw.js?v=abc', { scope: '/app/', updateViaCache: 'none' }])
  })

  it('unregister : desinscrit et vide les caches de la coque seulement', async () => {
    const removed: string[] = []
    const reg = { unregister: async () => { removed.push('reg'); return true } }
    const env = {
      sw: { getRegistrations: async () => [reg] } as unknown as ServiceWorkerContainer,
      caches: { keys: async () => ['nc-shell-1', 'autre'], delete: async (n: string) => { removed.push(n); return true } } as unknown as CacheStorage,
    }
    await applyRegistration({ ...base, ...env, base: '/app/', disabled: true })
    expect(removed).toEqual(['reg', 'nc-shell-1'])
  })

  it('une erreur du navigateur ne remonte jamais', async () => {
    const env = { sw: { register: async () => { throw new Error('SecurityError') } } as unknown as ServiceWorkerContainer }
    await expect(applyRegistration({ ...base, ...env, base: '/app/' })).resolves.toBe('register')
  })
})
