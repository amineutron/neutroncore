// Surveillance réseau : types de l'API et logique pure (formats, filtres, courbes).

export type Appareil = {
  mac: string; ip: string; fabricant: string; present: boolean; etat: string
  connu: boolean; nom: string; etiquette: string; passerelle: boolean
  premiere_vue: number; derniere_vue: number; aleatoire: boolean
  // ajoutés par l'API : absents d'une vieille réponse, d'où optionnels
  ips?: string[]; hote?: string; categorie?: Categorie; inconnu?: boolean
}
export type Categorie = '' | 'hote' | 'passerelle' | 'passerelle_secondaire' | 'prive'
export type Reglages = { alerte: boolean; cible_internet: string; ignorer_interfaces: string[]; resoudre_noms?: boolean }
export type EtatReseau = {
  appareils: Appareil[]
  resume: { presents: number; inconnus: number; connus_absents: number; total: number; prives?: number }
  reglages: Reglages; interface: string; oui_charge: boolean; cible_internet_defaut: string
}
export type Pair = {
  nom: string; os: string; en_ligne: boolean; derniere_vue: number | null; ips: string[]
  relais: string; direct: boolean; sortie: boolean; soi: boolean; etiquettes: string[]; actif: boolean
}
export type Tailnet = { etat: string; nom: string; pairs: Pair[]; en_ligne: number }
export type Ping = { min: number | null; moy: number | null; max: number | null; gigue: number | null; perte: number }
export type Point = { t: number; rx: number | null; tx: number | null; passerelle_ms: number | null; internet_ms: number | null }
export type Liens = {
  interface: string; debit: { rx: number | null; tx: number | null }
  passerelle: Partial<Ping>; internet: Partial<Ping>
  cible_internet: string; historique: Point[]
}

export const ETIQUETTES = ['téléphone', 'ordinateur', 'tv', 'enceinte', 'lampe', 'imprimante', 'console', 'invité', 'box']

export type Filtres = { inconnus: boolean; presents: boolean; masquerAleatoires: boolean; recherche: string }
export const FILTRES_DEFAUT: Filtres = { inconnus: false, presents: false, masquerAleatoires: false, recherche: '' }
const CLE = 'neutroncore_reseau_filtres'

export function lireFiltres(storage: Pick<Storage, 'getItem'> | null): Filtres {
  try {
    const brut = JSON.parse(storage?.getItem(CLE) ?? '{}') as Partial<Filtres>
    return {
      inconnus: brut.inconnus === true, presents: brut.presents === true,
      masquerAleatoires: brut.masquerAleatoires === true, recherche: typeof brut.recherche === 'string' ? brut.recherche.slice(0, 60) : '',
    }
  } catch { return FILTRES_DEFAUT }
}

export function ecrireFiltres(storage: Pick<Storage, 'setItem'> | null, f: Filtres): void {
  try { storage?.setItem(CLE, JSON.stringify(f)) } catch { /* stockage indisponible : le filtre ne survit pas, rien d'autre */ }
}

// vraiment inconnu : ni marqué par l'utilisateur, ni expliqué (box, hôte, adresse privée).
// Une vieille réponse sans le champ retombe sur « pas marqué connu ».
export function estInconnu(a: Appareil): boolean {
  return a.inconnu ?? !a.connu
}

const CATEGORIES: Record<string, string> = {
  passerelle: 'passerelle', passerelle_secondaire: 'interface de la passerelle',
  hote: 'ce pc', prive: 'adresse privée (probablement un téléphone)',
}
export function libelleCategorie(a: Appareil): string {
  return CATEGORIES[a.categorie ?? ''] ?? ''
}

export function filtrer(liste: Appareil[], f: Filtres): Appareil[] {
  const q = f.recherche.trim().toLowerCase()
  return liste.filter((a) => {
    if (f.inconnus && !estInconnu(a)) return false
    if (f.presents && !a.present) return false
    if (f.masquerAleatoires && a.aleatoire && !a.connu) return false
    if (!q) return true
    return [a.nom, a.hote ?? '', a.etiquette, a.fabricant, a.ip, a.mac].some((t) => t.toLowerCase().includes(q))
  })
}

export function titreAppareil(a: Appareil): string {
  return a.nom || a.hote || a.fabricant || (a.aleatoire ? 'appareil (adresse privée)' : 'appareil inconnu')
}

// octets/s -> « 1,5 Ko/s » ; null = pas encore de mesure
export function fmtDebit(bps: number | null | undefined): string {
  if (bps == null || !isFinite(bps)) return '—'
  const u = ['o/s', 'Ko/s', 'Mo/s', 'Go/s']
  let v = Math.max(0, bps), i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1).replace('.', ',')} ${u[i]}`
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—'
  return `${ms >= 100 ? ms.toFixed(0) : ms.toFixed(1).replace('.', ',')} ms`
}

export function toneLatence(p: Partial<Ping> | undefined, seuilWarn = 60, seuilCrit = 200): 'ok' | 'warn' | 'crit' {
  if (!p || p.perte === undefined) return 'warn'
  if (p.perte >= 100 || (p.moy ?? 0) >= seuilCrit) return 'crit'
  if (p.perte > 0 || (p.moy ?? 0) >= seuilWarn) return 'warn'
  return 'ok'
}

// date de dernière vue (secondes epoch) -> phrase ; null = jamais
export function vuIl(ts: number | null | undefined, now = Date.now() / 1000): string {
  if (!ts) return 'jamais vu'
  const s = Math.max(0, now - ts)
  if (s < 90) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  return `il y a ${Math.round(s / 86400)} j`
}

// trace SVG d'une série (valeurs nulles = trou), mise à l'échelle 0..max dans w x h
export function courbe(valeurs: Array<number | null>, w: number, h: number, maxi?: number): string {
  const vals = valeurs.filter((v): v is number => v != null)
  if (vals.length < 2) return ''
  const top = Math.max(maxi ?? 0, ...vals, 1e-9)
  const n = valeurs.length - 1
  let d = '', pen = false
  valeurs.forEach((v, i) => {
    if (v == null) { pen = false; return }
    const x = (i / n) * w, y = h - (v / top) * h
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `
    pen = true
  })
  return d.trim()
}

export function phraseResume(r: EtatReseau['resume']): string {
  if (!r.total) return 'aucun appareil vu pour l’instant'
  const inc = r.inconnus ? `, ${r.inconnus} inconnu${r.inconnus > 1 ? 's' : ''}` : ''
  const pri = r.prives ? `, ${r.prives} adresse${r.prives > 1 ? 's' : ''} privée${r.prives > 1 ? 's' : ''}` : ''
  return `${r.presents} en ligne${inc}${pri}`
}
