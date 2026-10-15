// Caméra avec détourage : types et mises en forme (logique pure). Les réglages vivent côté API
// (lib/camera.py), qui les borne ; l'écran ne fait que les montrer et les envoyer.

export type FondMode = 'aucun' | 'flou' | 'prefait' | 'fichier'
export type Reglages = {
  fond: { mode: FondMode; nom: string; flou: number }
  detourage: { durete: number; marge: number; stabilite: number }
  veille: boolean
  modele: 'auto' | 'rvm' | 'deeplab'
  virtuelle: boolean        // l'image est publiée comme une caméra de l'ordinateur
  cadence: 30 | 60
}
export type Moteur = {
  actif: boolean; demarre: boolean; phase?: string | null; fps?: number | null; ms_detourage?: number | null
  modele?: string | null; note?: string | null; erreur?: string | null; vram_mo?: number | null; depuis?: number | null
  fps_webcam?: number | null; ms_tour?: number | null; ecart_max_ms?: number | null; virtuelle?: boolean | null; sortie_erreur?: string | null
}
export type FondImporte = { nom: string; genre: 'image' | 'video'; taille: number }
export type Prefait = { nom: string; label: string; couleurs: [string, string]; angle: number }
export type Camera = { installee?: boolean; moteur: Moteur; reglages: Reglages; fonds: FondImporte[]; prefaits: Prefait[]; limites: { taille_fond: number; formats: string[] } }

/** État de la caméra en un mot et un ton, pour l'en-tête de l'écran. */
export function etatCamera(m: Moteur | undefined, veille: boolean): { texte: string; tone: 'ok' | 'warn' | 'crit' | 'off' } {
  if (!m) return { texte: '…', tone: 'off' }
  if (m.erreur && !m.actif) return { texte: 'en erreur', tone: 'crit' }
  if (m.actif) return veille ? { texte: 'en veille', tone: 'warn' } : { texte: 'allumée', tone: 'ok' }
  if (m.demarre) return { texte: 'démarre…', tone: 'warn' }
  return { texte: 'éteinte', tone: 'off' }
}

/** Dégradé CSS d'un fond préfait : le même que celui que dessine le moteur. */
export function degradeCss(p: Pick<Prefait, 'couleurs' | 'angle'>): string {
  return `linear-gradient(${p.angle}deg, ${p.couleurs[0]}, ${p.couleurs[1]})`
}

export function tailleLisible(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`
  return `${(octets / 1024 / 1024).toFixed(octets < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',')} Mo`
}

/** Ce que veut dire la valeur d'un curseur de détourage, en mots. */
export function motDurete(v: number): string { return v < 25 ? 'très doux' : v < 50 ? 'doux' : v < 75 ? 'net' : 'très net' }
export function motMarge(v: number): string { return v === 0 ? 'au ras' : v < 0 ? `rogné de ${-v} px` : `élargi de ${v} px` }
export function motStabilite(v: number): string { return v < 20 ? 'réactif' : v < 60 ? 'équilibré' : 'très stable (traîne un peu)' }

/** Phrase d'état du moteur : cadence, coût du détourage, modèle. Vide tant qu'il n'a rien mesuré. */
export function mesures(m: Moteur): string {
  if (!m.actif) return m.demarre ? (m.phase ?? 'démarrage') : ''
  const modele = m.modele === 'rvm' ? 'modèle fin' : m.modele === 'deeplab' ? 'modèle de repli' : ''
  return [m.fps ? `${Math.round(m.fps)} images/s` : '', m.ms_detourage ? `détourage ${Math.round(m.ms_detourage)} ms` : '', modele,
    m.vram_mo ? `${m.vram_mo} Mo de carte graphique` : ''].filter(Boolean).join(' · ')
}

/** Le fichier choisi peut-il être envoyé ? Rend la raison du refus, ou ''. */
export function refusFond(nom: string, taille: number, limites: Camera['limites']): string {
  const ext = nom.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? ''
  if (!limites.formats.includes(ext)) return 'format refusé : image (png, jpg, webp) ou vidéo (mp4, webm, mkv, mov)'
  if (taille > limites.taille_fond) return `fichier trop lourd (${tailleLisible(limites.taille_fond)} au plus)`
  return ''
}
