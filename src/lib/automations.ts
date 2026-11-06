// Automatisations : QUAND (déclencheur) + SI (conditions) + ALORS / SINON (actions).
// Types et mise en phrases (logique pure). Les catalogues et leur validation
// vivent côté API (lib/automations.py) ; l'interface les lit.

import { DAYS, describeStep, type ActionSpec, type LyraArgs, type ParamSpec as BaseParam, type Step, type StepResult } from './routines'

export type { LyraArgs }
// réponse de POST /automations/analyze : ce que Lyra ferait de la phrase, et si on peut l'enregistrer
export type LyraVerdict = { ok: boolean; tool: string; arguments: LyraArgs; reason: string; warnings: string[]; phrase?: string }

/** Appel résolu, lisible : « tv.power_on » ou « hue.activate_scene_by_name (scene_name : soiree) ». */
export function lyraCall(tool: string, args: LyraArgs): string {
  const list = Object.entries(args).map(([k, v]) => `${k} : ${v}`).join(', ')
  return list ? `${tool} (${list})` : tool
}

export type ParamSpec = BaseParam
  | { name: string; type: 'time' }
  | { name: string; type: 'days' }
export type Value = string | number | boolean | number[]
export type Block = { type: string; params: Record<string, Value>; negate?: boolean }
export type BlockSpec = { type: string; label: string; params: ParamSpec[] }
export type Limits = { conditions: number; actions: number; retry: number; per_day: number; report: number }
export type Catalogue = {
  triggers: BlockSpec[]; conditions: BlockSpec[]; actions: ActionSpec[]
  variables: string[]; report_variables: string[]; limits: Limits
  // actions que l'API refuse de rejouer (bascule, routine, attente)
  no_retry?: string[]
}
export type Report = { on: 'never' | 'failure' | 'always'; to: 'app' | 'phone' | 'both'; success: string; failure: string }
export type Run = {
  // nombre de « non lancé » identiques d'affilée, regroupés par l'API
  times?: number
  at: number; trigger: string; why: string; success: boolean; failed: number; detail: string
  skipped?: boolean; branch?: 'then' | 'else'; steps?: StepResult[]; duration_s?: number
}
export type AutomationDraft = {
  name: string; enabled: boolean; trigger: Block; conditions: Block[]; match: 'all' | 'any'
  actions: Step[]; otherwise: Step[]; cooldown_min: number; max_per_day: number; report: Report
}
export type Automation = AutomationDraft & { id: string; created?: string; last_run: string | null; history: Run[] }
// noms lisibles des objets référencés : scènes par identifiant, `light:<n>`, `routine:<id>`
export type Names = Record<string, string>

export const DEFAULT_REPORT: Report = { on: 'failure', to: 'app', success: '', failure: '' }
export const EMPTY_DRAFT: AutomationDraft = {
  name: '', enabled: true, trigger: { type: 'manual', params: {} }, conditions: [], match: 'all',
  actions: [], otherwise: [], cooldown_min: 5, max_per_day: 0, report: DEFAULT_REPORT,
}

// valeurs des listes fermées, dites en français — par PARAMÈTRE : un service qui
// s'appellerait « backup » ne doit pas s'afficher « sauvegarde »
const KIND: Record<string, string> = {
  any: 'n’importe laquelle', disk: 'disque', unit: 'service en échec', backup: 'sauvegarde', rotation: 'disque de sauvegarde',
  memory: 'mémoire', agenda: 'rappel d’agenda',
}
const METRIC: Record<string, string> = { cpu: 'processeur', ram: 'mémoire vive', vram: 'mémoire du gpu', gpu_temp: 'température du gpu', disk: 'disque le plus rempli' }
// Batteries de tests : miroir des libellés de lib/test_suites.py (côté API), où vit la liste fermée
const SUITES: Record<string, string> = {
  lyra: 'lyra — tests (unitaires, intégration, bout en bout)', 'lyra-smoke': 'lyra — serveurs MCP joignables', 'lyra-demon': 'lyra — démon en marche',
  api: 'lyra-control-api — tests', neutroncore: 'neutroncore — tests de l’écran', tracking: 'tracking — tests', 'tracking-smoke': 'tracking — service joignable',
  atelier: 'modelisation-3d — tests rapides', 'atelier-complet': 'modelisation-3d — tous les tests (long)',
  'fedora-agents': 'fedora-agents — tests', 'fedora-agents-lint': 'fedora-agents — relecture automatique du code',
  'hue-mcp': 'hue-mcp — tests', 'pylips-mcp': 'pylips-mcp — tests', 'denon-mcp': 'denon-mcp — tests', 'catt-mcp': 'catt-mcp — tests',
}
const CHOICES: Record<string, Record<string, string>> = {
  kind: KIND,
  metric: METRIC,
  when: { raised: 'apparaît', resolved: 'est résolue', waiting: 'attend une réponse', done: 'a fini de répondre', verdict: 'rend un verdict' },
  state: { on: 'allumé', off: 'éteint', down: 'tombe', up: 'revient', yes: 'oui', no: 'non', here: 'là', away: 'absent',
    idle: 'inactifs', active: 'utilisés', stopped: 's’arrête', unhealthy: 'tombe malade' },
  result: { echec: 'en échec', reussi: 'réussie', tous: 'quel que soit le résultat' },
  code: { erreur: 'sur une erreur seulement', tous: 'même un arrêt normal' },
  name: { any: 'n’importe lequel', trigger: 'celui qui vient de tomber' },
  suite: SUITES,
  fond: { aucun: 'caméra telle quelle', flou: 'flouté', aubergine: 'aubergine', or: 'or et braise', rose: 'rose du soir', nuit: 'nuit bleue', foret: 'forêt', studio: 'studio gris', papier: 'papier clair' },
  source: { hdmi1: 'hdmi 1', hdmi2: 'hdmi 2', hdmi3: 'hdmi 3', hdmi4: 'hdmi 4' },
  screen: { tele: 'le tableau du mode télé', accueil: 'l’accueil', atelier: 'l’atelier 3d', taches: 'les tâches', lanceur: 'le lanceur', agenda: 'l’agenda' },
  level: { any: 'tous niveaux', warn: 'avertissement', crit: 'critique' },
  op: { above: 'au-dessus de', below: 'en dessous de' },
  category: { any: 'toutes catégories', perso: 'perso', systeme: 'système', sauvegardes: 'sauvegardes' },
  mode: { FOLLOW_VIDEO: 'vidéo', FOLLOW_AUDIO: 'audio', LOUNGE_LIGHT: 'lounge', OFF: 'éteint' },
  priority: { normale: 'priorité normale', basse: 'priorité basse', haute: 'priorité haute' },
}
export function choiceLabel(param: string, value: string, block = ''): string {
  if (param === 'state') {
    // « un service est » : en marche / arrêté, pas « revient / tombe »
    if (block === 'service_is') return value === 'up' ? 'en marche' : 'arrêté'
    // accords : la tv (féminin), les lumières (féminin pluriel)
    if (block === 'tv_is') return value === 'on' ? 'allumée' : 'éteinte'
    if (block === 'lights_are') return value === 'on' ? 'allumées' : 'éteintes'
    if (block === 'tv') return value === 'on' ? 's’allume' : 's’éteint'
    if (block === 'lights') return value === 'on' ? 's’allument' : 's’éteignent'
    if (block === 'docker' && value === 'any') return 's’arrête ou tombe malade'
  }
  return CHOICES[param]?.[value] ?? value.toLowerCase()
}

// libellé d'un booléen selon ce qu'il règle (« muted: true » n'est pas « allumer »)
export function boolLabel(param: string, value: boolean): string {
  if (param === 'muted') return value ? 'couper le son' : 'remettre le son'
  return value ? 'allumer' : 'éteindre'
}

const unit = (metric: unknown) => (metric === 'gpu_temp' ? '°C' : ' %')
const duree = (min: unknown) => {
  const m = Number(min)
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`
}

export function daysLabel(days: number[]): string {
  const key = [...days].sort((a, b) => a - b).join('')
  return key === '0123456' ? 'tous les jours' : key === '01234' ? 'en semaine' : key === '56' ? 'le week-end' : [...days].sort((a, b) => a - b).map((d) => DAYS[d]).join(' ')
}

export const isRoutine = (a: { trigger: Block }) => a.trigger.type === 'manual'
const filter = (p: Block['params']) => (String(p.contains ?? '').trim() ? ` contenant « ${p.contains} »` : '')

/** « à 07:30 en semaine », « quand une alerte disque apparaît »… */
export function describeTrigger(t: Block): string {
  const p = t.params
  switch (t.type) {
    case 'manual': return 'à la main'
    case 'time': return `à ${p.time ?? '…'} ${daysLabel(Array.isArray(p.days) ? p.days : [])}`.trim()
    case 'interval': return `toutes les ${Number(p.every_min) >= 60 && Number(p.every_min) % 60 === 0 ? `${Number(p.every_min) / 60} h` : `${p.every_min} min`}`
    case 'alert': {
      const level = p.level && p.level !== 'any' ? ` ${p.level === 'crit' ? 'critique' : 'd’avertissement'}` : ''
      const kind = p.kind === 'any' ? '' : ` « ${KIND[String(p.kind)] ?? p.kind} »`
      return `quand une alerte${level}${kind} ${p.when === 'raised' ? 'apparaît' : 'est résolue'}`
    }
    case 'resource': return `quand ${METRIC[String(p.metric)] ?? p.metric} dépasse ${p.above}${unit(p.metric)} pendant ${p.for_min} min`
    case 'download_done': return `quand un téléchargement${filter(p)} se termine`
    case 'request': return 'quand un film ou une série est demandé'
    case 'agenda': return `${Number(p.minutes_before) > 0 ? `${p.minutes_before} min avant` : 'au début d’'} un événement${p.category && p.category !== 'any' ? ` ${choiceLabel('category', String(p.category))}` : ''} de l’agenda`.replace('d’ un', 'd’un')
    case 'session': return `quand une session claude${filter(p)} ${p.when === 'waiting' ? 'attend une réponse' : 'a fini de répondre'}`
    case 'service': return `quand ${p.name === 'any' || !p.name ? 'un service' : p.name} ${p.state === 'down' ? 'tombe' : 'revient'}`
    case 'tv': return `quand la tv ${p.state === 'on' ? 's’allume' : 's’éteint'}`
    case 'lights': return `quand les lumières ${p.state === 'on' ? 's’allument' : 's’éteignent'}`
    case 'event': return `quand l’événement « ${p.name || '…'} » est reçu`
    case 'startup': return 'au démarrage de neutroncore'
    case 'atelier': return `quand une boucle de l’atelier 3d${filter(p)} ${p.when === 'verdict' ? 'rend un verdict' : 'attend ta décision'}`
    case 'session_stuck': return `quand une session claude${filter(p)} au travail ne bouge plus depuis ${p.minutes} min`
    case 'idle': return `quand je n’ai touché ni clavier ni souris depuis ${duree(p.minutes)}`
    case 'back': return `quand je reviens après au moins ${duree(p.after_min)} d’absence`
    case 'ci': return `quand une ci github${filter(p)} se termine${p.result === 'tous' ? '' : p.result === 'reussi' ? ' avec succès' : ' en échec'}`
    case 'docker': {
      const quoi = p.state === 'stopped' ? 's’arrête' : p.state === 'unhealthy' ? 'tombe malade' : 's’arrête ou tombe malade'
      return `quand un conteneur docker${filter(p)} ${quoi}${p.code === 'tous' || p.state === 'unhealthy' ? '' : ' (arrêt sur erreur)'}`
    }
    case 'gpu_oom': return 'quand la carte graphique manque de mémoire'
    default: return t.type
  }
}

function conditionText(c: Block): string {
  const p = c.params
  switch (c.type) {
    case 'time_between': return `entre ${p.start} et ${p.end}`
    case 'days': return daysLabel(Array.isArray(p.days) ? p.days : [])
    case 'tv_is': return `la tv est ${p.state === 'on' ? 'allumée' : 'éteinte'}`
    case 'lights_are': return `les lumières sont ${p.state === 'on' ? 'allumées' : 'éteintes'}`
    case 'service_is': return `${p.name} est ${p.state === 'up' ? 'en marche' : 'arrêté'}`
    case 'downloading': return p.state === 'yes' ? 'un téléchargement est en cours' : 'aucun téléchargement en cours'
    case 'session_waiting': return p.state === 'yes' ? 'une session claude attend' : 'aucune session claude n’attend'
    case 'alert_active': return p.kind === 'any' ? 'une alerte est en cours' : `une alerte « ${KIND[String(p.kind)] ?? p.kind} » est en cours`
    case 'resource': return `${METRIC[String(p.metric)] ?? p.metric} ${p.op === 'above' ? 'au-dessus de' : 'en dessous de'} ${p.value}${unit(p.metric)}`
    case 'presence': return p.state === 'away' ? 'tu es absent (écrans du pc éteints)' : 'tu es là (un écran du pc allumé)'
    case 'idle': return p.state === 'idle' ? `ni clavier ni souris depuis ${duree(p.minutes)}` : `clavier ou souris touchés dans les ${duree(p.minutes)} dernières`
    default: return c.type
  }
}
export function describeCondition(c: Block): string {
  return c.negate ? `pas (${conditionText(c)})` : conditionText(c)
}

export function describeAction(step: Step, catalogue: ActionSpec[], names: Names = {}): string {
  const p = step.params
  const base = (() => {
    switch (step.action) {
      case 'notify.app': return `notification dans l’app : « ${p.message} »`
      case 'notify.phone': return `notification sur le téléphone : « ${p.message} »`
      case 'service.start': return p.name === 'trigger' ? 'redémarrer le service qui vient de tomber' : `démarrer ${p.name}`
      case 'camera.power': return p.on ? 'allumer la caméra' : 'éteindre la caméra'
      case 'camera.standby': return p.on ? 'mettre la caméra en veille' : 'sortir la caméra de veille'
      case 'camera.background': return `fond de la caméra : ${choiceLabel('fond', String(p.fond))}`
      case 'tv.show': return `afficher ${choiceLabel('screen', String(p.screen))} sur la télé (entrée ${choiceLabel('source', String(p.source))})`
      case 'tv.restore': return 'remettre sur la télé ce qu’elle affichait'
      case 'tests.run': return `lancer les tests : ${SUITES[String(p.suite)] ?? p.suite}`
      case 'reveil.run': return `lancer le réveil « ${p.id} »`
      case 'rampe.play': return `jouer la rampe de lumière « ${p.id} »`
      case 'spatial.scene': return `lumière 3d : jouer « ${names[`lumiere:${p.id}`] ?? p.id} » (si les lampes sont déjà en direct)`
      case 'lumiere.arret': return 'arrêter la rampe ou le réveil en cours'
      case 'audio.scene': return `sono : appliquer la scène « ${p.id} »`
      case 'lyra.tool': return p.tool ? `lyra : « ${p.phrase} »` : 'lyra : phrase à faire analyser'
      case 'docker.restart': return p.name === 'trigger' ? 'relancer le conteneur qui vient de tomber' : `relancer le conteneur ${p.name || '…'}`
      case 'vm.start': return `démarrer la vm ${p.vm || '…'}`
      case 'bt.connect': return `reconnecter ${names[`bt:${p.device}`] ?? (p.device || 'un appareil bluetooth')}`
      case 'ci.inspect': return 'proposer d’ouvrir une session claude pour inspecter l’échec'
      default: return describeStep(step, catalogue, names)
    }
  })()
  const opts = [step.retry ? `${step.retry} réessai${step.retry > 1 ? 's' : ''}` : '', step.on_error === 'stop' ? 'arrête la suite si elle échoue' : ''].filter(Boolean)
  return opts.length ? `${base} (${opts.join(', ')})` : base
}

/** La phrase complète, relue par l'utilisateur avant d'enregistrer. */
export function sentence(raw: AutomationDraft, catalogue: ActionSpec[], names: Names = {}): string {
  const a = normalize(raw)
  const when = describeTrigger(a.trigger)
  const joiner = a.match === 'any' ? ' ou ' : ' et '
  const cond = a.conditions.length ? `, si ${a.conditions.map(describeCondition).join(joiner)}` : ''
  const list = (steps: Step[]) => (steps.length ? steps.map((s) => describeAction(s, catalogue, names)).join(', puis ') : '…')
  const otherwise = a.otherwise.length ? ` Sinon : ${list(a.otherwise)}.` : ''
  return `${when.charAt(0).toUpperCase()}${when.slice(1)}${cond} : ${list(a.actions)}.${otherwise}`
}

export function defaultBlock(spec: BlockSpec): Block {
  return {
    type: spec.type,
    params: Object.fromEntries(spec.params.map((p): [string, Value] => {
      if (p.type === 'time') return [p.name, p.name === 'end' ? '06:00' : p.name === 'start' ? '22:00' : '07:30']
      if (p.type === 'days') return [p.name, [0, 1, 2, 3, 4]]
      if (p.type === 'choice') return [p.name, p.choices[0]]
      if (p.type === 'int') return [p.name, { every_min: 30, above: 90, for_min: 5, minutes_before: 10, value: 80, after_min: 240 }[p.name] ?? (p.name === 'minutes' ? 30 : p.min)]
      if (p.type === 'container') return [p.name, 'trigger']
      if (p.type === 'bool') return [p.name, true]
      return [p.name, '']
    })),
  }
}

/** Deux brouillons ont-ils le même contenu ? (indépendant de l'ordre des champs et des paramètres) */
export function sameDraft(a: AutomationDraft, b: AutomationDraft): boolean {
  const sorted = (params: Record<string, unknown>) => Object.keys(params).sort().map((k) => [k, params[k]])
  const steps = (l: Step[]) => l.map((s) => [s.action, sorted(s.params), s.on_error ?? 'continue', s.retry ?? 0])
  const norm = (d: AutomationDraft) => JSON.stringify([d.name, d.enabled, d.cooldown_min, d.max_per_day, d.match, sorted(d.report),
    d.trigger.type, sorted(d.trigger.params), d.conditions.map((c) => [c.type, sorted(c.params), Boolean(c.negate)]), steps(d.actions), steps(d.otherwise)])
  return norm(a) === norm(b)
}

/** Une routine n'a ni condition, ni branche « sinon », ni pause, ni cadence : ce qui
 * a pu être réglé avant de passer le déclencheur sur « à la main » n'est ni gardé ni envoyé. */
export function normalize(d: AutomationDraft): AutomationDraft {
  return d.trigger.type === 'manual'
    ? { ...d, conditions: [], otherwise: [], match: 'all', enabled: true, cooldown_min: EMPTY_DRAFT.cooldown_min, max_per_day: 0 }
    : d.conditions.length === 0 ? { ...d, otherwise: [], match: 'all' } : d   // sans condition, « sinon » ne peut jamais tourner
}

/** Complète les paramètres absents d'un bloc (catalogue qui a évolué) : ce que
 * l'éditeur affiche est toujours ce qui sera envoyé. */
export function completeBlock(block: Block, spec: BlockSpec | undefined): Block {
  return spec ? { ...block, params: { ...defaultBlock(spec).params, ...block.params } } : block
}

/** Brouillon à partir de ce que l'API renvoie : SEULEMENT les champs du brouillon
 * (ni id, ni historique — ils repartiraient dans le corps du PUT), avec ceux
 * qu'une ancienne version n'envoyait pas. */
export function toDraft(a: Partial<AutomationDraft> & Pick<AutomationDraft, 'name' | 'trigger' | 'actions'>): AutomationDraft {
  return {
    name: a.name, enabled: a.enabled ?? true, trigger: a.trigger, conditions: a.conditions ?? [], match: a.match ?? 'all',
    actions: a.actions, otherwise: a.otherwise ?? [], cooldown_min: a.cooldown_min ?? EMPTY_DRAFT.cooldown_min,
    max_per_day: a.max_per_day ?? 0, report: { ...DEFAULT_REPORT, ...(a.report ?? {}) },
  }
}

// contrôle rapide avant l'envoi ; l'API revalide tout
export function draftError(raw: AutomationDraft): string {
  const d = normalize(raw)
  if (!d.name.trim()) return 'donne un nom'
  if (d.actions.length === 0) return 'ajoute au moins une action'
  const all = [...d.actions, ...d.otherwise]
  if (all.some((s) => s.action === 'hue.scene' && !s.params.scene_id)) return 'choisis une scène pour chaque action « scène hue »'
  if (all.some((s) => s.action.startsWith('notify.') && !String(s.params.message ?? '').trim())) return 'écris le message de la notification'
  if (all.some((s) => s.action === 'hue.light' && !s.params.light)) return 'choisis la lampe'
  if (all.some((s) => s.action === 'routine.run' && !s.params.id)) return 'choisis la routine à lancer'
  if (all.some((s) => s.action === 'lyra.tool' && !s.params.tool)) return 'fais analyser la phrase par lyra (bouton « analyser »)'
  if (all.some((s) => s.action === 'docker.restart' && !s.params.name)) return 'choisis le conteneur à relancer'
  if (all.some((s) => s.action === 'vm.start' && !s.params.vm)) return 'choisis la vm à démarrer'
  if (all.some((s) => s.action === 'bt.connect' && !s.params.device)) return 'choisis l’appareil bluetooth'
  if (all.some((s) => s.action === 'ci.inspect') && d.trigger.type !== 'ci') return '« inspecter l’échec » ne sert qu’avec le déclencheur « la ci github se termine »'
  if (all.some((s) => s.action === 'docker.restart' && s.params.name === 'trigger') && d.trigger.type !== 'docker') return '« le conteneur qui vient de tomber » demande le déclencheur « un conteneur docker tombe »'
  if (d.trigger.type === 'event' && !/^[A-Za-z0-9_-]{1,64}$/.test(String(d.trigger.params.name ?? ''))) return 'nom de l’événement : lettres, chiffres, tirets, sans espace'
  const days = [d.trigger, ...d.conditions].some((b) => Array.isArray(b.params.days) && b.params.days.length === 0)
  if (days) return 'choisis au moins un jour'
  if (d.conditions.some((c) => c.type === 'time_between' && c.params.start === c.params.end)) return 'plage horaire vide : début et fin identiques'
  return ''
}

export function runLabel(r: Run): string {
  if (r.skipped) return `non lancée${(r.times ?? 1) > 1 ? ` (×${r.times})` : ''} — ${r.why}`
  const branch = r.branch === 'else' ? ' (branche « sinon »)' : ''
  return r.success ? `réussie${branch}` : `${r.failed} action(s) en échec${branch}`
}

const TRIGGER_SHORT: Record<string, string> = {
  manual: 'à la main', time: 'heure prévue', interval: 'intervalle', alert: 'alerte', resource: 'ressource', download_done: 'téléchargement',
  request: 'demande', agenda: 'agenda', session: 'session claude', service: 'service', tv: 'tv', lights: 'lumières', event: 'événement externe', startup: 'démarrage',
  atelier: 'atelier 3d', session_stuck: 'session immobile', idle: 'inactivité', back: 'retour', ci: 'ci github', docker: 'conteneur docker',
  gpu_oom: 'carte graphique',
}
export function triggerLabel(trigger: string): string {
  return TRIGGER_SHORT[trigger] ?? trigger
}

/** Exemple de rendu d'un message avec ses variables, pour l'aperçu dans l'éditeur. */
export function preview(template: string, name: string, now: Date): string {
  const values: Record<string, string> = {
    nom: name || 'mon automatisation', declencheur: 'déclencheur', titre: 'Metropolis.mkv',
    heure: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    date: now.toLocaleDateString('fr-FR'), jour: now.toLocaleDateString('fr-FR', { weekday: 'long' }),
    resultat: 'réussie', echecs: 'tv : allumer : TV injoignable', duree: '4 s',
  }
  // une seule passe (une valeur contenant « {heure} » n'est pas resubstituée), borné comme côté serveur
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole).slice(0, 300)
}

// ---- diagramme (mode « à la n8n », de gauche à droite) ----------------------

export type NodeKind = 'trigger' | 'if' | 'then' | 'else' | 'add-then' | 'add-else' | 'add-if'
export type FlowNode = { id: string; kind: NodeKind; index: number; col: number; row: number; title: string; text: string }
export type FlowEdge = { from: string; to: string; label?: string }
export type Flow = { nodes: FlowNode[]; edges: FlowEdge[]; cols: number; rows: number }

/** Mise en page du diagramme : déclencheur, porte « si » (deux sorties : vrai en
 * haut, faux en bas), puis une rangée d'actions par branche. `editable` ajoute
 * les nœuds « + ». Une routine n'a ni porte ni branche « sinon ». */
export function layout(raw: AutomationDraft, catalogue: ActionSpec[], names: Names = {}, editable = true, maxActions = 12): Flow {
  const a = raw.trigger.type === 'manual' ? normalize(raw) : raw
  const routine = a.trigger.type === 'manual'
  const nodes: FlowNode[] = [{ id: 'trigger', kind: 'trigger', index: 0, col: 0, row: 0, title: 'quand', text: describeTrigger(a.trigger) }]
  const edges: FlowEdge[] = []
  const gate = a.conditions.length > 0
  let prev = 'trigger', col = 1
  if (gate) {
    nodes.push({ id: 'if', kind: 'if', index: 0, col, row: 0, title: a.match === 'any' ? 'si au moins une' : 'si toutes',
      text: a.conditions.map(describeCondition).join(a.match === 'any' ? ' ou ' : ' et ') })
    edges.push({ from: 'trigger', to: 'if' })
    prev = 'if'; col = 2
  } else if (editable && !routine) {
    nodes.push({ id: 'add-if', kind: 'add-if', index: 0, col: 0, row: 1, title: '+', text: 'ajouter une condition' })
  }
  const chain = (steps: Step[], kind: 'then' | 'else', row: number, label?: string) => {
    let from = prev
    steps.forEach((s, i) => {
      const id = `${kind}-${i}`
      nodes.push({ id, kind, index: i, col: col + i, row, title: `${kind === 'then' ? 'alors' : 'sinon'} ${i + 1}`, text: describeAction(s, catalogue, names) })
      edges.push({ from, to: id, label: i === 0 ? label : undefined })
      from = id
    })
    if (editable && steps.length < maxActions) {   // au plafond : plus de « + »
      const id = kind === 'then' ? 'add-then' : 'add-else'
      nodes.push({ id, kind: id, index: steps.length, col: col + steps.length, row, title: '+', text: kind === 'then' ? 'ajouter une action' : 'ajouter une action « sinon »' })
      edges.push({ from, to: id, label: steps.length === 0 ? label : undefined })
    }
  }
  chain(a.actions, 'then', 0, gate ? 'vrai' : undefined)
  if (gate) chain(a.otherwise, 'else', 1, 'faux')
  return { nodes, edges, cols: Math.max(...nodes.map((n) => n.col)) + 1, rows: Math.max(...nodes.map((n) => n.row)) + 1 }
}

/** État d'un nœud pour un passage donné : réussi, en échec, non exécuté, ou hors de la branche suivie. */
export function nodeResult(node: FlowNode, run: Run | null): 'ok' | 'fail' | 'idle' | 'off' | null {
  if (!run) return null
  if (node.kind === 'trigger') return 'ok'
  // non lancée : la porte n'est en cause que si c'est une condition qui a échoué (pas la cadence ni un plafond)
  if (run.skipped) return node.kind === 'if' && run.why.startsWith('condition non remplie') ? 'fail' : 'off'
  const branch = run.branch ?? 'then'
  if (node.kind === 'if') return 'ok'
  if (node.kind !== 'then' && node.kind !== 'else') return null
  if (node.kind !== branch) return 'off'
  if (!run.steps) return run.success ? 'ok' : null   // ancien passage sans détail par étape
  const step = run.steps[node.index]
  if (!step) return 'idle'
  return step.not_run ? 'idle' : step.ok ? 'ok' : 'fail'
}
