// Micro du chat Lyra : logique pure (choix du format, messages d'erreur, nettoyage du texte).
// L'enregistrement et le reseau sont dans components/micro/useMicro.ts.

export const MIN_MS = 500          // en dessous : appui involontaire, rien n'est envoye au serveur
export const MAX_MS = 30_000       // une commande vocale est courte
export const MAX_TEXT = 500

const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']

// Premier format que le navigateur sait enregistrer ('' = laisser le navigateur choisir).
export function pickMime(isSupported: (mime: string) => boolean): string {
  return MIMES.find((m) => { try { return isSupported(m) } catch { return false } }) ?? ''
}

export type Capability = { ok: true } | { ok: false; reason: string }

export type Env = {
  isSecureContext: boolean
  hasGetUserMedia: boolean
  hasRecorder: boolean
}

// Le micro n'existe qu'en contexte securise : localhost ou https. Sur http://<ip du tailnet> le navigateur
// masque getUserMedia, d'ou un message qui dit quoi faire plutot qu'un bouton mort.
export function capability(env: Env): Capability {
  if (!env.isSecureContext) return { ok: false, reason: 'micro indisponible en http : ouvre l’app via localhost ou en https' }
  if (!env.hasGetUserMedia) return { ok: false, reason: 'ce navigateur ne donne pas accès au micro' }
  if (!env.hasRecorder) return { ok: false, reason: 'ce navigateur ne sait pas enregistrer le son' }
  return { ok: true }
}

// Erreur de getUserMedia -> phrase pour l'utilisateur.
export function micError(name: string | undefined): string {
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'accès au micro refusé : autorise-le dans les réglages du navigateur (icône à gauche de l’adresse)'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'aucun micro détecté : branche-en un ou choisis-en un autre dans paramètres > audio'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'le micro est utilisé par une autre application'
    case 'AbortError':
      return 'enregistrement interrompu'
    default:
      return 'micro impossible à ouvrir'
  }
}

// Texte transcrit -> texte affiche : espaces regroupes, borne, ponctuation de fin superflue retiree.
export function cleanTranscript(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)
}

// Un texte part vers Lyra seulement s'il a du contenu et ne ressemble pas a une commande de chat (/...) :
// la dictee ne doit jamais declencher /mode performance par erreur de transcription.
export function sendable(text: string): { ok: boolean; reason: string } {
  const t = text.trim()
  if (!t) return { ok: false, reason: 'rien n’a été compris' }
  if (t.startsWith('/')) return { ok: false, reason: 'une commande « / » ne se dicte pas : tape-la au clavier' }
  return { ok: true, reason: '' }
}

export function tooShort(ms: number): boolean {
  return ms < MIN_MS
}
