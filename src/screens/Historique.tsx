import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { usePoll } from '../lib/poll'
import { Btn, Loader, PageTitle } from '../components/ui'
import { Journal } from '../components/historique/Journal'
import { Usage } from '../components/historique/Usage'
import { Tarifs } from '../components/historique/Tarifs'
import '../components/historique/historique.css'
import {
  CLE_FILTRES, FILTRES_DEFAUT, bornes, lireFiltres, phraseIndexation,
  type Etat, type Filtres, type RapportUsage, type SessionVue,
} from '../lib/historique'

function chargerFiltres(): Filtres {
  try { return lireFiltres(localStorage.getItem(CLE_FILTRES)) } catch { return FILTRES_DEFAUT }
}

export function Historique() {
  const [f, setF] = useState<Filtres>(chargerFiltres)
  const [q, setQ] = useState(f.q) // saisie immediate, filtre applique apres une courte pause
  const [rapport, setRapport] = useState<RapportUsage | null>(null)
  const [sessions, setSessions] = useState<SessionVue[] | null>(null)
  const [err, setErr] = useState('')
  const [rev, setRev] = useState(0)
  const [en_cours, setEnCours] = useState(true)

  const etat = usePoll<Etat>(() => apiGet('/journal/etat'), en_cours ? 2000 : 20000)
  const i = etat.data?.indexation
  useEffect(() => { if (i) setEnCours(i.en_cours) }, [i])

  const maj = useCallback((p: Partial<Filtres>) => setF((cur) => {
    const next = { ...cur, ...p }
    try { localStorage.setItem(CLE_FILTRES, JSON.stringify(next)) } catch { /* stockage indisponible */ }
    return next
  }), [])

  useEffect(() => { const t = setTimeout(() => q !== f.q && maj({ q }), 300); return () => clearTimeout(t) }, [q, f.q, maj])

  // les donnees se rechargent quand les filtres changent ou que l'index a avance
  const cle = `${etat.data?.sessions ?? 0}:${i?.faits ?? 0}:${i?.en_cours ?? false}:${rev}`
  useEffect(() => {
    let vivant = true
    const qs = (o: Record<string, string>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString()
    if (f.onglet === 'journal') {
      apiGet<{ sessions: SessionVue[] }>(`/journal/sessions?${qs({ projet: f.projet, jour: f.jour, q: f.q, limit: '120' })}`)
        .then((r) => vivant && (setSessions(r.sessions), setErr(''))).catch((e: Error) => vivant && setErr(e.message))
    } else {
      const b = bornes(f.periode, new Date())
      apiGet<RapportUsage>(`/journal/usage?${qs({ projet: f.projet, debut: b.debut, fin: b.fin })}`)
        .then((r) => vivant && (setRapport(r), setErr(''))).catch((e: Error) => vivant && setErr(e.message))
    }
    return () => { vivant = false }
  }, [f.onglet, f.projet, f.jour, f.q, f.periode, cle])

  async function reindexer() {
    try { await apiPost('/journal/reindexer'); setEnCours(true); setRev((n) => n + 1) } catch (e) { setErr((e as Error).message) }
  }

  const modifie = Boolean(f.projet || f.jour || f.q)
  return (
    <>
      <PageTitle help="historique" title="historique" desc="ce que chaque session claude code a fait, et ce que ça coûte" />
      <div className="hi-bar">
        {(['journal', 'cout'] as const).map((o) => (
          <button key={o} className={`btn sm ${f.onglet === o ? 'solid' : ''}`} onClick={() => maj({ onglet: o })}>
            {o === 'journal' ? 'journal' : 'coût et usage'}
          </button>
        ))}
      </div>
      <div className="hi-bar">
        {f.onglet === 'journal' && <input className="q" type="search" value={q} placeholder="chercher une commande, un fichier, un commit…" onChange={(e) => setQ(e.target.value)} />}
        <select value={f.projet} aria-label="projet" onChange={(e) => maj({ projet: e.target.value })}>
          <option value="">tous les projets</option>
          {(etat.data?.projets ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {f.onglet === 'journal' ? (
          <input type="date" value={f.jour} aria-label="jour" min={etat.data?.premier_jour ?? undefined} max={etat.data?.dernier_jour ?? undefined}
            onChange={(e) => maj({ jour: e.target.value })} />
        ) : (
          <select value={f.periode} aria-label="période" onChange={(e) => maj({ periode: e.target.value as Filtres['periode'] })}>
            <option value="7">7 jours</option><option value="30">30 jours</option><option value="90">90 jours</option><option value="tout">tout</option>
          </select>
        )}
        {modifie && <Btn sm onClick={() => { setQ(''); maj({ projet: '', jour: '', q: '' }) }}>effacer les filtres</Btn>}
      </div>
      {i && (
        <div className={`hi-index ${i.en_cours ? 'run' : ''}`}>
          {phraseIndexation(i)}
          {!i.en_cours && <> <Btn sm onClick={reindexer}>réindexer</Btn></>}
        </div>
      )}
      {err && <div className="hi-warn">{err}</div>}
      {!etat.data && !err && <Loader label="connexion" />}
      {f.onglet === 'journal'
        ? <Journal sessions={sessions} f={f} onNatures={(natures) => maj({ natures })} />
        : (<><Usage r={rapport} f={f} onMode={(mode) => maj({ mode })} /><div style={{ marginTop: 14 }}><Tarifs onSaved={() => setRev((n) => n + 1)} /></div></>)}
    </>
  )
}
