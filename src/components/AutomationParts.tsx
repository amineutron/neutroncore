import type { Catalogue, ParamSpec, Value } from '../lib/automations'
import type { Step } from '../lib/routines'
import type { Branch, DraftApi, Keyed } from '../lib/useAutomationDraft'
import { Params, type Lists } from './BlockParams'
import { LyraPhrase } from './LyraPhrase'

// Éditeurs d'un bloc, partagés par la vue « blocs » et l'inspecteur du diagramme.

export function TriggerEditor({ api, catalogue, lists }: { api: DraftApi; catalogue: Catalogue; lists: Lists }) {
  const spec = catalogue.triggers.find((t) => t.type === api.trigger.type)
  return (
    <>
      <div className="rt-step">
        <select value={api.trigger.type} aria-label="Déclencheur" onChange={(e) => api.setTriggerType(e.target.value)}>
          {catalogue.triggers.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        {spec && <Params specs={spec.params} values={api.trigger.params} lists={lists} block={api.trigger.type} onChange={api.setTriggerParam} />}
      </div>
      {api.trigger.type === 'manual' && <p className="au-note">Une routine : elle se lance d'un bouton, depuis cette page ou la palette (Ctrl+K).</p>}
      {api.trigger.type === 'time' && <p className="au-note">Elle apparaîtra dans l'agenda, avec le résultat de chaque passage.</p>}
      {api.trigger.type === 'event' && <p className="au-note">À envoyer par un script ou n8n : POST /automations/event/{String(api.trigger.params.name || 'nom')} avec la clé de l'API. Un champ « title » rejoint la variable {'{titre}'}.</p>}
      {api.trigger.type === 'resource' && <p className="au-note">Déclenche une fois quand la mesure reste au-dessus du seuil, puis se réarme quand elle repasse dessous.</p>}
    </>
  )
}

export function ConditionsEditor({ api, catalogue, lists }: { api: DraftApi; catalogue: Catalogue; lists: Lists }) {
  return (
    <>
      {api.conds.length > 1 && (
        <div className="au-match" role="group" aria-label="Combinaison des conditions">
          <button className={`btn sm ${api.meta.match === 'all' ? 'solid' : ''}`} aria-pressed={api.meta.match === 'all'} onClick={() => api.patchMeta({ match: 'all' })}>toutes</button>
          <button className={`btn sm ${api.meta.match === 'any' ? 'solid' : ''}`} aria-pressed={api.meta.match === 'any'} onClick={() => api.patchMeta({ match: 'any' })}>au moins une</button>
        </div>
      )}
      {api.conds.map((c) => {
        const spec = catalogue.conditions.find((x) => x.type === c.type)
        return (
          <div className="rt-step" key={c.k}>
            <button className={`btn sm au-not ${c.negate ? 'solid' : ''}`} aria-pressed={Boolean(c.negate)} title="inverser la condition" onClick={() => api.toggleNegate(c.k)}>pas</button>
            <select value={c.type} aria-label="Condition" onChange={(e) => api.setCondType(c.k, e.target.value)}>
              {catalogue.conditions.map((x) => <option key={x.type} value={x.type}>{x.label}</option>)}
            </select>
            {spec && <Params specs={spec.params} values={c.params} lists={lists} block={c.type} onChange={(n, v) => api.setCondParam(c.k, n, v)} />}
            <span className="rt-tools"><button className="btn sm danger" aria-label="Retirer la condition" onClick={() => api.removeCond(c.k)}>×</button></span>
          </div>
        )
      })}
      <button className="btn sm" disabled={api.conds.length >= catalogue.limits.conditions} onClick={api.addCond}>+ ajouter une condition</button>
      <p className="au-note">Si un appareil ou un service ne répond pas, on ne sait pas : dans le doute, rien ne se lance — ni « alors », ni « sinon ».</p>
    </>
  )
}

export function StepEditor({ api, catalogue, lists, branch, step, index, count }: {
  api: DraftApi; catalogue: Catalogue; lists: Lists; branch: Branch; step: Keyed<Step>; index: number; count: number
}) {
  const spec = catalogue.actions.find((a) => a.action === step.action)
  const word = branch === 'then' ? 'action' : 'action « sinon »'
  return (
    <div className="au-step">
      <div className="rt-step">
        <span className="rt-num">{index + 1}</span>
        <select value={step.action} aria-label={`${word} ${index + 1}`} onChange={(e) => api.setStepAction(branch, step.k, e.target.value)}>
          {!spec && <option value={step.action}>{step.action}</option>}
          {catalogue.actions.map((a) => <option key={a.action} value={a.action}>{a.label}</option>)}
        </select>
        {step.action === 'lyra.tool'
          ? <LyraPhrase step={step} label={`${word} ${index + 1}`} onChange={(patch) => api.setStepParams(branch, step.k, patch)} />
          : spec && <Params specs={spec.params as ParamSpec[]} values={step.params as Record<string, Value>} lists={lists} block={step.action} onChange={(n, v) => api.setStepParam(branch, step.k, n, v)} />}
        <span className="rt-tools">
          <button className="btn sm" aria-label={`Avancer : ${word} ${index + 1}`} disabled={index === 0} onClick={() => api.moveStepBy(branch, index, -1)}>↑</button>
          <button className="btn sm" aria-label={`Reculer : ${word} ${index + 1}`} disabled={index === count - 1} onClick={() => api.moveStepBy(branch, index, 1)}>↓</button>
          <button className="btn sm danger" aria-label={`Retirer : ${word} ${index + 1}`} onClick={() => api.removeStep(branch, step.k)}>×</button>
        </span>
      </div>
      {step.action !== 'wait' && (
        <div className="au-step-opts">
          <label>si elle échoue
            <select value={step.on_error ?? 'continue'} aria-label={`En cas d'échec : ${word} ${index + 1}`}
              onChange={(e) => api.setStepOption(branch, step.k, { on_error: e.target.value as 'continue' | 'stop', retry: step.retry })}>
              <option value="continue">continuer la suite</option><option value="stop">arrêter la suite</option>
            </select>
          </label>
          {!(catalogue.no_retry ?? []).includes(step.action) && (
            <label>réessayer
              <select value={step.retry ?? 0} aria-label={`Réessais : ${word} ${index + 1}`}
                onChange={(e) => api.setStepOption(branch, step.k, { on_error: step.on_error, retry: Number(e.target.value) })}>
                {Array.from({ length: catalogue.limits.retry + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'jamais' : `${n} fois`}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  )
}

export function StepsEditor({ api, catalogue, lists, branch }: { api: DraftApi; catalogue: Catalogue; lists: Lists; branch: Branch }) {
  const steps = branch === 'then' ? api.then : api.other
  return (
    <>
      {steps.map((s, i) => <StepEditor key={s.k} api={api} catalogue={catalogue} lists={lists} branch={branch} step={s} index={i} count={steps.length} />)}
      <button className="btn sm" disabled={steps.length >= catalogue.limits.actions} onClick={() => api.addStep(branch)}>
        + ajouter une action{branch === 'else' ? ' « sinon »' : ''}
      </button>
    </>
  )
}
