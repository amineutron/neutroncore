// Client API neutroncore — même origine que lyra-control-api (:9876).
// La clé Bearer est saisie une fois (écran de config) et gardée en localStorage.

const KEY_STORAGE = 'neutroncore_api_key'

// Mode démo (build VITE_MOCK_API=1, publié sur GitHub Pages) : aucune requête
// réseau, données fictives de src/mock. Constante de compilation : dans le build
// normal, ces branches et le code de démo sont retirés du bundle.
export const DEMO = import.meta.env.VITE_MOCK_API === '1'

async function demoRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const [{ mockRequest, MockNotFound }, { ROUTES }] = await Promise.all([import('../mock/router'), import('../mock/routes')])
  await new Promise((r) => setTimeout(r, 150)) // latence d'un vrai appel
  try {
    return mockRequest(ROUTES, method, path, body) as T
  } catch (e) {
    if (e instanceof MockNotFound) throw new ApiError(404, `mode démo : ${e.message} sans données`)
    throw e
  }
}

export function getApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) ?? ''
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim())
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let detail = r.statusText
    try {
      detail = (await r.json()).detail ?? detail
    } catch {
      /* corps non JSON */
    }
    throw new ApiError(r.status, detail)
  }
  return r.json() as Promise<T>
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  if (DEMO) return demoRequest<T>('GET', path)
  return handle<T>(await fetch(path, { headers: headers() }))
}

export async function apiPost<T = unknown>(path: string, body?: unknown, extra?: Record<string, string>): Promise<T> {
  if (DEMO) return demoRequest<T>('POST', path, body)
  return handle<T>(
    await fetch(path, { method: 'POST', headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body) }),
  )
}

export async function apiPut<T = unknown>(path: string, body: unknown): Promise<T> {
  if (DEMO) return demoRequest<T>('PUT', path, body)
  return handle<T>(await fetch(path, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }))
}

export async function apiDelete<T = unknown>(path: string, extra?: Record<string, string>): Promise<T> {
  if (DEMO) return demoRequest<T>('DELETE', path)
  return handle<T>(await fetch(path, { method: 'DELETE', headers: headers(extra) }))
}

// Actions destructives : token HMAC 30 s renvoyé dans X-Confirm
export async function withConfirm(action: string): Promise<Record<string, string>> {
  const t = await apiGet<{ token: string }>(`/auth/token?action=${encodeURIComponent(action)}`)
  return { 'X-Confirm': t.token }
}

// Chat Lyra : POST SSE lu en streaming (EventSource ne supporte pas POST)
export async function lyraChat(
  text: string,
  onEvent: (ev: Record<string, unknown>) => void,
  signal?: AbortSignal,
  mode: 'default' | 'performance' = 'default',
): Promise<void> {
  if (DEMO) return (await import('../mock/streams')).demoLyraChat(text, onEvent, signal)
  const r = await fetch('/lyra/chat', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ text, mode }),
    signal,
  })
  if (!r.ok || !r.body) throw new ApiError(r.status, 'chat indisponible')
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (line.startsWith('data: ')) {
        try {
          onEvent(JSON.parse(line.slice(6)))
        } catch {
          /* ligne partielle ignorée */
        }
      }
    }
  }
}

// Sessions Claude Code : flux SSE des hooks (Notification / Stop) lu en streaming
// (EventSource ne peut pas envoyer le Bearer).
export async function sessionEvents(
  onEvent: (ev: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (DEMO) return (await import('../mock/streams')).demoSessionEvents(signal)
  const r = await fetch('/launcher/sessions/events', { headers: headers(), signal })
  if (!r.ok || !r.body) throw new ApiError(r.status, 'flux sessions indisponible')
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      try { onEvent(JSON.parse(line.slice(6))) } catch { /* ping ou ready */ }
    }
  }
}
