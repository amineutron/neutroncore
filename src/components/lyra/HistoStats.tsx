import { Bar, Card } from '../ui'
import { pourcent, toneTaux, type Stats, type Taux } from '../../lib/lyraMemoire'

function Ligne({ nom, t }: { nom: string; t: Taux }) {
  return (
    <div className="lm-rate" title={`${t.reussis} réussis sur ${t.total}`}>
      <span className="nm">{nom}</span>
      <Bar pct={t.taux ?? 0} tone={toneTaux(t.taux)} />
      <span className="v">{pourcent(t.taux)} ({t.total})</span>
    </div>
  )
}

const jourCourt = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

/** Taux de reussite : global, par jour, par outil. Seules les demandes dont on connait le verdict comptent. */
export function HistoStats({ stats }: { stats: Stats }) {
  const tone = toneTaux(stats.taux)
  return (
    <>
      <div className="lm-stats">
        <div className="lm-stat"><b style={tone ? { color: `var(--${tone})` } : undefined}>{pourcent(stats.taux)}</b><span>de réussite ({stats.reussis} sur {stats.total})</span></div>
        <div className="lm-stat"><b>{stats.non_compris}</b><span>phrases non comprises</span></div>
        <div className="lm-stat"><b>{stats.erreurs}</b><span>erreurs d'outil enregistrées</span></div>
        <div className="lm-stat"><b>{stats.sans_verdict}</b><span>sans résultat noté</span></div>
      </div>
      {stats.total > 0 && (
        <div className="lm-cols">
          <Card title="par jour" lite="14 derniers jours notés">
            {stats.par_jour.slice(0, 14).map((j) => <Ligne key={j.jour} nom={jourCourt(j.jour)} t={j} />)}
          </Card>
          <Card title="par outil" lite="du plus utilisé">
            {stats.par_outil.slice(0, 12).map((o) => <Ligne key={o.outil} nom={o.outil || 'pas compris'} t={o} />)}
          </Card>
        </div>
      )}
    </>
  )
}
