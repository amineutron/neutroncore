// Tableau de bord des sauvegardes : types de GET /sauvegardes et logique pure de l'écran.

export type Tendance = { sens: 'hausse' | 'baisse' | 'stable' | 'inconnue'; pct: number | null }
export type Espace = { montage: string; total: number; utilise: number; libre: number; libre_pct: number | null }
export type Durees = { moyenne_s: number | null; max_s: number | null; tendance: Tendance }
export type Planif = { unite?: { state?: string; last_run?: string | null; result?: string | null }; minuteur_actif?: boolean; prochain?: string | null }

export type Snapshot = {
  nom: string; ts: number; etiquette: string; commentaire: string
  fichiers: number | null; taille: number | null; transfere: number | null; duree_s: number | null
}
export type Archive = {
  archive: string; debut: string; fin?: string; duree_s?: number | null; fichiers?: number | null
  original?: number | null; compresse?: number | null; nouveau?: number | null
}
export type Alerte = { kind: string; key: string; level: 'warn' | 'crit'; title: string; detail: string; action: string }
export type Controle = { nom: string; ok: boolean; ignore: boolean }
export type Verif = { ts: number; niveau: 'rapide' | 'profond'; ok: boolean; duree_s: number; controles: Controle[]; extrait: string }
export type Travail = {
  actif: { genre: string; libelle: string; debut: number } | null
  dernier: { genre: string; libelle: string; debut: number; fin: number; ok: boolean; erreur: string | null; extrait: string } | null
}
export type Reglages = { timeshift_max_h: number; borg_max_j: number; verif_max_j: number; liste_max: number }
type Base = { total: number; dernier_ts: number | null; age_jours: number | null; duree: Durees; espace: Espace | null; planification: Planif; taille_tendance: Tendance }
export type VueTimeshift = Base & { liste: Snapshot[]; regulier: number }
export type VueBorg = Base & {
  liste: Archive[]; nouveau_tendance: Tendance
  depot: { depot_total: number | null; depot_compresse: number | null; depot_dedup: number | null } | null
}
export type Tableau = {
  maintenant: number; timeshift: VueTimeshift; borg: VueBorg
  verification: { derniere: Verif | null; historique: Verif[]; age_jours: number | null }
  alertes: Alerte[]; reglages: Reglages; travail: Travail
}

export type Source = 'tous' | 'timeshift' | 'borg'
export type Periode = 'tout' | '7' | '30' | '90'
export type Tri = 'recent' | 'taille' | 'duree'
export type Filtres = { source: Source; periode: Periode; tri: Tri; etiquette: string }
export const FILTRES_DEFAUT: Filtres = { source: 'tous', periode: '30', tri: 'recent', etiquette: 'toutes' }

/** Ligne commune de l'historique, quelle que soit la source. */
export type Ligne = { id: string; source: 'timeshift' | 'borg'; ts: number; nom: string; etiquette: string; taille: number | null; neuf: number | null; duree_s: number | null; fichiers: number | null }

export function fmtDuree(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '-'
  if (s < 60) return `${Math.round(s)} s`
  const min = Math.floor(s / 60)
  if (min < 60) return `${min} min ${String(Math.round(s % 60)).padStart(2, '0')} s`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

export function fmtAge(jours: number | null | undefined): string {
  if (jours == null) return 'jamais'
  if (jours < 1 / 24) return 'à l’instant'
  if (jours < 1) return `il y a ${Math.round(jours * 24)} h`
  return `il y a ${Math.round(jours)} j`
}

/** Teinte de l'âge d'une sauvegarde par rapport à sa limite (en jours) : au-delà du double, critique. */
export function tonAge(age: number | null, limiteJours: number): 'ok' | 'warn' | 'crit' {
  if (age == null || age > 2 * limiteJours) return 'crit'
  return age > limiteJours ? 'warn' : 'ok'
}

export function tonEspace(librePct: number | null): 'ok' | 'warn' | 'crit' {
  if (librePct == null) return 'warn'
  return librePct < 5 ? 'crit' : librePct < 12 ? 'warn' : 'ok'
}

export function phraseTendance(t: Tendance | undefined, grandit = 'plus gros'): string {
  if (!t || t.sens === 'inconnue' || t.pct == null) return 'pas assez de points'
  if (t.sens === 'stable') return 'stable'
  const signe = t.pct > 0 ? '+' : ''
  return `${t.sens === 'hausse' ? grandit : 'plus petit'} (${signe}${t.pct} %)`
}

/** Durée jusqu'à saturation du disque au rythme actuel : null si rien ne grossit ou trop peu de données. */
export function joursAvantPlein(espace: Espace | null, octetsParJour: number | null): number | null {
  if (!espace || !octetsParJour || octetsParJour <= 0) return null
  return Math.floor(espace.libre / octetsParJour)
}

const iso = (s: string): number => {
  const t = Date.parse(s)
  return Number.isFinite(t) ? t / 1000 : 0
}

export function lignes(t: Pick<Tableau, 'timeshift' | 'borg'>): Ligne[] {
  const a: Ligne[] = t.timeshift.liste.map((s) => ({
    id: `t:${s.nom}`, source: 'timeshift', ts: s.ts, nom: s.nom, etiquette: s.etiquette || '-',
    taille: s.taille, neuf: s.transfere, duree_s: s.duree_s, fichiers: s.fichiers,
  }))
  const b: Ligne[] = t.borg.liste.map((r) => ({
    id: `b:${r.archive}`, source: 'borg', ts: iso(r.debut), nom: r.archive, etiquette: 'hebdo',
    taille: r.original ?? null, neuf: r.nouveau ?? null, duree_s: r.duree_s ?? null, fichiers: r.fichiers ?? null,
  }))
  return [...a, ...b]
}

export function etiquettes(l: Ligne[]): string[] {
  return ['toutes', ...Array.from(new Set(l.filter((x) => x.source === 'timeshift').map((x) => x.etiquette))).sort()]
}

export function filtrer(l: Ligne[], f: Filtres, maintenantS: number): Ligne[] {
  const limite = f.periode === 'tout' ? 0 : maintenantS - Number(f.periode) * 86400
  const sortie = l.filter((x) =>
    (f.source === 'tous' || x.source === f.source)
    && x.ts >= limite
    && (f.etiquette === 'toutes' || x.source !== 'timeshift' || x.etiquette === f.etiquette))
  const cle = (x: Ligne): number => (f.tri === 'taille' ? x.taille ?? -1 : f.tri === 'duree' ? x.duree_s ?? -1 : x.ts)
  return [...sortie].sort((p, q) => cle(q) - cle(p))
}

/** Octets nouveaux écrits par jour (somme des « nouveau » sur l'étendue des lignes) ; null s'il y a moins de 2 dates. */
export function croissanceJour(l: Ligne[]): number | null {
  const avecNeuf = l.filter((x) => x.neuf != null)
  if (avecNeuf.length < 2) return null
  const ts = avecNeuf.map((x) => x.ts)
  const jours = (Math.max(...ts) - Math.min(...ts)) / 86400
  if (jours < 1) return null
  return avecNeuf.reduce((s, x) => s + (x.neuf ?? 0), 0) / jours
}

/** Points d'une courbe SVG (valeurs inconnues ignorées) ; vide s'il y a moins de 2 points. */
export function courbe(valeurs: (number | null | undefined)[], w: number, h: number): string {
  const v = valeurs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  if (v.length < 2) return ''
  const lo = Math.min(...v), hi = Math.max(...v), pas = w / (v.length - 1)
  return v.map((x, i) => `${(i * pas).toFixed(1)},${(hi === lo ? h / 2 : h - ((x - lo) / (hi - lo)) * h).toFixed(1)}`).join(' ')
}

const CLE = 'neutroncore_sauvegardes_filtres'
const SOURCES: Source[] = ['tous', 'timeshift', 'borg']
const PERIODES: Periode[] = ['tout', '7', '30', '90']
const TRIS: Tri[] = ['recent', 'taille', 'duree']

/** Filtres relus du stockage local ; toute valeur inconnue retombe sur le défaut. */
export function lireFiltres(brut: string | null): Filtres {
  try {
    const o = JSON.parse(brut ?? '{}') as Partial<Filtres>
    return {
      source: SOURCES.includes(o.source as Source) ? (o.source as Source) : FILTRES_DEFAUT.source,
      periode: PERIODES.includes(o.periode as Periode) ? (o.periode as Periode) : FILTRES_DEFAUT.periode,
      tri: TRIS.includes(o.tri as Tri) ? (o.tri as Tri) : FILTRES_DEFAUT.tri,
      etiquette: typeof o.etiquette === 'string' && o.etiquette.length < 30 ? o.etiquette : FILTRES_DEFAUT.etiquette,
    }
  } catch { return FILTRES_DEFAUT }
}

export function chargerFiltres(): Filtres {
  try { return lireFiltres(localStorage.getItem(CLE)) } catch { return FILTRES_DEFAUT }
}

export function enregistrerFiltres(f: Filtres): void {
  try { localStorage.setItem(CLE, JSON.stringify(f)) } catch { /* stockage indisponible : le filtre ne sera pas retenu */ }
}
