import { apiGet } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { courbe, fmtDebit, fmtMs, toneLatence, type Liens as Etat, type Ping } from '../../lib/reseau'
import { Card, Chip, Loader } from '../ui'

const W = 260
const H = 44

function Trace({ valeurs, couleur, maxi }: { valeurs: Array<number | null>; couleur: string; maxi?: number }) {
  const d = courbe(valeurs, W, H, maxi)
  return <svg className="rs-trace" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">{d && <path d={d} stroke={couleur} fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />}</svg>
}

// Tuile de débit : compacte, et « mesure en cours… » tant qu'aucune valeur n'est arrivée
function Debit({ titre, valeur, serie, couleur, maxi }: { titre: string; valeur: number | null | undefined; serie: Array<number | null>; couleur: string; maxi: number }) {
  const attend = valeur == null || !isFinite(valeur)
  return (
    <div className={`rs-mesure ${attend ? 'rs-vide' : ''}`}>
      <span className="rs-mesure-t">{titre}</span>
      {attend ? <small>mesure en cours…</small> : <><b>{fmtDebit(valeur)}</b><Trace valeurs={serie} couleur={couleur} maxi={maxi} /></>}
    </div>
  )
}

function Latence({ titre, sous, p, serie }: { titre: string; sous: string; p: Partial<Ping>; serie: Array<number | null> }) {
  const mesure = p.perte !== undefined
  return (
    <div className="rs-mesure">
      <span className="rs-mesure-t">{titre}</span>
      <b>{mesure ? (p.perte! >= 100 ? 'injoignable' : fmtMs(p.moy)) : '—'}</b>
      {mesure && <Chip tone={toneLatence(p)}>{p.perte ? `${p.perte} % perdus` : `gigue ${fmtMs(p.gigue)}`}</Chip>}
      <small>{sous}{mesure && p.min != null ? ` · min ${fmtMs(p.min)} · max ${fmtMs(p.max)}` : ''}</small>
      <Trace valeurs={serie} couleur="var(--gold)" />
    </div>
  )
}

export function Liens() {
  const l = usePoll<Etat>(() => apiGet('/reseau/liens'), 5000)
  const d = l.data
  const h = d?.historique ?? []
  const maxiDebit = Math.max(1, ...h.flatMap((p) => [p.rx ?? 0, p.tx ?? 0]))
  return (
    <Card title="débit et latence" lite={d?.interface ? `interface ${d.interface}` : 'mesure…'}>
      {!d && !l.error && <Loader label="mesure en cours" />}
      {l.error && !d && <Chip tone="crit">API injoignable : {l.error}</Chip>}
      {d && (
        <div className="rs-mesures">
          <Debit titre="réception" valeur={d.debit.rx} serie={h.map((p) => p.rx)} couleur="var(--ok)" maxi={maxiDebit} />
          <Debit titre="émission" valeur={d.debit.tx} serie={h.map((p) => p.tx)} couleur="var(--rose)" maxi={maxiDebit} />
          <Latence titre="passerelle" sous="ton routeur" p={d.passerelle} serie={h.map((p) => p.passerelle_ms)} />
          <Latence titre="internet" sous={d.cible_internet} p={d.internet} serie={h.map((p) => p.internet_ms)} />
        </div>
      )}
      <p className="rs-note">Débit mesuré sur les compteurs de l’interface (tout le trafic de ce PC), latence par trois pings courts toutes les 5 s tant que l’écran est ouvert.</p>
    </Card>
  )
}
