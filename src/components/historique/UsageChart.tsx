import { fmtCout, fmtJour, fmtTokens, graphique, type Ligne, type Mode } from '../../lib/historique'

const COULEURS = ['var(--gold)', 'var(--rose)', 'var(--ok)', 'var(--muted)']
const W = 640
const H = 180
const BAS = 22

/** Histogramme empile par jour (SVG, sans bibliotheque). */
export function UsageChart({ lignes, mode, devise }: { lignes: Ligne[]; mode: Mode; devise: string }) {
  const g = graphique(lignes, mode)
  if (!g.jours.length) return <div className="pdesc">aucune activité sur la période.</div>
  const fmt = (v: number) => (mode === 'cout' ? fmtCout(v, devise) : fmtTokens(v))
  const pas = W / g.jours.length
  const larg = Math.max(2, pas * 0.7)
  const haut = H - BAS
  return (
    <>
      <svg className="hi-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="usage par jour">
        <text x={2} y={9}>{g.max ? fmt(g.max) : ''}</text>
        <line x1={0} x2={W} y1={haut} y2={haut} stroke="var(--line2)" />
        {g.jours.map((j, i) => {
          let y = haut
          const x = i * pas + (pas - larg) / 2
          return (
            <g key={j}>
              <title>{`${fmtJour(j)} : ${g.series.map((s) => `${s.nom} ${fmt(s.valeurs[i])}`).join(', ')}`}</title>
              {g.series.map((s, k) => {
                const h = g.max ? (s.valeurs[i] / g.max) * (haut - 12) : 0
                y -= h
                return h > 0 ? <rect key={s.cle} x={x} y={y} width={larg} height={h} rx={1.5} fill={COULEURS[k % 4]} /> : null
              })}
              {(g.jours.length <= 16 || i % Math.ceil(g.jours.length / 12) === 0) && (
                <text x={x + larg / 2} y={H - 8} textAnchor="middle">{j.slice(8)}/{j.slice(5, 7)}</text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="hi-legend">
        {g.series.map((s, k) => <span key={s.cle}><i style={{ background: COULEURS[k % 4] }} />{s.nom}</span>)}
      </div>
    </>
  )
}
