import { useEffect, useState } from 'react'
import { apiGet, DEMO, getApiKey } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { usePoll } from '../../lib/poll'
import {
  dateLisible, ecrireFiltres, FILTRES_DEFAUT, filtresActifs, filtresVersQuery, KINDS, lireFiltres, motResultat, PERIODES,
  type Filtres, type Kind, type ReponseAudit,
} from '../../lib/reglages'
import { Btn, Card, Chip, Loader } from '../ui'

async function telechargerCsv(f: Filtres): Promise<void> {
  if (DEMO) { toast('export CSV indisponible en démonstration', 'warn'); return }
  const r = await fetch(`/audit/journal.csv?${filtresVersQuery(f, new Date(), 5000)}`, { headers: { Authorization: `Bearer ${getApiKey()}` } })
  if (!r.ok) throw new Error(`export impossible (${r.status})`)
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement('a')
  a.href = url; a.download = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? 'journal-audit.csv'; a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Barre({ f, set }: { f: Filtres; set: (p: Partial<Filtres>) => void }) {
  const bascule = (k: Kind) => set({ kinds: f.kinds.includes(k) ? f.kinds.filter((x) => x !== k) : [...f.kinds, k] })
  return (
    <div className="rg-filtres" role="group" aria-label="filtres du journal">
      <div className="rg-pills">
        {PERIODES.map((p) => <button key={p.id} className={`btn sm ${f.periode === p.id ? 'solid' : ''}`} aria-pressed={f.periode === p.id} onClick={() => set({ periode: p.id })}>{p.label}</button>)}
      </div>
      <div className="rg-pills">
        {KINDS.map((k) => <button key={k.id} title={k.aide} className={`btn sm ${f.kinds.includes(k.id) ? 'solid' : ''}`} aria-pressed={f.kinds.includes(k.id)} onClick={() => bascule(k.id)}>{k.label}</button>)}
        <button className={`btn sm ${f.sensible ? 'solid' : ''}`} aria-pressed={f.sensible} title="suppressions, arrêts, restaurations, accès refusés..." onClick={() => set({ sensible: !f.sensible })}>sensibles</button>
      </div>
      <div className="rg-pills">
        {(['tous', 'ok', 'echec'] as const).map((r) => <button key={r} className={`btn sm ${f.resultat === r ? 'solid' : ''}`} aria-pressed={f.resultat === r} onClick={() => set({ resultat: r })}>{{ tous: 'tous résultats', ok: 'réussis', echec: 'échecs' }[r]}</button>)}
      </div>
      <input className="rg-in" placeholder="chercher une action" aria-label="chercher dans les actions" value={f.texte} onChange={(e) => set({ texte: e.target.value })} />
      <input className="rg-in sm" placeholder="adresse" aria-label="filtrer par adresse" value={f.ip} onChange={(e) => set({ ip: e.target.value })} />
      {filtresActifs(f) > 0 && <Btn sm onClick={() => set({ ...FILTRES_DEFAUT, periode: 'tout' })}>tout effacer</Btn>}
    </div>
  )
}

export default function Audit() {
  const [f, setF] = useState<Filtres>(() => lireFiltres(localStorage))
  const set = (p: Partial<Filtres>) => setF((x) => { const n = { ...x, ...p }; ecrireFiltres(localStorage, n); return n })
  const q = filtresVersQuery(f, new Date(Math.floor(Date.now() / 60_000) * 60_000), 300)
  const j = usePoll<ReponseAudit>(() => apiGet(`/audit/journal?${q}`), 15_000)
  useEffect(() => { j.refresh() }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = j.data
  return (
    <div className="grid">
      <Card title="journal d’audit" lite="lecture seule, valeurs sensibles masquées">
        <Barre f={f} set={set} />
        {d && (
          <p className="rg-note">
            {d.resume.total} entrée(s){d.tronque ? ' (les plus récentes)' : ''} · {d.resume.echecs} échec(s) · {d.resume.sensibles} sensible(s)
            {d.partiel ? ' · journal très long : seule la fin a été lue, réduis la période' : ''}
          </p>
        )}
        <Btn sm onClick={() => void telechargerCsv(f).catch((e: Error) => toast(e.message, 'crit'))}>exporter en CSV</Btn>
      </Card>
      {!d ? <Loader /> : d.entrees.length === 0 ? <Card><p className="rg-note">aucune entrée pour ces filtres.</p></Card> : (
        <Card>
          <div className="scroll-x">
            <table className="rg-tab">
              <thead><tr><th>quand</th><th>action</th><th>depuis</th><th>résultat</th></tr></thead>
              <tbody>
                {d.entrees.map((e, i) => (
                  <tr key={`${e.ts}-${i}`} className={e.ok ? '' : 'ko'}>
                    <td>{dateLisible(e.ts)}</td>
                    <td><b>{e.action}</b>{e.detail && <small> {e.detail}</small>} {e.sensible && <Chip tone="warn">sensible</Chip>}</td>
                    <td title={e.ip}>{e.reseau}<small> {e.ip}</small></td>
                    <td><Chip tone={e.ok ? 'ok' : 'crit'}>{motResultat(e)}</Chip> <small>{e.status}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
