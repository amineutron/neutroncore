// Regles d'eligibilite des actions hors ligne : LISTE FERMEE.
// Une action n'est mise en file que si elle est non destructive ET idempotente
// (rejouer deux fois = meme resultat). Tout le reste est refuse avec une phrase,
// jamais mis en file : un ordre « allume la tele » rejoue une heure plus tard
// serait une surprise, une suppression rejouee un accident.

export type Verdict =
  | { kind: 'queue'; key: string }
  | { kind: 'refuse'; reason: string }

type Rule = { method: 'PUT' | 'POST'; re: RegExp; /** PUT = etat complet : le dernier remplace les precedents */ replace: boolean }

// Ajouter une action rejouable = une ligne ici (et rien d'autre).
export const QUEUEABLE: readonly Rule[] = [
  { method: 'PUT', re: /^\/launcher\/favorites$/, replace: true },
  { method: 'PUT', re: /^\/launcher\/sessions\/notif-settings$/, replace: true },
  { method: 'PUT', re: /^\/branches\/reglages$/, replace: true },
  { method: 'PUT', re: /^\/lyra\/settings$/, replace: true },
  { method: 'POST', re: /^\/notifications\/read$/, replace: false },
  { method: 'POST', re: /^\/requests\/declined-auto\/[\w-]+\/hide$/, replace: false },
]

export const MAX_BODY_CHARS = 20_000

export const REASON_CONFIRM =
  'cette action demande une confirmation : elle ne peut pas attendre le retour du réseau'
export const REASON_DELETE = 'une suppression ne peut pas attendre le retour du réseau'
export const REASON_LIVE =
  'cette action agit en direct sur un appareil ou un service : elle n’est pas possible hors ligne'
export const REASON_BIG = 'cette demande est trop volumineuse pour être gardée hors ligne'

/** Chemin sans query ni fragment ; null si suspect. */
export function cleanPath(path: string): string | null {
  const p = path.split(/[?#]/)[0]
  if (!p.startsWith('/') || p.includes('..') || p.includes('//')) return null
  return p
}

function hasConfirm(extra?: Record<string, string>): boolean {
  return !!extra && Object.keys(extra).some((k) => k.toLowerCase() === 'x-confirm')
}

export function classify(
  method: string,
  path: string,
  body?: unknown,
  extra?: Record<string, string>,
): Verdict {
  const m = method.toUpperCase()
  if (hasConfirm(extra)) return { kind: 'refuse', reason: REASON_CONFIRM }
  if (m === 'DELETE') return { kind: 'refuse', reason: REASON_DELETE }
  const p = cleanPath(path)
  const rule = p && QUEUEABLE.find((r) => r.method === m && r.re.test(p))
  if (!p || !rule) return { kind: 'refuse', reason: REASON_LIVE }
  let json = ''
  try {
    json = body === undefined ? '' : JSON.stringify(body)
  } catch {
    return { kind: 'refuse', reason: REASON_LIVE }
  }
  if (json.length > MAX_BODY_CHARS) return { kind: 'refuse', reason: REASON_BIG }
  // PUT : un seul element par chemin (le dernier gagne). POST : un par corps distinct.
  return { kind: 'queue', key: rule.replace ? `${m} ${p}` : `${m} ${p} ${json}` }
}
