// Flux temps réel simulés du mode démo : chat Lyra et événements des sessions.

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')) })
})

/** Réponse de Lyra scénarisée : un appel d'outil puis une réponse, comme le vrai pont. */
export async function demoLyraChat(text: string, onEvent: (ev: Record<string, unknown>) => void, signal?: AbortSignal): Promise<void> {
  const q = text.toLowerCase()
  const tool = q.includes('vm') ? 'fedora.vm_status' : q.includes('tv') || q.includes('télé') ? 'tv.get_state' : 'tracking.list'
  await sleep(400, signal)
  onEvent({ type: 'output', kind: 'tool_call', tool, arguments: {} })
  await sleep(700, signal)
  onEvent({ type: 'result' })
  onEvent({ type: 'output', kind: 'text', text:
    `Mode démo : je n'exécute rien ici. Dans l'installation réelle, j'aurais appelé « ${tool} » via le démon Lyra ` +
    'et répondu avec l’état de ta machine. Essaie les écrans : les données affichées sont fictives.' })
}

/** Aucun événement de session en démo : le flux reste ouvert jusqu'à l'abandon. */
export async function demoSessionEvents(signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve()))
}
