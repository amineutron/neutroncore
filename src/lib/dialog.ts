// Dialogues maison : remplacent window.confirm / window.alert (qui cassent
// l'identité visuelle et sont pénibles dans la coque Android). API à promesse,
// rendue par components/Dialogs.tsx monté une fois dans App.

export type Tone = 'ok' | 'warn' | 'crit'

export type AskOptions = {
  title: string
  body?: string
  ok?: string         // libellé du bouton de validation (défaut « confirmer »)
  cancel?: string     // libellé d'annulation (défaut « annuler »)
  danger?: boolean    // action destructive : bouton de validation en rouge
  check?: string      // case optionnelle (ex. « supprimer aussi les fichiers »)
  single?: boolean    // message à lire puis fermer : un seul bouton
}

export type Answer = { ok: boolean; checked: boolean }
export type Pending = AskOptions & { id: number; resolve: (a: Answer) => void }
export type Toast = { id: number; text: string; tone: Tone }

export const TOAST_MS = 5_000

let queue: Pending[] = []
let toasts: Toast[] = []
let seq = 0
const subs = new Set<() => void>()

function emit() { subs.forEach((f) => f()) }

export function subscribeDialogs(fn: () => void): () => void {
  subs.add(fn)
  return () => { subs.delete(fn) }
}

// une seule question affichée à la fois : les suivantes attendent leur tour
export function currentDialog(): Pending | null { return queue[0] ?? null }
export function getToasts(): Toast[] { return toasts }

export function ask(opts: AskOptions): Promise<Answer> {
  // double clic sur le même bouton : la question est déjà posée, on n'en empile pas une seconde
  if (queue.some((q) => q.title === opts.title && q.body === opts.body)) {
    return Promise.resolve({ ok: false, checked: false })
  }
  return new Promise((resolve) => {
    queue = [...queue, { ...opts, id: ++seq, resolve }]
    emit()
  })
}

export async function confirmDialog(opts: AskOptions): Promise<boolean> {
  return (await ask(opts)).ok
}

export function answerDialog(id: number, answer: Answer): void {
  const d = queue.find((q) => q.id === id)
  if (!d) return
  queue = queue.filter((q) => q.id !== id)
  d.resolve(answer)
  emit()
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

// message non bloquant (remplace window.alert)
export function toast(text: string, tone: Tone = 'ok'): number {
  const id = ++seq
  toasts = [...toasts, { id, text, tone }]
  emit()
  setTimeout(() => dismissToast(id), tone === 'crit' ? TOAST_MS * 2 : TOAST_MS)
  return id
}
