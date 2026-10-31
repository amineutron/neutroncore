import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { SORTIES_DEFAULTS, TOGGLES, saveSortiesOn, type SortiesSettings, type SortiesSettingsResp } from '../../lib/sorties'
import { Btn } from '../ui'

/** Puce « sorties » de la barre de filtres de l'agenda (état mémorisé) + réglages repliables. */
export function SortiesFilter({ on, onToggle, onSettingsChanged }: {
  on: boolean; onToggle: (next: boolean) => void; onSettingsChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [cfg, setCfg] = useState<SortiesSettings>(SORTIES_DEFAULTS)
  const [ntfy, setNtfy] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    apiGet<SortiesSettingsResp>('/sorties/reglages').then((r) => { setCfg(r.settings); setNtfy(r.ntfy_configure) })
      .catch((e: Error) => toast(`réglages des sorties indisponibles : ${e.message}`, 'crit'))
  }, [open])

  async function save(patch: Partial<SortiesSettings>) {
    const prev = cfg
    setCfg({ ...cfg, ...patch })
    try {
      const r = await apiPut<SortiesSettingsResp>('/sorties/reglages', patch)
      setCfg(r.settings)
      onSettingsChanged()
    } catch (e) {
      setCfg(prev)
      toast(`réglage non enregistré : ${(e as Error).message}`, 'crit')
    }
  }

  async function test() {
    setBusy(true)
    try {
      const r = await apiPost<{ sent: number; reason?: string }>('/sorties/rappels/verifier')
      toast(r.sent > 0 ? `rappel envoyé (${r.sent})` : `rien envoyé : ${r.reason ?? 'aucune sortie aujourd\'hui'}`, r.sent > 0 ? 'ok' : 'warn')
    } catch (e) { toast(`échec : ${(e as Error).message}`, 'crit') } finally { setBusy(false) }
  }

  const toggle = () => { const next = !on; saveSortiesOn(next); onToggle(next) }
  const box = (key: (typeof TOGGLES)[number]['key'], label: string) => (
    <label key={key} style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'center' }}>
      <input type="checkbox" checked={cfg[key]} onChange={(e) => save({ [key]: e.target.checked })} />{label}
    </label>
  )

  return (
    <>
      <button className={`chip ${on ? 'on' : ''}`} onClick={toggle} title="épisodes à venir (Sonarr) et sorties de films (Radarr)">sorties</button>
      {on && <button className="chip" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'fermer les réglages' : 'réglages'}</button>}
      {on && open && (
        <div className="card" style={{ flexBasis: '100%', display: 'grid', gap: 8, padding: 12 }}>
          {TOGGLES.map((t) => box(t.key, t.label))}
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
          <label style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'center' }}>
            <input type="checkbox" checked={cfg.rappel_ntfy} disabled={!ntfy} onChange={(e) => save({ rappel_ntfy: e.target.checked })} />
            rappel sur le téléphone le jour de la sortie (désactivé par défaut)
          </label>
          {!ntfy && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>notifications téléphone non configurées sur cette installation</span>}
          {cfg.rappel_ntfy && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
              à partir de
              <select value={cfg.rappel_heure} onChange={(e) => save({ rappel_heure: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')} h</option>)}
              </select>
              <Btn sm disabled={busy} onClick={test}>{busy ? '...' : 'vérifier maintenant'}</Btn>
            </div>
          )}
        </div>
      )}
    </>
  )
}
