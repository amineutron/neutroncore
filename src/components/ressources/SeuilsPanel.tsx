import { useState } from 'react'
import { apiDelete, apiPut } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { seuilDe, type Metrique, type Seuils } from '../../lib/ressources'
import { NumField } from '../NumField'
import { Card } from '../ui'
import './ressources.css'

/** Seuils d'alerte réglables : enregistrés à la validation de chaque champ, appliqués au relevé suivant. */
export function SeuilsPanel({ seuils, metriques, onChange }: {
  seuils: Seuils; metriques: Record<string, Metrique>; onChange: () => void
}) {
  const [ouvert, setOuvert] = useState(false)

  async function envoyer(patch: Record<string, unknown>) {
    try { await apiPut('/ressources/seuils', patch); onChange() }
    catch (e) { toast(e instanceof Error ? e.message : 'réglage refusé', 'crit'); onChange() }
  }
  async function remettre() {
    if (!(await confirmDialog({ title: 'remettre les seuils d\'origine ?', body: 'Tes réglages actuels seront remplacés.', ok: 'remettre' }))) return
    try { await apiDelete('/ressources/seuils'); onChange() } catch (e) { toast(e instanceof Error ? e.message : 'échec', 'crit') }
  }

  return (
    <Card title="seuils d'alerte" lite={seuils.actif ? 'alertes actives' : 'alertes coupées'}>
      <button type="button" className="rs-pill" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>{ouvert ? 'replier' : 'régler'}</button>
      {ouvert && (
        <div style={{ marginTop: 12 }}>
          <div className="rs-defaut">
            <button type="button" className="rs-pill" aria-pressed={seuils.actif} onClick={() => void envoyer({ actif: !seuils.actif })}>
              alertes dans le centre de notifications
            </button>
            <label>soutenu sur <NumField value={seuils.soutenu} min={1} max={30} label="Nombre de relevés de suite" onCommit={(v) => void envoyer({ soutenu: v })} /> relevé(s) d'une minute</label>
            <button type="button" className="btn sm" onClick={() => void remettre()}>valeurs d'origine</button>
          </div>
          <div className="rs-seuils">
            {Object.entries(metriques).map(([cle, m]) => {
              const s = seuilDe(seuils, cle)
              if (!s) return null
              return (
                <div className="rs-seuil" key={cle}>
                  <b>{m.libelle}</b>
                  <div><label>alerte <span>({m.unite})</span></label><NumField value={s.warn} min={1} max={m.max} label={`Seuil d'alerte, ${m.libelle}`} onCommit={(v) => void envoyer({ [cle]: { warn: v } })} /></div>
                  <div><label>critique <span>({m.unite})</span></label><NumField value={s.crit} min={1} max={m.max} label={`Seuil critique, ${m.libelle}`} onCommit={(v) => void envoyer({ [cle]: { crit: v } })} /></div>
                </div>
              )
            })}
          </div>
          <p className="rs-qui" style={{ marginTop: 10 }}>Une alerte n'est levée que si le seuil est dépassé sur tous les relevés de la période « soutenu » : une pointe isolée ne dit rien. Les disques pleins restent signalés par les alertes système.</p>
        </div>
      )}
    </Card>
  )
}
