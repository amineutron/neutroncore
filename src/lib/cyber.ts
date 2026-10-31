// Flux cyber : types, filtres mémorisés, mise en phrases (logique pure, testée dans cyber.test.ts).

export type Niveau = 'info' | 'warn' | 'crit'
export type Source = 'certfr' | 'shodan' | 'greynoise'
export type Avis = {
  id: string; source: Source; kind: string; title: string; summary: string; url: string
  published: number; level: Niveau; matched: string[]; seen_at: number; lu: boolean
}
export type EtatSource = { source: Source; active: boolean; raison: string; dernier: number | null; erreur: string; periode_s: number }
export type ListeCyber = { items: Avis[]; total: number; niveau: 'ok' | Niveau; sources: EtatSource[]; non_lus: number }
export type ConfigLumiere = {
  actif: boolean; niveau_min: 'warn' | 'crit'; lampes: string[]; bri_max_pct: number; duree_s: number
  silence: { debut: string; fin: string }; cooldown_s: number; confirmations: number
  couleurs: { warn: string; crit: string }
}
export type ReglagesCyber = { veille: string[]; ip_publique: string; ports_attendus: number[]; fenetre_h: number; lumiere: ConfigLumiere }
export type Decision = { action: 'appliquer' | 'restaurer' | 'abandonner' | 'rien'; raison: string; niveau: string }
export type EtatLumiere = {
  config: ConfigLumiere; phase: 'repos' | 'actif'; niveau_applique: string; niveau_courant: string
  restauration_en_attente: boolean; rampe_en_cours: boolean
  journal: { at: number; action: string; raison: string; niveau: string; detail: string }[]
}

export type Filtres = { niveaux: Niveau[]; sources: Source[]; nonLus: boolean; veilleSeule: boolean; texte: string }
export const FILTRES_DEFAUT: Filtres = { niveaux: [], sources: [], nonLus: false, veilleSeule: false, texte: '' }
export const CLE_FILTRES = 'neutroncore_cyber_filtres'

const NIVEAUX: Niveau[] = ['info', 'warn', 'crit']
const SOURCES: Source[] = ['certfr', 'shodan', 'greynoise']
export const NOM_SOURCE: Record<Source, string> = { certfr: 'cert-fr', shodan: 'shodan', greynoise: 'greynoise' }
export const NOM_NIVEAU: Record<Niveau | 'ok', string> = { ok: 'calme', info: 'info', warn: 'attention', crit: 'critique' }

/** Relit les filtres enregistrés ; tout ce qui est inattendu retombe sur les défauts. */
export function lireFiltres(brut: string | null): Filtres {
  try {
    const o = JSON.parse(brut ?? '') as Partial<Filtres>
    return {
      niveaux: Array.isArray(o.niveaux) ? o.niveaux.filter((n): n is Niveau => NIVEAUX.includes(n as Niveau)) : [],
      sources: Array.isArray(o.sources) ? o.sources.filter((s): s is Source => SOURCES.includes(s as Source)) : [],
      nonLus: o.nonLus === true,
      veilleSeule: o.veilleSeule === true,
      texte: typeof o.texte === 'string' ? o.texte.slice(0, 80) : '',
    }
  } catch {
    return FILTRES_DEFAUT
  }
}

export function lireFiltresStockes(): Filtres {
  try { return lireFiltres(localStorage.getItem(CLE_FILTRES)) } catch { return FILTRES_DEFAUT }
}

export function enregistrerFiltres(f: Filtres): void {
  try { localStorage.setItem(CLE_FILTRES, JSON.stringify(f)) } catch { /* stockage indisponible */ }
}

/** Ajoute la valeur si absente, la retire sinon (sans muter). */
export function basculer<T>(liste: T[], v: T): T[] {
  return liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]
}

export function filtrer(items: Avis[], f: Filtres): Avis[] {
  const t = f.texte.trim().toLowerCase()
  return items.filter((a) =>
    (f.niveaux.length === 0 || f.niveaux.includes(a.level)) &&
    (f.sources.length === 0 || f.sources.includes(a.source)) &&
    (!f.nonLus || !a.lu) &&
    (!f.veilleSeule || a.matched.length > 0) &&
    (t === '' || `${a.title} ${a.summary}`.toLowerCase().includes(t)))
}

export function nbFiltresActifs(f: Filtres): number {
  return Number(f.niveaux.length > 0) + Number(f.sources.length > 0) + Number(f.nonLus) + Number(f.veilleSeule) + Number(f.texte.trim() !== '')
}

export function tonNiveau(n: string): 'ok' | 'warn' | 'crit' | '' {
  return n === 'crit' ? 'crit' : n === 'warn' ? 'warn' : n === 'ok' ? 'ok' : ''
}

/** Âge lisible : « à l'instant », « il y a 3 h », « il y a 2 j ». */
export function age(t: number, now: number): string {
  const s = Math.max(0, now - t)
  if (s < 90) return "à l'instant"
  if (s < 5400) return `il y a ${Math.round(s / 60)} min`
  if (s < 129600) return `il y a ${Math.round(s / 3600)} h`
  return `il y a ${Math.round(s / 86400)} j`
}

/** Saisie « firefox, openssh ; nginx » -> noms propres, sans doublon (casse ignorée), 60 caractères au plus. */
export function lireVeille(saisie: string, existants: string[] = []): string[] {
  const vus = new Set(existants.map((x) => x.toLowerCase()))
  const out = [...existants]
  for (const brut of saisie.split(/[,;\n]/)) {
    const nom = brut.replace(/\s+/g, ' ').trim().slice(0, 60)
    if (nom && !vus.has(nom.toLowerCase())) { vus.add(nom.toLowerCase()); out.push(nom) }
  }
  return out
}

const RAISONS: Record<string, string> = {
  interrupteur: "l'interrupteur est coupé", aucune_lampe: "aucune lampe n'est choisie", silence: 'heures de silence',
  rampe: 'un réveil ou une rampe joue', sous_seuil: "l'alerte est sous le niveau choisi", deja_servi: 'cette alerte a déjà eu son ambiance',
  cooldown: "trop tôt après la dernière ambiance", anti_rebond: "j'attends une confirmation du niveau",
  nouveau: 'nouvelle alerte', escalade: "l'alerte s'aggrave", en_cours: "l'ambiance est en cours", fin_duree: "la durée est écoulée",
  manuel: 'arrêt demandé', instantane_impossible: "l'état des lampes est illisible : rien n'est allumé",
}
const ACTIONS: Record<string, string> = { appliquer: 'ambiance lancée', restaurer: 'lampes remises', abandonner: 'ambiance abandonnée', rien: 'rien à faire' }

export function phraseDecision(d: { action: string; raison: string }): string {
  return `${ACTIONS[d.action] ?? d.action} : ${RAISONS[d.raison] ?? d.raison}`
}

/** « 23:00 -> 07:00 » est-il bien formé ? */
export function heureValide(h: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(h)
}
