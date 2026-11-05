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

/** DJ Light en démo : le morceau simulé (`lib/djSimu`) joue en boucle à 30 images par seconde, jusqu'à l'abandon. */
export async function demoDjlightFlux(onEvent: (ev: import('../lib/api').EvenementDj) => void, signal?: AbortSignal): Promise<void> {
  const { Simulateur } = await import('../lib/djSimu')
  const simu = new Simulateur(1, 8)
  onEvent({ type: 'etat', moteur: 'ok', source: 'morceau simulé' })
  try {
    for (;;) {
      await sleep(1000 / 30, signal)
      onEvent({ type: 'frame', ...simu.suivant(1 / 30) })
    }
  } catch { /* abandon de l'écran */ }
}
