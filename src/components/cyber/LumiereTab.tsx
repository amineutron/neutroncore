import { useState } from 'react'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import { usePoll, fmtAgo } from '../../lib/poll'
import { confirmDialog, toast } from '../../lib/dialog'
import { NOM_NIVEAU, heureValide, phraseDecision, type ConfigLumiere, type Decision, type EtatLumiere, type ReglagesCyber } from '../../lib/cyber'
import { Btn, Card, Chip, Loader } from '../ui'
import { NumField } from '../NumField'
import './cyber.css'

type Lampe = { id: string; name: string; reachable: boolean }
type Simulation = { decision: Decision; ordres: { outil: string; arguments: Record<string, unknown> }[] }

export function LumiereTab() {
  const etat = usePoll<EtatLumiere>(() => apiGet('/cyber/lumiere'), 15000)
  const lampes = usePoll<{ lampes: Lampe[] }>(() => apiGet('/cyber/lampes'), 300000)
  const [sim, setSim] = useState<Simulation | null>(null)
  const [niveauSim, setNiveauSim] = useState('crit')
  const [heureSim, setHeureSim] = useState('12:00')
  const [rampeSim, setRampeSim] = useState(false)
  const c = etat.data?.config
  if (!c || !etat.data) return etat.error ? <Chip tone="crit">API injoignable : {etat.error}</Chip> : <Loader label="chargement…" />

  const maj = async (p: Partial<ConfigLumiere>) => {
    try { await apiPut<ReglagesCyber>('/cyber/reglages', { lumiere: p }); etat.refresh() } catch (e) { toast((e as Error).message, 'crit') }
  }
  const interrupteur = async () => {
    if (!c.actif) {
      const ok = await confirmDialog({
        title: "activer la lumière selon l'alerte cyber ?",
        body: `Les lampes choisies prendront une couleur (plafond ${c.bri_max_pct} %) pendant ${c.duree_s} s quand une alerte ${c.niveau_min === 'crit' ? 'critique' : 'de niveau attention ou plus'} arrive, puis reviendront à leur état d'avant. Jamais de ${c.silence.debut} à ${c.silence.fin}, jamais pendant un réveil.`,
        ok: 'activer',
      })
      if (!ok) return
    }
    await maj({ actif: !c.actif })
  }
  const simuler = async () => {
    try { setSim(await apiPost<Simulation>('/cyber/lumiere/simuler', { niveau: niveauSim, heure: heureSim, rampe: rampeSim, actif: true })) } catch (e) { toast((e as Error).message, 'crit') }
  }
  const arreter = async () => {
    try { const r = await apiPost<{ success: boolean; error?: string }>('/cyber/lumiere/arreter'); toast(r.success ? 'lampes remises' : r.error ?? 'échec', r.success ? 'ok' : 'warn'); etat.refresh() } catch { toast('action refusée', 'crit') }
  }
  const heure = (cle: 'debut' | 'fin', v: string) => { if (heureValide(v)) void maj({ silence: { ...c.silence, [cle]: v } }) }

  return (
    <>
      <Card title="lumière selon l'alerte" lite={`niveau courant : ${NOM_NIVEAU[etat.data.niveau_courant as 'ok'] ?? etat.data.niveau_courant}`}>
        <div className={`cy-master ${c.actif ? 'on' : ''}`}>
          <label className="at-check"><input type="checkbox" checked={c.actif} onChange={() => void interrupteur()} /> interrupteur général</label>
          <Chip tone={c.actif ? 'gold' : undefined}>{c.actif ? 'activé' : 'désactivé'}</Chip>
          {etat.data.phase === 'actif' && <><Chip tone="rose">ambiance en cours : {NOM_NIVEAU[etat.data.niveau_applique as 'crit']}</Chip><Btn sm onClick={() => void arreter()}>remettre les lampes</Btn></>}
          {etat.data.rampe_en_cours && <Chip>un réveil ou une rampe joue</Chip>}
        </div>
        <p className="cy-note">Désactivé par défaut. Rien ne s'allume sans lampe choisie, ni de nuit, ni pendant un réveil. Les lampes reviennent à leur état d'avant à la fin.</p>
        <div className="cy-form">
          <label className="wide">lampes concernées
            <span className="cy-veille">
              {(lampes.data?.lampes ?? []).map((l) => (
                <label key={l.id} className="at-check"><input type="checkbox" checked={c.lampes.includes(l.id)}
                  onChange={() => void maj({ lampes: c.lampes.includes(l.id) ? c.lampes.filter((x) => x !== l.id) : [...c.lampes, l.id] })} />{l.name}{l.reachable ? '' : ' (injoignable)'}</label>
              ))}
              {lampes.data && lampes.data.lampes.length === 0 && <span className="cy-note">aucune lampe lue (demon Lyra ou pont injoignable)</span>}
            </span>
          </label>
          <label>à partir de quel niveau
            <select value={c.niveau_min} onChange={(e) => void maj({ niveau_min: e.target.value as 'warn' | 'crit' })}>
              <option value="crit">critique seulement</option><option value="warn">attention et critique</option>
            </select>
          </label>
          <label>luminosité maximale (%)<NumField value={c.bri_max_pct} min={1} max={100} label="luminosité maximale" onCommit={(v) => void maj({ bri_max_pct: v })} /></label>
          <label>durée de l'ambiance (s)<NumField value={c.duree_s} min={10} max={1800} label="durée" onCommit={(v) => void maj({ duree_s: v })} /></label>
          <label>pause entre deux ambiances (s)<NumField value={c.cooldown_s} min={0} max={86400} label="pause" onCommit={(v) => void maj({ cooldown_s: v })} /></label>
          <label>silence de<input type="time" defaultValue={c.silence.debut} onBlur={(e) => heure('debut', e.target.value)} /></label>
          <label>silence jusqu'à<input type="time" defaultValue={c.silence.fin} onBlur={(e) => heure('fin', e.target.value)} /></label>
          <label>confirmations avant d'agir<NumField value={c.confirmations} min={1} max={10} label="confirmations" onCommit={(v) => void maj({ confirmations: v })} /></label>
          <label>couleur attention<input type="color" value={c.couleurs.warn} onChange={(e) => void maj({ couleurs: { ...c.couleurs, warn: e.target.value } })} /></label>
          <label>couleur critique<input type="color" value={c.couleurs.crit} onChange={(e) => void maj({ couleurs: { ...c.couleurs, crit: e.target.value } })} /></label>
        </div>
      </Card>
      <Card title="simulation" lite="n'allume aucune lampe">
        <div className="cy-filters">
          <select value={niveauSim} onChange={(e) => setNiveauSim(e.target.value)} aria-label="niveau simulé">
            {['ok', 'info', 'warn', 'crit'].map((n) => <option key={n} value={n}>{NOM_NIVEAU[n as 'ok']}</option>)}
          </select>
          <input type="time" value={heureSim} onChange={(e) => setHeureSim(e.target.value)} aria-label="heure simulée" />
          <label className="at-check"><input type="checkbox" checked={rampeSim} onChange={(e) => setRampeSim(e.target.checked)} />un réveil joue</label>
          <Btn sm onClick={() => void simuler()}>simuler</Btn>
        </div>
        {sim && <p className="cy-note"><b>{phraseDecision(sim.decision)}</b>{sim.ordres.length > 0 && ` (${sim.ordres.length} ordres, rien n'est envoyé)`}</p>}
      </Card>
      <Card title="journal" lite="les 20 derniers passages">
        <div className="cy-journal">
          {etat.data.journal.length === 0 && <span className="cy-note">rien pour l'instant</span>}
          {etat.data.journal.map((j, i) => <span key={i}>{fmtAgo(j.at)} : {phraseDecision(j)}{j.detail ? ` (${j.detail})` : ''}</span>)}
        </div>
      </Card>
    </>
  )
}
