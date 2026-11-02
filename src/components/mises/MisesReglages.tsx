import { useState } from 'react'
import { apiGet, apiPut } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { SOURCES, type Reglages, type SourceId } from '../../lib/mises'
import { Btn, Card } from '../ui'

type Etendu = Reglages & { decouverts: string[] }

// Réglages du relevé : seuil de « en retard », sources interrogées, projets npm/pip suivis.
export function MisesReglages({ onSaved }: { onSaved: () => void }) {
  const [r, setR] = useState<Etendu | null>(null)
  const ouvrir = async () => { try { setR(await apiGet<Etendu>('/maj/reglages')) } catch (e) { toast((e as Error).message, 'crit') } }
  if (!r) return <Btn sm onClick={() => void ouvrir()}>réglages</Btn>

  const projets = r.projets ?? r.decouverts
  const basculer = <T,>(liste: T[], v: T): T[] => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])
  async function enregistrer() {
    if (!r) return
    try {
      await apiPut('/maj/reglages', { seuil_jours: r.seuil_jours, sources: r.sources, projets: r.projets })
      toast('réglages enregistrés : relance un relevé pour les appliquer'); onSaved(); setR(null)
    } catch (e) { toast((e as Error).message, 'crit') }
  }
  return (
    <Card title="réglages du relevé" style={{ marginBottom: 14 }}>
      <label className="mi-champ">en retard au bout de
        <input type="number" min={1} max={365} value={r.seuil_jours} onChange={(e) => setR({ ...r, seuil_jours: Number(e.target.value) || 1 })} /> jours
      </label>
      <p className="mi-meta">compté depuis la date de l'avis du dépôt. Une alerte de sécurité haute est toujours en retard.</p>
      <div className="mi-filtres">
        {SOURCES.map((s) => (
          <label key={s.id} className="at-check"><input type="checkbox" checked={r.sources.includes(s.id)}
            onChange={() => setR({ ...r, sources: basculer<SourceId>(r.sources, s.id) })} /> {s.label}</label>
        ))}
      </div>
      <p className="mi-meta">projets suivis pour npm et pip (dossiers sous le dossier des projets) :</p>
      <div className="mi-filtres">
        {r.decouverts.map((p) => (
          <label key={p} className="at-check"><input type="checkbox" checked={projets.includes(p)}
            onChange={() => setR({ ...r, projets: basculer(projets, p) })} /> {p}</label>
        ))}
      </div>
      <div className="mi-actions"><Btn sm solid onClick={() => void enregistrer()}>enregistrer</Btn><Btn sm onClick={() => setR(null)}>fermer</Btn></div>
    </Card>
  )
}
