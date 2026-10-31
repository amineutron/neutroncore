// Mise en forme de l'age d'une donnee. Arrondi vers le HAUT (jamais « plus frais »
// que la realite) : 59 s -> « moins d'une minute », 61 s -> « 2 min ».

export function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return 'moins d’une minute'
  const min = Math.ceil(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.ceil(min / 60)
  if (h < 48) return `${h} h`
  return `${Math.ceil(h / 24)} j`
}

export function offlineLabel(staleSince: number | null, now: number): string {
  if (staleSince === null) return 'hors ligne — aucune donnée gardée pour cet écran'
  return `hors ligne — données d’il y a ${formatAge(now - staleSince)}`
}

export function pendingLabel(n: number): string {
  return n === 1 ? '1 action en attente' : `${n} actions en attente`
}
