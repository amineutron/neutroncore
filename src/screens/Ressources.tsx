import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import {
  basculer, CLE_FILTRES, fmtDebit, fmtValeur, GROUPES, lireFiltres, PLAGES, seuilDe, ton,
  type Courbes, type Filtres, type Maintenant, type Seuils,
} from '../lib/ressources'
import { Bar, Card, Loader, PageTitle } from '../components/ui'
import { Courbe } from '../components/ressources/Courbe'
import { GpuPanel } from '../components/ressources/GpuPanel'
import { SeuilsPanel } from '../components/ressources/SeuilsPanel'
import '../components/ressources/ressources.css'

const TITRE = <PageTitle help="ressources" title="ressources" desc="Processeur, mémoire, disques, températures, réseau et carte graphique : en direct et sur les dernières 24 heures." />

function Tuile({ label, valeur, pct, tone, detail }: { label: string; valeur: string; pct?: number; tone: 'ok' | 'warn' | 'crit'; detail?: string }) {
  return (
    <div className={`rs-tuile ${tone !== 'ok' ? tone : ''}`}>
      <small>{label}</small><b>{valeur}</b>
      {pct != null && <Bar pct={pct} tone={tone} />}
      {detail && <em>{detail}</em>}
    </div>
  )
}

function useFiltres(): [Filtres, (f: Partial<Filtres>) => void] {
  const [f, setF] = useState<Filtres>(() => { try { return lireFiltres(localStorage.getItem(CLE_FILTRES)) } catch { return lireFiltres(null) } })
  const maj = (patch: Partial<Filtres>) => setF((cur) => {
    const next = { ...cur, ...patch }
    try { localStorage.setItem(CLE_FILTRES, JSON.stringify(next)) } catch { /* stockage indisponible */ }
    return next
  })
  return [f, maj]
}

export function Ressources() {
  const [filtres, majFiltres] = useFiltres()
  const heures = PLAGES.find((p) => p.id === filtres.plage)?.heures ?? 24
  const now = usePoll<Maintenant>(() => apiGet('/ressources/maintenant'), 5000)
  const courbes = usePoll<Courbes>(() => apiGet(`/ressources/courbes?heures=${heures}&points=240`), 60000)
  // le polling garde son fetcher : on relit tout de suite quand la plage change
  useEffect(() => { courbes.refresh() }, [heures]) // eslint-disable-line react-hooks/exhaustive-deps

  const m = now.data
  if (!m) return <>{TITRE}{now.error ? <p className="chip crit">API injoignable : {now.error}</p> : <Loader label="lecture des ressources…" />}</>
  const p = m.point
  const s: Seuils = m.seuils
  const res = courbes.data?.resume ?? {}
  const max24 = (k: string) => (res[k] ? `max ${fmtValeur(res[k]!.max, k.startsWith('t') ? '°C' : '%')} sur la période` : undefined)
  const disques = Object.entries(p.d ?? {})

  return (
    <>
      {TITRE}
      {m.alertes.length > 0 && (
        <div className="rs-alertes" role="status">
          {m.alertes.map((a) => <div key={a.key} className={`rs-alerte ${a.level}`}><b>{a.title}</b><span>{a.detail}</span></div>)}
        </div>
      )}

      <div className="rs-tuiles">
        <Tuile label="processeur" valeur={fmtValeur(p.cpu, '%')} pct={p.cpu ?? 0} tone={ton(p.cpu, seuilDe(s, 'cpu'))} detail={max24('cpu')} />
        <Tuile label="mémoire vive" valeur={fmtValeur(p.ram, '%')} pct={p.ram ?? 0} tone={ton(p.ram, seuilDe(s, 'ram'))} detail={max24('ram')} />
        <Tuile label="swap" valeur={fmtValeur(p.swap, '%')} pct={p.swap ?? 0} tone={ton(p.swap, seuilDe(s, 'swap'))} detail={max24('swap')} />
        <Tuile label="temp. processeur" valeur={fmtValeur(p.tcpu, '°C')} pct={p.tcpu ?? 0} tone={ton(p.tcpu, seuilDe(s, 'tcpu'))} detail={max24('tcpu')} />
        <Tuile label="temp. nvme" valeur={fmtValeur(p.tnvme, '°C')} pct={p.tnvme ?? 0} tone={ton(p.tnvme, seuilDe(s, 'tnvme'))} detail={max24('tnvme')} />
        <Tuile label="réseau reçu" valeur={fmtDebit(p.rx ?? 0)} tone="ok" detail={`émis ${fmtDebit(p.tx ?? 0)}`} />
      </div>

      {disques.length > 0 && (
        <Card title="disques" lite="occupation">
          <div className="grid g3">
            {disques.map(([chemin, pct]) => (
              <div key={chemin}><div className="num" style={{ fontSize: 12, marginBottom: 4 }}>{chemin} <b>{fmtValeur(pct, '%')}</b></div>
                <Bar pct={pct} tone={pct >= 95 ? 'crit' : pct >= 85 ? 'warn' : 'ok'} /></div>
            ))}
          </div>
        </Card>
      )}

      <div className="rs-filtres" style={{ marginTop: 14 }}>
        {PLAGES.map((pl) => <button key={pl.id} type="button" className="rs-pill" aria-pressed={filtres.plage === pl.id} onClick={() => majFiltres({ plage: pl.id })}>{pl.label}</button>)}
        <span className="sep" />
        <button type="button" className="rs-pill" aria-pressed={filtres.seuils} onClick={() => majFiltres({ seuils: !filtres.seuils })}>seuils sur les courbes</button>
      </div>

      <div className="rs-courbes">
        {GROUPES.map((g) => (
          <Courbe key={g.id} groupe={g} points={courbes.data?.points ?? []} heures={heures} masquees={filtres.masquees}
            onBasculer={(id) => majFiltres({ masquees: basculer(filtres.masquees, id) })} seuils={s} montrerSeuils={filtres.seuils} />
        ))}
      </div>

      <h2 className="eyebrow" style={{ margin: '22px 0 10px' }}>carte graphique</h2>
      <GpuPanel seuils={s} />
      <div style={{ marginTop: 14 }}><SeuilsPanel seuils={s} metriques={m.metriques} onChange={now.refresh} /></div>
    </>
  )
}
