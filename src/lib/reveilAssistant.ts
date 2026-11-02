// Assistant du réveil : tout ce qui met les réglages en PHRASES et fait le lien avec l'automatisation
// qui déclenche l'aube à heure fixe. Logique pure (testée dans reveilAssistant.test.ts).
// Vocabulaire commun avec les rampes de lumière (lib/rampesAssistant.ts) : « la lumière monte », « pleine lumière »,
// « montée », « lampes » ; jamais de jargon (rampe, offset, trigger) sans explication.
import type { Automation, AutomationDraft } from './automations'
import { DEFAULT_REPORT } from './automations'
import type { Reveil } from './reveil'

/** Jours numérotés comme l'API : 0 = lundi ... 6 = dimanche. */
export type Horaire = { heure: string; jours: number[] }

export const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
export const JOURS_COURTS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
export const PRESETS_JOURS: { id: string; nom: string; jours: number[] }[] = [
  { id: 'semaine', nom: 'en semaine', jours: [0, 1, 2, 3, 4] },
  { id: 'tous', nom: 'tous les jours', jours: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'weekend', nom: 'le week-end', jours: [5, 6] },
]
export const HORAIRE_DEFAUT: Horaire = { heure: '07:30', jours: [0, 1, 2, 3, 4] }

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

export const heureValide = (h: string): boolean => HHMM.test(h)
export const minutesDe = (hhmm: string): number => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
export const hhmmDe = (min: number): string => {
  const t = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** « 07:30 » -> « 7h30 », « 07:00 » -> « 7h ». */
export function heureLisible(hhmm: string): string {
  if (!heureValide(hhmm)) return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

const memeJours = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()

/** Jours en mots : « tous les jours », « en semaine », « le week-end », « le lundi », « lundi, mercredi et vendredi ». */
export function nomJours(jours: number[]): string {
  const u = [...new Set(jours)].filter((j) => j >= 0 && j <= 6).sort((a, b) => a - b)
  if (!u.length) return 'jamais'
  const p = PRESETS_JOURS.find((x) => memeJours(x.jours, u))
  if (p) return p.nom
  const noms = u.map((j) => JOURS_LONGS[j])
  return noms.length === 1 ? `le ${noms[0]}` : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
}

/** Quand l'aube DÉMARRE pour finir à `heure` : « 07:30 » avec 20 min -> « 07:10 ». `veille` : c'est la veille au soir (aube qui passe minuit). */
export function debutAube(heure: string, dureeMin: number): { heure: string; veille: boolean } {
  const brut = minutesDe(heure) - dureeMin
  return { heure: hhmmDe(brut), veille: brut < 0 }
}

/** Les jours où l'AUTOMATISATION part, pour des jours de réveil donnés (décalés d'un jour en arrière si l'aube commence la veille). */
export const joursDeDemarrage = (jours: number[], veille: boolean): number[] =>
  [...new Set(jours)].map((j) => (veille ? (j + 6) % 7 : j)).sort((a, b) => a - b)
const joursDeReveil = (jours: number[], veille: boolean): number[] =>
  [...new Set(jours)].map((j) => (veille ? (j + 1) % 7 : j)).sort((a, b) => a - b)

/** Ce qui empêche d'enregistrer, dit en clair ('' = tout va bien). */
export function problemeReveil(r: Reveil, h: Horaire | null): string {
  if (!r.nom.trim()) return 'donne un nom à ce réveil'
  if (!r.lampes.length) return 'choisis au moins une lampe'
  if (h) {
    if (!heureValide(h.heure)) return 'l’heure doit ressembler à 07:30'
    if (!h.jours.length) return 'choisis au moins un jour (ou coupe l’heure fixe)'
  }
  return ''
}

const noms = (ids: string[], dict: Record<string, string>) => ids.map((i) => dict[i] ?? `lampe ${i}`)
const liste = (x: string[]) => x.length <= 1 ? (x[0] ?? '') : `${x.slice(0, -1).join(', ')} et ${x[x.length - 1]}`

/** Ce que fait la télé, en groupe nominal : « worldmonitor sur la télé », « rien » si elle reste éteinte. */
export function teleEnMots(r: Reveil): string {
  if (!r.tele.actif) return 'rien'
  const quoi = r.tele.ecran === 'worldmonitor' ? 'worldmonitor' : r.tele.ecran === 'tele' ? 'le tableau du mode télé' : `l’écran « ${r.tele.ecran} »`
  const quand = r.tele.moment === 'debut' ? ' dès le début' : r.tele.avant_fin_min > 0 ? ` ${r.tele.avant_fin_min} min avant la fin` : ''
  return `${quoi} sur la télé${quand}`
}

/** La phrase d'aperçu : « en semaine à 7h30 : la lumière monte de 7h10 à 7h30 sur salon, puis worldmonitor sur la télé. » */
export function phraseReveil(r: Reveil, h: Horaire | null, lampes: Record<string, string> = {}): string {
  const ou = r.lampes.length ? ` sur ${liste(noms(r.lampes, lampes))}` : ' (aucune lampe choisie)'
  const suite = r.tele.actif ? `, puis ${teleEnMots(r)}` : ', rien d’autre'
  if (!h || !heureValide(h.heure)) return `à lancer à la main : la lumière monte pendant ${r.duree_min} min${ou}${suite}.`
  const d = debutAube(h.heure, r.duree_min)
  const quand = `${nomJours(h.jours)} à ${heureLisible(h.heure)}`
  const veille = d.veille ? ' (la veille au soir)' : ''
  return `${quand} : la lumière monte de ${heureLisible(d.heure)}${veille} à ${heureLisible(h.heure)}${ou}${suite}.`
}

/** L'automatisation qui lance ce réveil à l'heure de DÉPART de l'aube. Elle est retrouvée plus tard par son action (`trouverAutomation`). */
export function automationDuReveil(r: Reveil, h: Horaire, existante?: AutomationDraft): AutomationDraft {
  const d = debutAube(h.heure, r.duree_min)
  const e = existante
  const base: AutomationDraft = e
    ? { name: e.name, enabled: e.enabled, trigger: e.trigger, conditions: e.conditions, match: e.match, actions: e.actions, otherwise: e.otherwise,
      cooldown_min: e.cooldown_min, max_per_day: e.max_per_day, report: e.report }          // sans id ni historique : l'API ne les attend pas
    : { name: '', enabled: true, trigger: { type: 'manual', params: {} }, conditions: [], match: 'all', actions: [], otherwise: [],
      cooldown_min: 5, max_per_day: 0, report: DEFAULT_REPORT }
  return {
    ...base, name: `réveil : ${r.nom}`, enabled: r.enabled,
    trigger: { type: 'time', params: { time: d.heure, days: joursDeDemarrage(h.jours, d.veille) } },
    actions: [{ action: 'reveil.run', params: { id: r.id }, on_error: 'stop', retry: 0 }],
  }
}

/** L'automatisation à heure fixe qui lance ce réveil, s'il y en a une. */
export function trouverAutomation(autos: Automation[], idReveil: string): Automation | null {
  return autos.find((a) => a.trigger.type === 'time' && a.actions.some((s) => s.action === 'reveil.run' && s.params.id === idReveil)) ?? null
}

/** L'horaire de RÉVEIL (heure de pleine lumière) lu dans l'automatisation, ou null si elle ne se lit pas. */
export function horaireDepuis(a: AutomationDraft | null, dureeMin: number): Horaire | null {
  if (!a || a.trigger.type !== 'time') return null
  const t = a.trigger.params.time, j = a.trigger.params.days
  if (typeof t !== 'string' || !heureValide(t) || !Array.isArray(j)) return null
  const fin = minutesDe(t) + dureeMin
  return { heure: hhmmDe(fin), jours: joursDeReveil(j, fin >= 1440) }
}

const jourDe = (d: Date) => (d.getDay() + 6) % 7

/** Prochain moment de PLEINE LUMIÈRE (le réveil), strictement après `now`, ou null sans jour. */
export function prochainReveil(h: Horaire, now: Date): Date | null {
  if (!heureValide(h.heure) || !h.jours.length) return null
  const [hh, mm] = h.heure.split(':').map(Number)
  for (let k = 0; k <= 7; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, hh, mm, 0, 0)
    if (d.getTime() > now.getTime() && h.jours.includes(jourDe(d))) return d
  }
  return null
}

/** Durée jusqu'à une échéance : « dans 25 min », « dans 9 h 12 », « dans 3 jours ». */
export function dansLisible(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 1) return 'maintenant'
  if (min < 60) return `dans ${min} min`
  if (min < 48 * 60) return `dans ${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`
  return `dans ${Math.round(min / 1440)} jours`
}

/** « demain à 7h30 · dans 9 h 12 ». */
export function echeanceLisible(d: Date, now: Date): string {
  const jours = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000)
  const quand = jours === 0 ? 'aujourd’hui' : jours === 1 ? 'demain' : JOURS_LONGS[jourDe(d)]
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${quand} à ${heureLisible(hhmm)} · ${dansLisible(d.getTime() - now.getTime())}`
}

/** Explication du bouton d'essai (une seule phrase, pas de jargon). */
export function phraseEssai(secondes: number, dureeMin: number): string {
  return `Joue toute la montée de ${dureeMin} min en ${secondes} s sur tes lampes, pour voir si ça te va. La télé ne bouge pas, et tu peux arrêter quand tu veux.`
}
