import { useState } from 'react'
import { apiGet, apiPut } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { fmtAgo, usePoll } from '../../lib/poll'
import { commitCourt, ecrirePref, etiquetteTendance, fmtDuree, lirePref, type LigneSuite, type ReglagesSante, type VueSante } from '../../lib/qualite'
import { Card, Chip, Loader } from '../ui'
import { NumField } from '../NumField'
import { Courbe } from './Courbe'
import { SuiteDetail } from './SuiteDetail'

const PREF = 'neutroncore_qualite_tests'
type Prefs = { suite: string; seulement_problemes: boolean; reglages_ouverts: boolean }
const DEFAUT: Prefs = { suite: '', seulement_problemes: false, reglages_ouverts: false }

function Ligne({ l, actif, onClick }: { l: LigneSuite; actif: boolean; onClick: () => void }) {
  const t = etiquetteTendance(l.tendance)
  return (
    <div className="logline" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 6px', cursor: 'pointer', borderRadius: 6, background: actif ? 'var(--gold-soft)' : 'transparent' }}>
      <span className={`dot ${l.dernier.ok ? 'ok' : 'crit'}`} />
      <b style={{ flex: 1, minWidth: 120 }}>{l.label}</b>
      <Courbe valeurs={l.tendance.points} w={80} h={20} tone={t.tone === 'warn' ? 'warn' : t.tone === 'ok' ? 'ok' : ''} />
      <span style={{ minWidth: 52, textAlign: 'right' }}>{fmtDuree(l.dernier.duree)}</span>
      {l.instable && <Chip tone="warn">instable</Chip>}
      {t.tone === 'warn' && <Chip tone="warn">{t.texte}</Chip>}
      {!l.dernier.ok && <Chip tone="crit">en échec</Chip>}
      <span style={{ flexBasis: '100%', color: 'var(--faint)' }}>
        {fmtAgo(l.dernier.started)} · {commitCourt(l.dernier.commit)}{l.dernier.dirty ? ' + modifs' : ''} · {l.taux_reussite} % de réussite sur {l.runs} run{l.runs > 1 ? 's' : ''}
        {!l.dernier.ok && l.echecs_en_cours.length > 0 ? ` · ${l.echecs_en_cours[0]}${l.echecs_en_cours.length > 1 ? ` +${l.echecs_en_cours.length - 1}` : ''}` : ''}
      </span>
    </div>
  )
}

function Reglages({ r, onSaved }: { r: ReglagesSante; onSaved: () => void }) {
  async function maj(part: Partial<ReglagesSante>) {
    try { await apiPut('/tests/sante/reglages', part); onSaved() } catch { toast('réglage refusé', 'crit') }
  }
  const champ = (label: string, cle: 'fenetre' | 'seuil_tendance' | 'seuil_bench', min: number, max: number, aide: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--muted)' }} title={aide}>{label}
      <NumField value={r[cle]} min={min} max={max} label={label} onCommit={(v) => void maj({ [cle]: v })} />
    </label>
  )
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {champ('runs examinés', 'fenetre', 4, 50, 'Nombre de derniers runs pris en compte pour la tendance et l\'instabilité')}
      {champ('ralentissement signalé (%)', 'seuil_tendance', 5, 100, 'Écart de durée à partir duquel une batterie est dite plus lente ou plus rapide')}
      {champ('écart de bench notable (%)', 'seuil_bench', 2, 100, 'En dessous, deux durées sont jugées équivalentes dans le bench')}
      <label className="at-check"><input type="checkbox" checked={r.ignorer_dirty} onChange={(e) => void maj({ ignorer_dirty: e.target.checked })} /> ignorer les runs lancés avec des modifications non commitées</label>
    </div>
  )
}

export function TestsSante() {
  const vue = usePoll<VueSante>(() => apiGet('/tests/sante'), 8000)
  const [prefs, setPrefs] = useState<Prefs>(() => lirePref(PREF, DEFAUT))
  const maj = (p: Partial<Prefs>) => setPrefs((c) => { const n = { ...c, ...p }; ecrirePref(PREF, n); return n })

  const suites = (vue.data?.suites ?? []).filter((l) => !prefs.seulement_problemes || !l.dernier.ok || l.instable || l.tendance.etat === 'plus_lent')
  const choisie = (vue.data?.suites ?? []).some((l) => l.suite === prefs.suite) ? prefs.suite : (suites[0]?.suite ?? '')

  if (vue.error && !vue.data) return <Card><Chip tone="crit">API injoignable : {vue.error}</Chip></Card>
  if (!vue.data) return <Loader label="lecture de l'historique…" />
  if (vue.data.suites.length === 0) {
    return (
      <Card title="aucun run enregistré" lite="l'historique se remplit tout seul">
        <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Lance une batterie depuis l'écran « tests » : son résultat, sa durée et le commit testé sont gardés ici, et la tendance apparaît dès cinq runs réussis.</p>
      </Card>
    )
  }
  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <div>
        <Card title="batteries" lite={`${vue.data.total_runs} runs gardés`} style={{ marginBottom: 12 }}>
          <label className="at-check" style={{ marginBottom: 8, display: 'block' }}>
            <input type="checkbox" checked={prefs.seulement_problemes} onChange={(e) => maj({ seulement_problemes: e.target.checked })} /> seulement celles qui demandent attention
          </label>
          {suites.map((l) => <Ligne key={l.suite} l={l} actif={l.suite === choisie} onClick={() => maj({ suite: l.suite })} />)}
          {suites.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 12 }}>Rien à signaler : tout est vert, stable et sans ralentissement.</p>}
        </Card>
        <Card title="réglages" lite="fenêtre d'analyse et seuils">
          <div style={{ marginBottom: 8 }}><span className="chip" style={{ cursor: 'pointer' }} onClick={() => maj({ reglages_ouverts: !prefs.reglages_ouverts })}>{prefs.reglages_ouverts ? 'masquer' : 'modifier'}</span></div>
          {prefs.reglages_ouverts && <Reglages r={vue.data.reglages} onSaved={vue.refresh} />}
        </Card>
      </div>
      <div>{choisie ? <SuiteDetail key={choisie} suite={choisie} onPurge={() => { maj({ suite: '' }); vue.refresh() }} /> : <Card><span style={{ color: 'var(--faint)' }}>Choisis une batterie.</span></Card>}</div>
    </div>
  )
}
