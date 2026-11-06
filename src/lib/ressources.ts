// Ressources de la machine : types, mise en forme et géométrie des courbes (logique pure, testée).

export type Point = {
  t: number; cpu?: number; ram?: number; swap?: number; tcpu?: number; tnvme?: number; tgpu?: number
  gpu?: number; vram?: number; gw?: number; rx?: number; tx?: number; d?: Record<string, number>
}
export type Resume = { min: number; moy: number; max: number; dernier: number } | null
export type Courbes = { points: Point[]; resume: Record<string, Resume>; echantillon_s: number; nombre: number }
export type Seuil = { warn: number; crit: number }
export type Seuils = { actif: boolean; soutenu: number } & Record<string, Seuil | boolean | number>
export type Alerte = { key: string; level: 'warn' | 'crit'; title: string; detail: string }
export type Metrique = { libelle: string; unite: string; max: number }
export type Maintenant = { point: Point; seuils: Seuils; alertes: Alerte[]; metriques: Record<string, Metrique> }

export type Gpu = {
  nom: string; vram_utilisee: number; vram_total: number; vram_pct: number
  utilisation: number | null; utilisation_memoire: number | null; temperature: number | null
  puissance: number | null; puissance_max: number | null
  horloge_sm: number | null; horloge_sm_max: number | null; horloge_mem: number | null; horloge_mem_max: number | null
  ventilateur: number | null; pstate: string
}
export type ProcGpu = { pid: number; vram: number; nom: string; proprietaire: string }
export type Occupation = { proprietaire: string; libelle: string; vram: number }
export type ModeleOllama = {
  nom: string; taille: number; vram: number; sur_gpu_pct: number; parametres: string; quantification: string; expire: string
}
export type GpuDetail = {
  gpu: Gpu | null; processus: ProcGpu[]; occupation: Occupation[]; ollama: { modeles: ModeleOllama[]; erreur: string }
}

export type Plage = { id: string; label: string; heures: number }
export const PLAGES: Plage[] = [
  { id: '1h', label: '1 h', heures: 1 }, { id: '6h', label: '6 h', heures: 6 }, { id: '24h', label: '24 h', heures: 24 },
]

export type SerieDef = { champ: keyof Point & string; label: string; couleur: string }
export type GroupeDef = {
  id: string; titre: string; unite: '%' | '°C' | 'o/s'; max?: number; series: SerieDef[]
  /** métriques de seuil à tracer en pointillés */ seuils?: string[]
}
export const GROUPES: GroupeDef[] = [
  { id: 'cpu', titre: 'processeur', unite: '%', max: 100, series: [{ champ: 'cpu', label: 'charge', couleur: 'var(--gold)' }], seuils: ['cpu'] },
  { id: 'memoire', titre: 'mémoire vive et swap', unite: '%', max: 100,
    series: [{ champ: 'ram', label: 'ram', couleur: 'var(--rose)' }, { champ: 'swap', label: 'swap', couleur: 'var(--warn)' }], seuils: ['ram'] },
  { id: 'temp', titre: 'températures', unite: '°C',
    series: [{ champ: 'tcpu', label: 'processeur', couleur: 'var(--gold)' }, { champ: 'tnvme', label: 'nvme', couleur: 'var(--ok)' },
      { champ: 'tgpu', label: 'carte graphique', couleur: 'var(--rose)' }], seuils: ['tcpu'] },
  { id: 'reseau', titre: 'réseau', unite: 'o/s',
    series: [{ champ: 'rx', label: 'reçu', couleur: 'var(--ok)' }, { champ: 'tx', label: 'émis', couleur: 'var(--gold)' }] },
  { id: 'gpu', titre: 'carte graphique', unite: '%', max: 100,
    series: [{ champ: 'gpu', label: 'charge', couleur: 'var(--gold)' }, { champ: 'vram', label: 'mémoire', couleur: 'var(--rose)' }], seuils: ['vram'] },
]

// --- mise en forme -------------------------------------------------------------------------------

export function fmtDebit(octetsParSeconde: number): string {
  const n = Math.max(0, octetsParSeconde)
  if (n < 1024) return `${Math.round(n)} o/s`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0).replace('.', ',')} Ko/s`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(n < 10 * 1024 ** 2 ? 1 : 0).replace('.', ',')} Mo/s`
  return `${(n / 1024 ** 3).toFixed(1).replace('.', ',')} Go/s`
}

export function fmtValeur(v: number | null | undefined, unite: string): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (unite === 'o/s') return fmtDebit(v)
  return `${Math.round(v * 10) / 10} ${unite}`.replace('.', ',')
}

export function fmtOctets(n: number): string {
  if (n < 1024 ** 2) return `${Math.round(n / 1024)} Ko`
  if (n < 1024 ** 3) return `${Math.round(n / 1024 ** 2)} Mo`
  return `${(n / 1024 ** 3).toFixed(1).replace('.', ',')} Go`
}

/** Teinte d'une valeur par rapport à son seuil ; sans seuil, neutre. */
export function ton(valeur: number | null | undefined, s: Seuil | undefined): 'ok' | 'warn' | 'crit' {
  if (valeur == null || !s) return 'ok'
  return valeur >= s.crit ? 'crit' : valeur >= s.warn ? 'warn' : 'ok'
}

export function seuilDe(seuils: Seuils | undefined, cle: string): Seuil | undefined {
  const s = seuils?.[cle]
  return s && typeof s === 'object' ? s : undefined
}

/** Écart entre la VRAM utilisée et celle attribuée aux processus listés (nvidia-smi ne liste pas tout). */
export function nonAttribue(gpu: Gpu | null, processus: ProcGpu[], occupation: Occupation[]): number {
  if (!gpu) return 0
  const connu = occupation.length ? occupation.reduce((s, o) => s + o.vram, 0) : processus.reduce((s, p) => s + p.vram, 0)
  return Math.max(0, gpu.vram_utilisee - connu)
}

export function libelleHeure(t: number, heures: number): string {
  const d = new Date(t * 1000)
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return heures > 24 ? `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${hm}` : hm
}

// --- géométrie des courbes -----------------------------------------------------------------------

export type Echelle = { t0: number; t1: number; max: number; w: number; h: number }

/** Plafond de l'axe : fixe si demandé, sinon la plus grande valeur arrondie vers le haut (jamais 0). */
export function plafond(points: Point[], champs: string[], fixe?: number): number {
  if (fixe) return fixe
  let m = 0
  for (const p of points) for (const c of champs) { const v = p[c as keyof Point]; if (typeof v === 'number' && v > m) m = v }
  if (m <= 0) return 1
  const pas = 10 ** Math.floor(Math.log10(m))
  return Math.ceil(m / pas) * pas
}

/** Chemin SVG d'une série : une valeur absente coupe la ligne (pas de pont sur un trou de mesure). */
export function chemin(points: Point[], champ: string, e: Echelle): string {
  const span = e.t1 - e.t0 || 1
  let d = '', pose = false
  for (const p of points) {
    const v = p[champ as keyof Point]
    if (typeof v !== 'number' || !Number.isFinite(v)) { pose = false; continue }
    const x = ((p.t - e.t0) / span) * e.w
    const y = e.h - Math.min(Math.max(v / e.max, 0), 1) * e.h
    d += `${pose ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    pose = true
  }
  return d
}

/** Point le plus proche d'une abscisse (0..w), pour l'infobulle. */
export function procheDe(points: Point[], x: number, e: Echelle): Point | null {
  if (!points.length) return null
  const t = e.t0 + (x / e.w) * (e.t1 - e.t0)
  let best = points[0]
  for (const p of points) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p
  return best
}

// --- filtres mémorisés ---------------------------------------------------------------------------

export type Filtres = { plage: string; masquees: string[]; seuils: boolean }
export const FILTRES_DEFAUT: Filtres = { plage: '24h', masquees: [], seuils: true }
export const CLE_FILTRES = 'neutroncore_ressources_filtres'

export function lireFiltres(brut: string | null): Filtres {
  try {
    const o = JSON.parse(brut ?? '') as Partial<Filtres>
    return {
      plage: PLAGES.some((p) => p.id === o.plage) ? (o.plage as string) : FILTRES_DEFAUT.plage,
      masquees: Array.isArray(o.masquees) ? o.masquees.filter((x) => typeof x === 'string') : [],
      seuils: typeof o.seuils === 'boolean' ? o.seuils : true,
    }
  } catch { return { ...FILTRES_DEFAUT } }
}

/** Ajoute ou retire un élément sans muter la liste. */
export function basculer(liste: string[], id: string): string[] {
  return liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]
}
