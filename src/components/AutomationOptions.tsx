import { preview, type Catalogue } from '../lib/automations'
import type { DraftApi } from '../lib/useAutomationDraft'

const COOLDOWNS = [1, 5, 15, 60, 360, 1440]
const span = (v: number) => (v < 60 ? `${v} min` : v % 60 === 0 ? `${v / 60} h` : `${Math.floor(v / 60)} h ${v % 60}`)

// Options d'une automatisation : activité, cadence, plafond, et compte rendu personnalisé.
export function AutomationOptions({ api, catalogue }: { api: DraftApi; catalogue: Catalogue }) {
  const { meta, trigger } = api
  const routine = trigger.type === 'manual'
  const eventful = !routine && trigger.type !== 'time'
  const r = meta.report
  const message = (key: 'success' | 'failure', label: string, hint: string) => (
    <label className="rt-field">{label}
      <input value={r[key]} maxLength={catalogue.limits.report} placeholder={hint} onChange={(e) => api.patchReport({ [key]: e.target.value })} />
      {r[key] && <span className="au-preview">aperçu : {preview(r[key], meta.name, new Date())}</span>}
    </label>
  )
  return (
    <section className="au-block opts">
      <h4>options</h4>
      {!routine && (
        <div className="rt-sched">
          <label className="rt-check">
            <input type="checkbox" checked={meta.enabled} onChange={(e) => api.patchMeta({ enabled: e.target.checked })} />
            active
          </label>
          {eventful && (
            <label className="rt-check">au plus une fois toutes les
              <select value={meta.cooldown_min} aria-label="Délai minimal entre deux lancements" onChange={(e) => api.patchMeta({ cooldown_min: Number(e.target.value) })}>
                {[...new Set([...COOLDOWNS, meta.cooldown_min])].sort((a, b) => a - b).map((v) => <option key={v} value={v}>{span(v)}</option>)}
              </select>
            </label>
          )}
          <label className="rt-check">au plus
            <select value={meta.max_per_day} aria-label="Plafond de lancements par jour" onChange={(e) => api.patchMeta({ max_per_day: Number(e.target.value) })}>
              {[...new Set([0, 1, 2, 3, 5, 10, 20, meta.max_per_day])].sort((a, b) => a - b).map((v) => <option key={v} value={v}>{v === 0 ? 'sans limite' : `${v} fois par jour`}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="rt-sched">
        <label className="rt-check">me prévenir
          <select value={r.on} aria-label="Quand envoyer le compte rendu" onChange={(e) => api.patchReport({ on: e.target.value as typeof r.on })}>
            <option value="failure">seulement en cas d'échec</option><option value="always">à chaque passage</option><option value="never">jamais</option>
          </select>
        </label>
        {r.on !== 'never' && (
          <label className="rt-check">
            <select value={r.to} aria-label="Où envoyer le compte rendu" onChange={(e) => api.patchReport({ to: e.target.value as typeof r.to })}>
              <option value="app">dans l'app</option><option value="phone">sur le téléphone</option><option value="both">les deux</option>
            </select>
          </label>
        )}
      </div>
      {r.on === 'always' && message('success', 'message quand tout va bien (facultatif)', 'ex. {titre} traité en {duree}')}
      {r.on !== 'never' && message('failure', "message en cas d'échec (facultatif)", 'ex. {nom} : {echecs}')}
      <p className="au-note">
        Variables utilisables dans les messages : {catalogue.report_variables.map((v) => `{${v}}`).join(' ')}.
        {' '}{'{titre}'} vaut ce qui a déclenché (nom du téléchargement, de l'alerte, de l'événement…). Sans message, un texte par défaut est envoyé.
        L'historique garde tous les passages, quel que soit ce réglage.
      </p>
    </section>
  )
}
