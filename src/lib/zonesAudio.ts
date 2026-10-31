// Sonorisation multi-pièces : types et règles pures côté écran (miroir des plafonds de lib/zones_audio.py).

export type Zone = { id: string; nom: string; appareil: string; groupe: boolean; volume_max: number; volume: number; appareils?: string[] }
export type Scene = { id: string; nom: string; volumes: Record<string, number> }
export type Zones = {
  zones: Zone[]; scenes: Scene[]; multi_appareil: boolean; plafond: number; pilotables: string[]; ecartes: string[]
}
export type Resultat = { zone: string; appareil?: string | null; success: boolean; niveau: number | null; plafonne: boolean; error: string | null }
export type Retour = { success: boolean; resultats: Resultat[]; refus: { zone: string; appareil?: string; raison: string }[] }

/** Volume retenu pour une consigne : jamais au-dessus du maximum de la zone ni du plafond général. */
export function niveauRetenu(zone: Zone, voulu: number, plafond: number): number {
  return Math.max(0, Math.min(Math.round(voulu), zone.volume_max, plafond))
}

/** Une zone avec un appareil nommé n'est pilotable que si le serveur catt sait viser un appareil. */
export function pilotable(zone: Zone, multi: boolean): boolean {
  return !zone.appareil || multi
}

/** Phrase de retour d'une commande de volume : ce qui est passé, plafonné ou refusé. */
export function bilanVolumes(r: Retour, noms: Record<string, string>): string {
  const nom = (id: string) => noms[id] ?? id
  const ok = r.resultats.filter((x) => x.success).map((x) => `${nom(x.zone)} ${x.niveau}${x.plafonne ? ' (plafonné)' : ''}`)
  const ko = [...r.resultats.filter((x) => !x.success).map((x) => `${nom(x.zone)} : ${x.error}`), ...r.refus.map((x) => `${nom(x.zone)} : ${x.raison}`)]
  return [ok.length ? `volume réglé : ${ok.join(', ')}` : '', ...ko].filter(Boolean).join(' · ')
}

/** Scène : volumes de départ d'une zone nouvellement ajoutée = son volume habituel. */
export function volumesHabituels(zones: Zone[]): Record<string, number> {
  return Object.fromEntries(zones.map((z) => [z.id, z.volume]))
}

// --- appareils audio présents (GET /zones-audio/appareils) ---

export type TypeAppareil = 'denon' | 'chromecast' | 'pc' | 'tv'
export type Appareil = { id: string; type: TypeAppareil; nom: string; hote: string; etat: string; detail: string; volume: number | null; pilotable: boolean }
export type Appareils = { appareils: Appareil[]; vide: boolean; manques: TypeAppareil[]; reseau_lu: boolean }

export const TYPES: Record<TypeAppareil, { label: string; indice: string }> = {
  denon: { label: 'ampli', indice: 'ton ampli denon : allume-le et vérifie que le démon lyra le voit (outil denon)' },
  chromecast: { label: 'enceinte chromecast', indice: 'aucune enceinte google vue sur le réseau : branche-la au wifi, puis ouvre l’écran réseau pour la nommer' },
  tv: { label: 'télé', indice: 'la télé philips ne répond pas : allume-la ou vérifie pylips' },
  pc: { label: 'sortie du pc', indice: 'aucune sortie audio lue sur ce pc (pactl)' },
}

/** Ids cochés d'une zone : les nouvelles zones listent leurs cartes ; une ancienne zone n'en a aucune. */
export function cartesDe(zone: Zone): string[] {
  return zone.appareils ?? []
}

export function basculer(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

export function nomsAppareils(ids: string[], liste: Appareil[]): string[] {
  return ids.map((id) => liste.find((a) => a.id === id)?.nom ?? 'appareil absent')
}

/** Les cartes cochées d'une zone qui ne sont plus vues (signalées, jamais retirées en silence). */
export function absents(ids: string[], liste: Appareil[]): string[] {
  return ids.filter((id) => !liste.some((a) => a.id === id))
}

/** Ce que la zone sait régler d'ici : l'ampli, et les enceintes si le serveur catt sait viser un appareil. */
export function reglables(ids: string[], liste: Appareil[], multi: boolean): string[] {
  return ids.filter((id) => (id === 'denon' ? liste.some((a) => a.id === id) : id.startsWith('cast:') && multi))
}

/** Aperçu en phrase d'une scène : « ambiance soirée : salon 35 %, cuisine 20 % ». */
export function phraseScene(nom: string, volumes: Record<string, number>, noms: Record<string, string>): string {
  const parts = Object.entries(volumes).map(([id, v]) => `${noms[id] ?? id} ${v} %`)
  return parts.length ? `${nom} : ${parts.join(', ')}` : `${nom} : aucune zone choisie`
}

/** Ajoute ou retire une zone d'une scène (volume de départ = son volume habituel, borné à son maximum). */
export function sceneAvec(volumes: Record<string, number>, zone: Zone, inclure: boolean): Record<string, number> {
  const { [zone.id]: _retiree, ...reste } = volumes
  return inclure ? { ...reste, [zone.id]: Math.min(zone.volume, zone.volume_max) } : reste
}

export function etatTon(etat: string): 'ok' | 'warn' | 'crit' | undefined {
  if (['allume', 'en_ligne', 'joue'].includes(etat)) return 'ok'
  if (['injoignable', 'absent'].includes(etat)) return 'crit'
  return etat === 'veille' || etat === 'disponible' ? undefined : 'warn'
}

export const ETATS: Record<string, string> = {
  allume: 'allumé', veille: 'en veille', en_ligne: 'en ligne', absent: 'absent', injoignable: 'injoignable', joue: 'en lecture', disponible: 'disponible',
}
