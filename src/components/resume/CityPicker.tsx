import { useState } from 'react'
import { apiGet } from '../../lib/api'
import { avecVille, sansVille, type Reglages, type Ville } from '../../lib/resume'
import { Btn } from '../ui'

// Choix de la ville pour la météo : recherche (géocodage sans clé côté API), puis un clic.
export function CityPicker({ value, onChange }: { value: Reglages; onChange: (r: Reglages) => void }) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Ville[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function search() {
    if (q.trim().length < 2) return
    setBusy(true); setErr('')
    try { setFound((await apiGet<{ villes: Ville[] }>(`/resume/villes?q=${encodeURIComponent(q.trim())}`)).villes) }
    catch (e) { setErr((e as Error).message); setFound(null) }
    finally { setBusy(false) }
  }
  const m = value.meteo
  return (
    <div className="rs-city">
      <div className="rs-city-now">
        {m.lat === null ? <span className="rs-note">aucune ville : la section météo restera vide</span> : <b>{m.ville}</b>}
        {m.lat !== null && <Btn sm onClick={() => onChange(sansVille(value))}>retirer</Btn>}
      </div>
      <div className="rs-city-search">
        <input value={q} placeholder="chercher une ville" aria-label="Chercher une ville" onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }} />
        <Btn sm onClick={() => void search()} disabled={busy || q.trim().length < 2}>{busy ? '…' : 'chercher'}</Btn>
      </div>
      {err && <div className="rs-note">{err}</div>}
      {found && found.length === 0 && <div className="rs-note">aucune ville trouvée</div>}
      {found?.map((v) => (
        <button key={`${v.lat},${v.lon}`} type="button" className="rs-city-opt" onClick={() => { onChange(avecVille(value, v)); setFound(null); setQ('') }}>
          {v.nom}<small>{v.zone}</small>
        </button>
      ))}
    </div>
  )
}
