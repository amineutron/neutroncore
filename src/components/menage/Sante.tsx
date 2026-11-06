import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPut, ApiError } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { fmtBytes, usePoll } from '../../lib/poll'
import { CODES_SANTE, dossierCourt, nomCourt, progressionScan, toneGravite, type Gravite, type Sante as SanteT } from '../../lib/mediaMenage'
import { Bar, Btn, Card, Chip, Loader } from '../ui'
import { NumField } from '../NumField'

const CLE = 'neutroncore_sante_filtres'
type F = { gravite: '' | Gravite; code: string; q: string }

function lire(): F {
  try { const b = JSON.parse(localStorage.getItem(CLE) ?? 'null'); if (b && typeof b === 'object') return { gravite: b.gravite ?? '', code: String(b.code ?? ''), q: String(b.q ?? '') } } catch { /* défauts */ }
  return { gravite: '', code: '', q: '' }
}

export function Sante() {
  const [f, setF] = useState<F>(lire)
  const [page, setPage] = useState(0)
  const [reglages, setReglages] = useState(false)
  const qs = new URLSearchParams({ limite: '50', decalage: String(page * 50), ...(f.gravite && { gravite: f.gravite }), ...(f.code && { code: f.code }), ...(f.q && { q: f.q }) })
  const [enCours, setEnCours] = useState(false)
  // 2 s pendant un scan, 30 s sinon
  const sante = usePoll<SanteT>(() => apiGet(`/media/sante?${qs}`), enCours ? 2000 : 30000)
  const d = sante.data
  const { refresh } = sante
  useEffect(() => { refresh() }, [page, f.gravite, f.code, f.q, refresh])
  const actif = d?.scan.etat === 'en_cours'
  if (actif !== enCours) setEnCours(!!actif)
  const maj = (n: Partial<F>) => { const nf = { ...f, ...n }; setF(nf); setPage(0); try { localStorage.setItem(CLE, JSON.stringify(nf)) } catch { /* non retenu */ } }

  async function appel(chemin: string, corps?: unknown) {
    try { await apiPost(chemin, corps); sante.refresh() } catch (e) { toast(e instanceof ApiError ? e.message : 'échec', 'crit') }
  }
  async function regler(corps: object) {
    try { await apiPut('/media/sante/reglages', corps); sante.refresh() } catch (e) { toast(e instanceof ApiError ? e.message : 'échec', 'crit') }
  }

  if (!d) return sante.error ? <Card><p style={{ color: 'var(--crit)' }}>{sante.error}</p></Card> : <Loader />
  const s = d.synthese
  return (
    <>
      <Card title="scan des fichiers" lite="ffprobe en lecture seule, tâche de fond">
        {actif ? (
          <>
            <Bar pct={progressionScan(d.scan)} />
            <div className="lite" style={{ margin: '6px 0' }}>{d.scan.fait} / {d.scan.total} · {d.scan.saute} inchangés · {d.scan.courant}</div>
            <Btn sm onClick={() => appel('/media/sante/scan/annuler')}>annuler</Btn>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn solid onClick={() => appel('/media/sante/scan')}>{s.fichiers ? 'relancer le scan' : 'lancer le scan'}</Btn>
            <span className="lite">
              {d.scan.etat === 'termine' ? `terminé : ${d.scan.total} fichiers` : d.scan.etat === 'annule' ? 'annulé' : d.scan.etat === 'erreur' ? `erreur : ${d.scan.message ?? ''}` : s.fichiers ? `${s.fichiers} fichiers en mémoire` : 'jamais lancé'}
            </span>
            <Btn sm onClick={() => setReglages(!reglages)}>{reglages ? 'masquer les réglages' : 'réglages'}</Btn>
          </div>
        )}
        {reglages && !actif && (
          <div style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <label>langues audio voulues <input defaultValue={d.reglages.audio.join(' ')} onBlur={(e) => regler({ audio: e.target.value.split(/[ ,]+/).filter(Boolean) })} /></label>
            <label>sous-titres voulus <input defaultValue={d.reglages.sous_titres.join(' ')} onBlur={(e) => regler({ sous_titres: e.target.value.split(/[ ,]+/).filter(Boolean) })} /></label>
            <label>sondes en parallèle <NumField value={d.reglages.paralleles} min={1} max={4} label="sondes en parallèle" onCommit={(v) => regler({ paralleles: v })} /></label>
            <span className="lite">codes de langue : fre eng jpn... Le prochain scan relit tout.</span>
          </div>
        )}
      </Card>

      {s.fichiers > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0', alignItems: 'center' }}>
          <Chip tone="ok">{s.sains} sains</Chip>
          {(['crit', 'warn', 'info'] as Gravite[]).map((g) => (
            <button key={g} className={`btn sm ${f.gravite === g ? 'solid' : ''}`} aria-pressed={f.gravite === g} onClick={() => maj({ gravite: f.gravite === g ? '' : g })}>
              {g === 'crit' ? 'graves' : g === 'warn' ? 'à voir' : 'infos'} ({s.par_gravite[g] ?? 0})
            </button>
          ))}
          <select value={f.code} aria-label="type d'anomalie" onChange={(e) => maj({ code: e.target.value })}>
            <option value="">toutes les anomalies</option>
            {Object.entries(s.par_code).map(([c, n]) => <option key={c} value={c}>{CODES_SANTE[c] ?? c} ({n})</option>)}
          </select>
          <input value={f.q} placeholder="chercher un fichier" aria-label="chercher" onChange={(e) => maj({ q: e.target.value })} />
        </div>
      )}

      {d.lignes.map((l) => (
        <Card key={l.chemin}>
          <strong style={{ wordBreak: 'break-all' }}>{nomCourt(l.chemin)}</strong>
          <div className="lite">{dossierCourt(l.chemin)} · {fmtBytes(l.taille)}</div>
          <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
            {l.anomalies.map((a, i) => <div key={i}><Chip tone={toneGravite(a.gravite)}>{CODES_SANTE[a.code] ?? a.code}</Chip> <span className="lite">{a.detail}</span></div>)}
          </div>
        </Card>
      ))}
      {s.fichiers > 0 && d.lignes.length === 0 && <Card><p className="lite">aucune anomalie avec ces filtres.</p></Card>}
      {d.total > 50 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Btn sm disabled={page === 0} onClick={() => setPage(page - 1)}>précédent</Btn>
          <span className="lite">{page * 50 + 1}-{Math.min(d.total, page * 50 + 50)} sur {d.total}</span>
          <Btn sm disabled={(page + 1) * 50 >= d.total} onClick={() => setPage(page + 1)}>suivant</Btn>
        </div>
      )}
    </>
  )
}
