// Ecran (VNC) et console serie d'une machine : logique pure, sans DOM ni reseau.
// Contrat (lyra-control-api) : GET /vms-console/{vm}/view dit ce que la machine expose ;
// les flux passent par deux WebSockets dont l'adresse porte un jeton court (30 s), jamais la cle API.

/** Reponse de GET /vms-console/{vm}/view. */
export type ViewRes = {
  success: boolean; state: string; display: 'vnc' | 'spice' | 'none'
  vnc: { host: string; port: number } | null; serial: boolean; reason: string
}
export type ViewKind = 'loading' | 'off' | 'paused' | 'spice' | 'none' | 'vnc' | 'unavailable'
export type ViewAction = 'to-vnc' | 'add-vnc' | 'connect'
export type Verdict = {
  kind: ViewKind; title: string; text: string
  action: ViewAction | null; actionLabel: string; actionOk: boolean; actionReason: string
}
export type StreamKind = 'vnc' | 'serial'

/** Codes de fermeture du pont WebSocket (lyra-control-api), traduits. */
export const CLOSE_CODES: Record<number, string> = {
  4401: 'jeton refusé ou expiré (30 s) : réessaie',
  4404: 'machine inconnue de l\'API',
  4409: 'une vue de ce type est déjà ouverte sur cette machine (ailleurs ou dans un autre onglet)',
  4503: 'machine éteinte, sans VNC local, serveur VNC injoignable ou console série impossible',
  1009: 'trame trop grande : le pont a coupé',
  1000: 'fin normale (inactivité de 10 minutes ou processus terminé)',
  1006: 'connexion perdue',
}
/** Jeton absent, faux, consomme ou nom invalide : le pont ferme AVANT d'accepter, le navigateur ne voit qu'une poignee
 *  de main echouee (error puis close 1006, jamais ouvert). */
export const REFUSED_AT_OPEN = 'connexion impossible : jeton refusé ou expiré (30 s), ou API injoignable'

/** Phrase pour une fermeture : un flux jamais ouvert = refus a l'ouverture ; sinon code du pont ; sinon propre / brutale. */
export function closeReason(code: number | null | undefined, clean = true, opened = true): string {
  if (!opened) return REFUSED_AT_OPEN
  if (code != null && CLOSE_CODES[code]) return CLOSE_CODES[code]
  if (code != null && code >= 4000) return `connexion refusée (${code})`
  return clean ? 'déconnecté' : 'connexion perdue'
}

/** Etat normalise : le hub dit `stopped`, GET /view rend `shut off` (etat brut de virsh) ou `running`. */
export function normalizeState(s: string): string {
  const t = s.trim().toLowerCase()
  if (t === 'shut off' || t === 'shutoff' || t === 'stopped' || t === 'ferme' || t === 'fermé') return 'stopped'
  if (t === 'paused' || t === 'en pause') return 'paused'
  if (t === 'running' || t === 'actif') return 'running'
  return t
}

/** Adresse du flux : meme hote et meme port que les appels HTTP (http -> ws, https -> wss), chemin de l'API a la racine
 *  (les appels HTTP sont absolus : `/vms-console/...`, meme quand la page est servie sous /app/). `base` est l'origine de la page
 *  (`location.origin`) ou une adresse complete : seul son origine compte. */
export function wsUrl(base: string, vm: string, kind: StreamKind, token: string): string {
  let origin = base.trim()
  try { origin = new URL(base).origin } catch { origin = origin.replace(/\/+$/, '') }
  const ws = origin.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
  return `${ws}/vms-console/${encodeURIComponent(vm)}/${kind}?token=${encodeURIComponent(token)}`
}

const RUNNING = 'running'
const STOPPED = 'stopped'
const NEEDS_STOP = 'arrête la machine d\'abord : l\'affichage fait partie de sa définition, il ne se remplace pas à chaud'

/** Ce que l'onglet « écran » montre et pourquoi. `state` = etat vu par le hub (running, paused, stopped...), qui l'emporte
 *  sur `view.state` (plus frais). L'affichage decide d'abord (une machine SPICE arretee doit pouvoir passer en VNC). */
export function viewVerdict(view: ViewRes | null, state: string): Verdict {
  const none = { action: null, actionLabel: '', actionOk: false, actionReason: '' }
  if (!view) return { kind: 'loading', title: 'lecture…', text: 'on demande à l\'API ce que la machine expose.', ...none }
  const st = normalizeState(state || view.state)
  if (view.display === 'spice' || view.display === 'none') {
    const spice = view.display === 'spice'
    const stopped = st === STOPPED
    return {
      kind: spice ? 'spice' : 'none',
      title: spice ? 'affichage SPICE' : 'aucun affichage',
      text: spice
        ? 'Cette machine expose sa console en SPICE, que le navigateur ne sait pas afficher. Un client VNC (noVNC) tourne dans la page : passe l\'affichage en VNC, puis démarre la machine.'
        : 'Cette machine n\'a pas de carte graphique virtuelle : rien à montrer. Ajoute un affichage VNC, puis démarre-la ; la console série reste possible.',
      action: spice ? 'to-vnc' : 'add-vnc', actionLabel: spice ? 'passer en VNC' : 'ajouter un affichage VNC',
      actionOk: stopped, actionReason: stopped ? '' : NEEDS_STOP,
    }
  }
  if (st === STOPPED) return { kind: 'off', title: 'machine éteinte', text: 'démarre-la pour la voir.', ...none }
  if (st === 'paused') return { kind: 'paused', title: 'machine en pause', text: 'l\'image est figée : reprends-la pour agir.', ...none }
  if (st !== RUNNING && st !== 'starting') return { kind: 'unavailable', title: 'écran indisponible', text: view.reason || `état « ${st} » : rien à afficher.`, ...none }
  if (!view.vnc) return { kind: 'unavailable', title: 'écran indisponible', text: view.reason || 'la machine tourne mais l\'API ne trouve pas son port VNC.', ...none }
  return {
    kind: 'vnc', title: 'écran VNC', text: 'La connexion est exclusive et le jeton court : on se connecte à la demande.',
    action: 'connect', actionLabel: 'se connecter', actionOk: true, actionReason: '',
  }
}

export type Size = { w: number; h: number }
export type Fit = { scale: number; w: number; h: number }

/** Echelle qui fait tenir `remote` dans `container` en gardant les proportions. Par defaut on ne grossit jamais
 *  (un bureau 800x600 reste net) ; `upscale` l'autorise (plein ecran). Tailles nulles : echelle 1, rien a dessiner. */
export function scaleFor(container: Size, remote: Size, upscale = false): Fit {
  if (container.w <= 0 || container.h <= 0 || remote.w <= 0 || remote.h <= 0) return { scale: 1, w: 0, h: 0 }
  let scale = Math.min(container.w / remote.w, container.h / remote.h)
  if (!upscale) scale = Math.min(1, scale)
  return { scale, w: Math.round(remote.w * scale), h: Math.round(remote.h * scale) }
}

/** Message `resize` envoye en texte sur la console serie (le reste du flux est binaire). */
export const resizeMessage = (cols: number, rows: number): string => JSON.stringify({ resize: [Math.max(1, Math.floor(cols)), Math.max(1, Math.floor(rows))] })

/** Etat de connexion affiche a l'utilisateur. */
export type Link = { st: 'idle' | 'connecting' | 'connected' | 'closed'; detail: string }
export const LINK_LABEL: Record<Link['st'], string> = { idle: 'déconnecté', connecting: 'connexion…', connected: 'connecté', closed: 'déconnecté' }
