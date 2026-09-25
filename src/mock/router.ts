// Mode démo (VITE_MOCK_API=1) : répond aux appels de l'API avec des données
// fictives, sans backend. Utilisé pour la version publiée sur GitHub Pages.
// Aucune donnée réelle : tout est inventé dans src/mock/data/.

export type MockCtx = { params: Record<string, string>; query: URLSearchParams; body: unknown }
export type MockHandler = (ctx: MockCtx) => unknown
type Route = { method: string; parts: string[]; handler: MockHandler }

export class MockNotFound extends Error {}

export function compileRoutes(table: [string, string, MockHandler][]): Route[] {
  return table.map(([method, pattern, handler]) => ({ method, parts: pattern.split('/').filter(Boolean), handler }))
}

/** Route correspondante (la première déclarée gagne) et paramètres `:nom` extraits. */
export function matchRoute(routes: Route[], method: string, path: string): { handler: MockHandler; params: Record<string, string> } | null {
  const segs = path.split('/').filter(Boolean).map(decodeURIComponent)
  for (const r of routes) {
    if (r.method !== method || r.parts.length !== segs.length) continue
    const params: Record<string, string> = {}
    const ok = r.parts.every((p, i) => {
      if (p.startsWith(':')) {
        params[p.slice(1)] = segs[i]
        return true
      }
      return p === segs[i]
    })
    if (ok) return { handler: r.handler, params }
  }
  return null
}

/** Réponse fictive ; une action (POST/PUT/DELETE) sans route dédiée réussit
 * sans rien faire, une lecture inconnue lève MockNotFound (404 côté client). */
export function mockRequest(routes: Route[], method: string, url: string, body?: unknown): unknown {
  const [path, qs = ''] = url.split('?')
  const hit = matchRoute(routes, method, path)
  if (hit) return hit.handler({ params: hit.params, query: new URLSearchParams(qs), body })
  if (method !== 'GET') return { success: true, demo: true, message: 'mode démo : action simulée' }
  throw new MockNotFound(`${method} ${path}`)
}
