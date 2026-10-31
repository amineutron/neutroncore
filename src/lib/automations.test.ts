import { describe, expect, it } from 'vitest'
import {
  EMPTY_DRAFT, daysLabel, defaultBlock, describeAction, describeCondition, describeTrigger, draftError, isRoutine, runLabel,
  boolLabel, choiceLabel, completeBlock, layout, nodeResult, normalize, preview, sameDraft, sentence, toDraft, type AutomationDraft, type Block, type BlockSpec, lyraCall,
} from './automations'
import type { ActionSpec } from './routines'

const b = (type: string, params: Block['params'] = {}): Block => ({ type, params })
const CAT: ActionSpec[] = [
  { action: 'hue.off', label: 'lumières : tout éteindre', params: [] },
  { action: 'tv.power', label: 'tv', params: [{ name: 'on', type: 'bool' }] },
]

describe('describeTrigger', () => {
  it.each([
    [b('manual'), 'à la main'],
    [b('time', { time: '07:30', days: [0, 1, 2, 3, 4] }), 'à 07:30 en semaine'],
    [b('alert', { kind: 'disk', when: 'raised' }), 'quand une alerte « disque » apparaît'],
    [b('alert', { kind: 'any', when: 'resolved' }), 'quand une alerte est résolue'],
    [b('download_done'), 'quand un téléchargement se termine'],
    [b('session', { when: 'waiting' }), 'quand une session claude attend une réponse'],
    [b('service', { name: 'plex', state: 'down' }), 'quand plex tombe'],
    [b('service', { name: 'any', state: 'up' }), 'quand un service revient'],
    [b('tv', { state: 'off' }), 'quand la tv s’éteint'],
    [b('interval', { every_min: 30 }), 'toutes les 30 min'],
    [b('interval', { every_min: 120 }), 'toutes les 2 h'],
    [b('alert', { kind: 'any', when: 'raised', level: 'crit' }), 'quand une alerte critique apparaît'],
    [b('resource', { metric: 'gpu_temp', above: 80, for_min: 5 }), 'quand température du gpu dépasse 80°C pendant 5 min'],
    [b('resource', { metric: 'disk', above: 90, for_min: 1 }), 'quand disque le plus rempli dépasse 90 % pendant 1 min'],
    [b('download_done', { contains: 'linux' }), 'quand un téléchargement contenant « linux » se termine'],
    [b('download_done', { contains: '' }), 'quand un téléchargement se termine'],
    [b('request'), 'quand un film ou une série est demandé'],
    [b('agenda', { category: 'perso', minutes_before: 15 }), '15 min avant un événement perso de l’agenda'],
    [b('agenda', { category: 'any', minutes_before: 0 }), 'au début d’un événement de l’agenda'],
    [b('lights', { state: 'off' }), 'quand les lumières s’éteignent'],
    [b('event', { name: 'porte' }), 'quand l’événement « porte » est reçu'],
    [b('startup'), 'au démarrage de neutroncore'],
    [b('futur_inconnu'), 'futur_inconnu'],
  ])('%j', (t, out) => expect(describeTrigger(t)).toBe(out))
})

describe('describeCondition', () => {
  it.each([
    [b('time_between', { start: '22:00', end: '06:00' }), 'entre 22:00 et 06:00'],
    [b('days', { days: [5, 6] }), 'le week-end'],
    [b('tv_is', { state: 'on' }), 'la tv est allumée'],
    [b('lights_are', { state: 'off' }), 'les lumières sont éteintes'],
    [b('service_is', { name: 'plex', state: 'down' }), 'plex est arrêté'],
    [b('downloading', { state: 'no' }), 'aucun téléchargement en cours'],
    [b('session_waiting', { state: 'yes' }), 'une session claude attend'],
    [b('alert_active', { kind: 'disk' }), 'une alerte « disque » est en cours'],
    [b('resource', { metric: 'ram', op: 'below', value: 30 }), 'mémoire vive en dessous de 30 %'],
    [{ ...b('tv_is', { state: 'on' }), negate: true }, 'pas (la tv est allumée)'],
  ])('%j', (c, out) => expect(describeCondition(c)).toBe(out))
})

describe('describeAction', () => {
  it('actions propres aux automatisations', () => {
    expect(describeAction({ action: 'notify.phone', params: { message: 'disque plein' } }, CAT)).toBe('notification sur le téléphone : « disque plein »')
    expect(describeAction({ action: 'service.start', params: { name: 'plex' } }, CAT)).toBe('démarrer plex')
  })
  it('les actions de routine gardent leur phrase', () => {
    expect(describeAction({ action: 'tv.power', params: { on: false } }, CAT)).toBe('tv : éteindre')
  })
})

describe('sentence', () => {
  const draft: AutomationDraft = {
    ...EMPTY_DRAFT, name: 'coucher',
    trigger: b('tv', { state: 'off' }), conditions: [b('time_between', { start: '22:00', end: '06:00' }), b('days', { days: [0, 1, 2, 3, 6] })],
    actions: [{ action: 'hue.off', params: {} }, { action: 'notify.app', params: { message: 'bonne nuit' } }],
  }
  it('phrase complète relue avant d’enregistrer', () => {
    expect(sentence(draft, CAT)).toBe('Quand la tv s’éteint, si entre 22:00 et 06:00 et lun mar mer jeu dim : lumières : tout éteindre, puis notification dans l’app : « bonne nuit ».')
  })
  it('sans condition ni action', () => {
    expect(sentence({ ...EMPTY_DRAFT, trigger: b('download_done') }, CAT)).toBe('Quand un téléchargement se termine : ….')
  })
  it('« au moins une » et branche sinon', () => {
    const d = { ...draft, match: 'any' as const, otherwise: [{ action: 'tv.power', params: { on: false }, retry: 2, on_error: 'stop' as const }] }
    expect(sentence(d, CAT)).toBe('Quand la tv s’éteint, si entre 22:00 et 06:00 ou lun mar mer jeu dim : lumières : tout éteindre, puis notification dans l’app : « bonne nuit ». Sinon : tv : éteindre (2 réessais, arrête la suite si elle échoue).')
  })
  it('sans condition, la branche sinon n’est ni dite ni gardée (elle ne tournerait jamais)', () => {
    const d = { ...draft, conditions: [], otherwise: [{ action: 'hue.off', params: {} }] }
    expect(sentence(d, CAT)).not.toContain('Sinon')
    expect(normalize(d).otherwise).toEqual([])
  })
})

describe('daysLabel / isRoutine', () => {
  it.each([[[0, 1, 2, 3, 4, 5, 6], 'tous les jours'], [[6, 5], 'le week-end'], [[2, 0], 'lun mer']])('%j', (d, out) => expect(daysLabel(d)).toBe(out))
  it('une automatisation à déclencheur manuel est une routine', () => {
    expect(isRoutine({ trigger: b('manual') })).toBe(true)
    expect(isRoutine({ trigger: b('time', { time: '07:30', days: [0] }) })).toBe(false)
  })
})

describe('defaultBlock', () => {
  it('valeurs de départ selon le type de paramètre', () => {
    const spec: BlockSpec = { type: 'time_between', label: 'entre deux heures', params: [{ name: 'start', type: 'time' }, { name: 'end', type: 'time' }] }
    expect(defaultBlock(spec)).toEqual({ type: 'time_between', params: { start: '22:00', end: '06:00' } })
    const alert: BlockSpec = { type: 'alert', label: 'alerte', params: [{ name: 'kind', type: 'choice', choices: ['any', 'disk'] }, { name: 'when', type: 'choice', choices: ['raised', 'resolved'] }] }
    expect(defaultBlock(alert).params).toEqual({ kind: 'any', when: 'raised' })
    expect(defaultBlock({ type: 'time', label: 'heure', params: [{ name: 'time', type: 'time' }, { name: 'days', type: 'days' }] }).params).toEqual({ time: '07:30', days: [0, 1, 2, 3, 4] })
  })
})

describe('draftError', () => {
  const ok: AutomationDraft = { ...EMPTY_DRAFT, name: 'x', actions: [{ action: 'hue.off', params: {} }] }
  it.each([
    [ok, ''], [{ ...ok, name: ' ' }, 'nom'], [{ ...ok, actions: [] }, 'action'],
    [{ ...ok, actions: [{ action: 'notify.app', params: { message: '  ' } }] }, 'message'],
    [{ ...ok, actions: [{ action: 'hue.scene', params: { scene_id: '' } }] }, 'scène'],
    [{ ...ok, trigger: b('time', { time: '07:30', days: [] }) }, 'jour'],
    [{ ...ok, trigger: b('tv', { state: 'on' }), conditions: [b('days', { days: [] })] }, 'jour'],
  ])('%#', (d, fragment) => {
    const e = draftError(d)
    if (fragment === '') expect(e).toBe('')
    else expect(e).toContain(fragment)
  })
})

describe('runLabel', () => {
  const base = { at: 1, trigger: 'alert', why: '', success: true, failed: 0, detail: '' }
  it.each([
    [base, 'réussie'], [{ ...base, success: false, failed: 2 }, '2 action(s) en échec'],
    [{ ...base, skipped: true, why: 'condition non remplie : hors de la plage' }, 'non lancée — condition non remplie : hors de la plage'],
  ])('%#', (r, out) => expect(runLabel(r)).toBe(out))
})

describe('sameDraft', () => {
  it('même contenu malgré un ordre de champs différent (régression : l’éditeur se croyait toujours modifié)', () => {
    const reordered = { report: { failure: '', success: '', to: 'app', on: 'failure' }, max_per_day: 0, otherwise: [], match: 'all', cooldown_min: 5, actions: [], conditions: [], trigger: { params: {}, type: 'manual' }, enabled: true, name: '' } as AutomationDraft
    expect(sameDraft(EMPTY_DRAFT, reordered)).toBe(true)
  })
  it('détecte un vrai changement', () => {
    expect(sameDraft(EMPTY_DRAFT, { ...EMPTY_DRAFT, name: 'x' })).toBe(false)
    expect(sameDraft(EMPTY_DRAFT, { ...EMPTY_DRAFT, actions: [{ action: 'hue.off', params: {} }] })).toBe(false)
    expect(sameDraft(EMPTY_DRAFT, { ...EMPTY_DRAFT, trigger: b('tv', { state: 'on' }) })).toBe(false)
  })
})

describe('normalize (routine)', () => {
  const messy: AutomationDraft = { ...EMPTY_DRAFT, name: 'r', enabled: false, cooldown_min: 60, conditions: [b('days', { days: [] })], actions: [{ action: 'hue.off', params: {} }] }
  it('une routine n’emporte ni condition masquée, ni pause, ni cadence', () => {
    expect(normalize({ ...messy, otherwise: [{ action: 'hue.off', params: {} }], max_per_day: 3, match: 'any' })).toMatchObject({ conditions: [], otherwise: [], match: 'all', enabled: true, cooldown_min: 5, max_per_day: 0 })
  })
  it('une condition invisible ne bloque pas l’enregistrement d’une routine', () => expect(draftError(messy)).toBe(''))
  it('une automatisation déclenchée garde tout', () => {
    const auto = { ...messy, trigger: b('tv', { state: 'on' }) }
    expect(normalize(auto)).toBe(auto)
    expect(draftError(auto)).toContain('jour')
  })
})

describe('completeBlock / choiceLabel / sameDraft', () => {
  const spec: BlockSpec = { type: 'alert', label: 'alerte', params: [{ name: 'kind', type: 'choice', choices: ['any', 'disk'] }, { name: 'when', type: 'choice', choices: ['raised', 'resolved'] }] }
  it('complète un paramètre absent sans toucher aux présents', () => {
    expect(completeBlock(b('alert', { kind: 'disk' }), spec).params).toEqual({ kind: 'disk', when: 'raised' })
    expect(completeBlock(b('alert', { kind: 'disk' }), undefined).params).toEqual({ kind: 'disk' })
  })
  it('les libellés dépendent du paramètre, pas seulement de la valeur', () => {
    expect(choiceLabel('kind', 'backup')).toBe('sauvegarde')
    expect(choiceLabel('name', 'backup')).toBe('backup')          // un service de ce nom garde son nom
    expect(choiceLabel('name', 'any')).toBe('n’importe lequel')
    expect(choiceLabel('kind', 'any')).toBe('n’importe laquelle')
    expect(choiceLabel('mode', 'LOUNGE_LIGHT')).toBe('lounge')
    expect(choiceLabel('source', 'SAT/CBL')).toBe('sat/cbl')
    expect(choiceLabel('state', 'up')).toBe('revient')
    expect(choiceLabel('state', 'up', 'service_is')).toBe('en marche')     // condition : un état, pas un changement
    expect(choiceLabel('state', 'on', 'tv_is')).toBe('allumée')
    expect(choiceLabel('state', 'off', 'lights_are')).toBe('éteintes')
    expect(choiceLabel('state', 'on', 'lights')).toBe('s’allument')
    expect(choiceLabel('metric', 'gpu_temp')).toBe('température du gpu')
    expect(boolLabel('muted', true)).toBe('couper le son')
    expect(boolLabel('on', false)).toBe('éteindre')
  })
  it('sameDraft ignore l’ordre des paramètres d’un bloc', () => {
    const a = { ...EMPTY_DRAFT, trigger: b('alert', { kind: 'disk', when: 'raised' }) }
    const c = { ...EMPTY_DRAFT, trigger: b('alert', { when: 'raised', kind: 'disk' }) }
    expect(sameDraft(a, c)).toBe(true)
  })
})

describe('toDraft / preview', () => {
  it('complète ce qu’une ancienne version n’envoyait pas', () => {
    const d = toDraft({ name: 'x', trigger: b('manual'), actions: [] })
    expect(d).toMatchObject({ conditions: [], otherwise: [], match: 'all', max_per_day: 0, report: { on: 'failure', to: 'app' } })
  })
  it('ne garde que les champs du brouillon (ni id ni historique dans le corps d’un PUT)', () => {
    const fromApi = { id: 'a1', created: 'x', last_run: null, history: [{ at: 1 }], name: 'x', trigger: b('manual'), actions: [], enabled: false }
    expect(Object.keys(toDraft(fromApi as never)).sort()).toEqual(Object.keys(EMPTY_DRAFT).sort())
    expect(toDraft(fromApi as never).enabled).toBe(false)
  })
  it('aperçu d’un message avec ses variables ; une accolade inconnue reste', () => {
    const out = preview('{nom} : {titre} — {resultat} ({inconnue})', 'fini', new Date(2026, 9, 5, 22, 30))
    expect(out).toBe('fini : Metropolis.mkv — réussie ({inconnue})')
    expect(preview('{jour} {heure}', '', new Date(2026, 9, 5, 22, 30))).toBe('lundi 22:30')
    expect(preview('{nom}', '{heure}', new Date(2026, 9, 5, 22, 30))).toBe('{heure}')     // une seule passe
    expect(preview('{titre}'.repeat(60), 'x', new Date())).toHaveLength(300)
  })
})

describe('diagramme', () => {
  const act = (n: number) => Array.from({ length: n }, () => ({ action: 'hue.off', params: {} }))
  const pos = (f: ReturnType<typeof layout>) => Object.fromEntries(f.nodes.map((n) => [n.id, [n.col, n.row]]))

  it('routine : déclencheur puis actions sur une ligne, sans porte ni sinon', () => {
    const f = layout({ ...EMPTY_DRAFT, actions: act(2), conditions: [b('tv_is', { state: 'on' })], otherwise: act(1) }, CAT)
    expect(pos(f)).toEqual({ trigger: [0, 0], 'then-0': [1, 0], 'then-1': [2, 0], 'add-then': [3, 0] })
    expect(f.edges).toEqual([{ from: 'trigger', to: 'then-0', label: undefined }, { from: 'then-0', to: 'then-1', label: undefined }, { from: 'then-1', to: 'add-then', label: undefined }])
    expect([f.cols, f.rows]).toEqual([4, 1])
  })

  it('avec conditions : porte à deux sorties, vrai en haut et faux en bas', () => {
    const d = { ...EMPTY_DRAFT, trigger: b('tv', { state: 'off' }), conditions: [b('tv_is', { state: 'on' })], actions: act(2), otherwise: act(1) }
    const f = layout(d, CAT)
    expect(pos(f)).toEqual({
      trigger: [0, 0], if: [1, 0], 'then-0': [2, 0], 'then-1': [3, 0], 'add-then': [4, 0], 'else-0': [2, 1], 'add-else': [3, 1],
    })
    expect(f.edges.filter((e) => e.label).map((e) => [e.from, e.to, e.label])).toEqual([['if', 'then-0', 'vrai'], ['if', 'else-0', 'faux']])
    expect([f.cols, f.rows]).toEqual([5, 2])
  })

  it('sans condition : invite à en ajouter une ; sinon vide : son « + » porte l’étiquette faux', () => {
    const none = layout({ ...EMPTY_DRAFT, trigger: b('download_done', { contains: '' }), actions: act(1) }, CAT)
    expect(none.nodes.map((n) => n.kind)).toEqual(['trigger', 'add-if', 'then', 'add-then'])
    const gate = layout({ ...EMPTY_DRAFT, trigger: b('tv', { state: 'on' }), conditions: [b('days', { days: [0] })], actions: act(1) }, CAT)
    expect(gate.edges.find((e) => e.to === 'add-else')).toEqual({ from: 'if', to: 'add-else', label: 'faux' })
  })

  it('au plafond d’actions, plus de nœud « + » sur la branche', () => {
    const f = layout({ ...EMPTY_DRAFT, actions: act(3) }, CAT, {}, true, 3)
    expect(f.nodes.some((n) => n.kind === 'add-then')).toBe(false)
  })

  it('lecture seule : aucun nœud « + »', () => {
    const f = layout({ ...EMPTY_DRAFT, trigger: b('tv', { state: 'on' }), conditions: [b('days', { days: [0] })], actions: act(1) }, CAT, {}, false)
    expect(f.nodes.map((n) => n.id)).toEqual(['trigger', 'if', 'then-0'])
  })

  it('résultat d’un passage sur chaque nœud', () => {
    const d = { ...EMPTY_DRAFT, trigger: b('tv', { state: 'on' }), conditions: [b('days', { days: [0] })], actions: act(3), otherwise: act(1) }
    const f = layout(d, CAT, {}, false)
    const node = (id: string) => f.nodes.find((n) => n.id === id)!
    const run = { at: 1, trigger: 'tv', why: '', success: false, failed: 1, detail: '', branch: 'then' as const,
      steps: [{ action: 'a', label: 'a', ok: true, error: '' }, { action: 'b', label: 'b', ok: false, error: 'x' }, { action: 'c', label: 'c', ok: false, error: '', not_run: true }] }
    expect(['trigger', 'if', 'then-0', 'then-1', 'then-2', 'else-0'].map((id) => nodeResult(node(id), run))).toEqual(['ok', 'ok', 'ok', 'fail', 'idle', 'off'])
    const skipped = { ...run, skipped: true, steps: [], why: 'condition non remplie : il fallait la tv allumée' }
    expect(['if', 'then-0', 'else-0'].map((id) => nodeResult(node(id), skipped))).toEqual(['fail', 'off', 'off'])
    // non lancée pour une autre raison (plafond, cadence) : la porte n'est pas en cause
    expect(nodeResult(node('if'), { ...skipped, why: 'déjà lancée 3 fois aujourd’hui (plafond : 3)' })).toBe('off')
    // ancien passage sans détail par étape
    expect(nodeResult(node('then-1'), { ...run, steps: undefined, success: true })).toBe('ok')
    expect(nodeResult(node('then-0'), null)).toBeNull()
    expect(nodeResult(node('else-0'), { ...run, branch: 'else', steps: [{ action: 'a', label: 'a', ok: true, error: '' }] })).toBe('ok')
  })
})

describe('demander à lyra', () => {
  const lyra = (tool: string, phrase = 'allume la télé') => ({ action: 'lyra.tool', params: { phrase, tool, arguments: {} } })
  const draft = (step: ReturnType<typeof lyra>) => ({ ...EMPTY_DRAFT, name: 'essai', actions: [step] })

  it('refuse d’enregistrer une phrase qui n’a pas été analysée', () => {
    expect(draftError(draft(lyra('')))).toContain('analyser')
    expect(draftError(draft(lyra('tv.power_on')))).toBe('')
  })

  it('décrit l’action par sa phrase, et dit quand elle reste à analyser', () => {
    expect(describeAction(lyra('tv.power_on'), [])).toBe('lyra : « allume la télé »')
    expect(describeAction(lyra(''), [])).toBe('lyra : phrase à faire analyser')
  })

  it('montre l’appel résolu avec ses arguments', () => {
    expect(lyraCall('tv.power_on', {})).toBe('tv.power_on')
    expect(lyraCall('hue.turn_off_group', { group_id: 81 })).toBe('hue.turn_off_group (group_id : 81)')
  })

  it('un changement d’arguments compte comme une modification', () => {
    const a = draft(lyra('hue.turn_off_group'))
    const b = { ...a, actions: [{ ...a.actions[0], params: { ...a.actions[0].params, arguments: { group_id: 81 } } }] }
    expect(sameDraft(a, a)).toBe(true)
    expect(sameDraft(a, b)).toBe(false)
  })
})

describe('passages regroupés', () => {
  it('compte les « non lancé » identiques d’affilée', () => {
    const run = { at: 1, trigger: 'interval', why: 'état inconnu (la tv allumée)', skipped: true, success: true, failed: 0, detail: '' }
    expect(runLabel(run)).toBe('non lancée — état inconnu (la tv allumée)')
    expect(runLabel({ ...run, times: 12 })).toBe('non lancée (×12) — état inconnu (la tv allumée)')
  })
})

describe('blocs du 2026-10-13', () => {
  const B = (type: string, params: Record<string, string | number>) => ({ type, params })
  it('se lisent en phrases', () => {
    expect(describeTrigger(B('atelier', { when: 'waiting', contains: 'batterie' }))).toContain('boucle de l’atelier 3d')
    expect(describeTrigger(B('atelier', { when: 'verdict', contains: '' }))).toBe('quand une boucle de l’atelier 3d rend un verdict')
    expect(describeTrigger(B('session_stuck', { minutes: 20, contains: '' }))).toBe('quand une session claude au travail ne bouge plus depuis 20 min')
    expect(describeCondition(B('presence', { state: 'away' }))).toBe('tu es absent (écrans du pc éteints)')
    expect(describeAction({ action: 'service.start', params: { name: 'trigger' } }, [])).toBe('redémarrer le service qui vient de tomber')
    expect(describeAction({ action: 'tests.run', params: { suite: 'atelier' } }, [])).toBe('lancer les tests : modelisation-3d — tests rapides')
    expect(describeAction({ action: 'tv.show', params: { source: 'hdmi1', screen: 'tele' } }, [])).toBe('afficher le tableau du mode télé sur la télé (entrée hdmi 1)')
    expect(describeAction({ action: 'tv.restore', params: {} }, [])).toBe('remettre sur la télé ce qu’elle affichait')
    expect(describeAction({ action: 'camera.power', params: { on: true } }, [])).toBe('allumer la caméra')
    expect(describeAction({ action: 'camera.standby', params: { on: false } }, [])).toBe('sortir la caméra de veille')
    expect(describeAction({ action: 'camera.background', params: { fond: 'or' } }, [])).toBe('fond de la caméra : or et braise')
    expect(describeAction({ action: 'spatial.scene', params: { id: 'moment04' } }, [], { 'lumiere:moment04': 'nuit' }))
      .toBe('lumière 3d : jouer « nuit » (si les lampes sont déjà en direct)')
    expect(describeAction({ action: 'spatial.scene', params: { id: 'abc' } }, [])).toContain('« abc »')
  })
})

describe('blocs du 2026-10-19', () => {
  it('déclencheurs dits en clair', () => {
    expect(describeTrigger({ type: 'idle', params: { minutes: 45 } })).toBe('quand je n’ai touché ni clavier ni souris depuis 45 min')
    expect(describeTrigger({ type: 'back', params: { after_min: 240 } })).toBe('quand je reviens après au moins 4 h d’absence')
    expect(describeTrigger({ type: 'back', params: { after_min: 90 } })).toBe('quand je reviens après au moins 1 h 30 d’absence')
    expect(describeTrigger({ type: 'ci', params: { result: 'echec', contains: '' } })).toBe('quand une ci github se termine en échec')
    expect(describeTrigger({ type: 'ci', params: { result: 'tous', contains: 'lyra' } })).toBe('quand une ci github contenant « lyra » se termine')
    expect(describeTrigger({ type: 'docker', params: { state: 'any', code: 'erreur', contains: '' } }))
      .toBe('quand un conteneur docker s’arrête ou tombe malade (arrêt sur erreur)')
    expect(describeTrigger({ type: 'docker', params: { state: 'unhealthy', code: 'erreur', contains: '' } })).toBe('quand un conteneur docker tombe malade')
    expect(describeTrigger({ type: 'gpu_oom', params: {} })).toBe('quand la carte graphique manque de mémoire')
  })

  it('condition et actions', () => {
    expect(describeCondition({ type: 'idle', params: { state: 'idle', minutes: 10 } })).toBe('ni clavier ni souris depuis 10 min')
    expect(describeCondition({ type: 'idle', params: { state: 'active', minutes: 5 } })).toBe('clavier ou souris touchés dans les 5 min dernières')
    const cat: ActionSpec[] = []
    expect(describeAction({ action: 'docker.restart', params: { name: 'trigger' } }, cat)).toBe('relancer le conteneur qui vient de tomber')
    expect(describeAction({ action: 'vm.start', params: { vm: 'debian-lab' } }, cat)).toBe('démarrer la vm debian-lab')
    expect(describeAction({ action: 'bt.connect', params: { device: 'AA:BB:CC:DD:EE:01' } }, cat, { 'bt:AA:BB:CC:DD:EE:01': 'casque' })).toBe('reconnecter casque')
  })

  it('« inspecter » et « le conteneur qui vient de tomber » demandent le bon déclencheur', () => {
    const base = { ...EMPTY_DRAFT, name: 'x' }
    expect(draftError({ ...base, trigger: { type: 'time', params: { time: '07:00', days: [0] } }, actions: [{ action: 'ci.inspect', params: {} }] })).toContain('ci github')
    expect(draftError({ ...base, trigger: { type: 'ci', params: { result: 'echec', contains: '' } }, actions: [{ action: 'ci.inspect', params: {} }] })).toBe('')
    expect(draftError({ ...base, trigger: { type: 'interval', params: { every_min: 30 } }, actions: [{ action: 'docker.restart', params: { name: 'trigger' } }] }))
      .toContain('conteneur docker tombe')
  })
})
