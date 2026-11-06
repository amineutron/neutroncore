import { useState } from 'react'
import { chemin, fmtValeur, libelleHeure, plafond, procheDe, seuilDe, type Echelle, type GroupeDef, type Point, type Seuils } from '../../lib/ressources'
import { Card } from '../ui'
import './ressources.css'

const W = 600
const H = 120

/** Un graphique : séries à afficher/masquer, seuils en pointillés, infobulle au survol ou au toucher. */
export function Courbe({ groupe, points, heures, masquees, onBasculer, seuils, montrerSeuils }: {
  groupe: GroupeDef; points: Point[]; heures: number; masquees: string[]; onBasculer: (id: string) => void
  seuils?: Seuils; montrerSeuils: boolean
}) {
  const [x, setX] = useState<number | null>(null)
  const visibles = groupe.series.filter((s) => !masquees.includes(`${groupe.id}:${s.champ}`))
  const t0 = points.length ? points[0].t : 0
  const t1 = points.length ? points[points.length - 1].t : 1
  const e: Echelle = { t0, t1, max: plafond(points, visibles.map((s) => s.champ), groupe.max), w: W, h: H }
  const survol = x == null ? null : procheDe(points, x, e)
  const vide = points.length < 2

  const bouger = (ev: React.PointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect()
    setX(((ev.clientX - r.left) / r.width) * W)
  }
  return (
    <Card title={groupe.titre} lite={groupe.unite === 'o/s' ? `échelle jusqu'à ${fmtValeur(e.max, 'o/s')}` : undefined}>
      <div className="rs-legende">
        {groupe.series.map((s) => {
          const id = `${groupe.id}:${s.champ}`
          const dernier = points.length ? points[points.length - 1][s.champ] : undefined
          return (
            <button key={id} type="button" className="rs-leg" aria-pressed={!masquees.includes(id)} onClick={() => onBasculer(id)}
              style={{ ['--c' as string]: s.couleur }} title={`Afficher ou masquer ${s.label}`}>
              <i />{s.label}{typeof dernier === 'number' ? ` · ${fmtValeur(dernier as number, groupe.unite)}` : ''}
            </button>
          )
        })}
      </div>
      {vide ? <div className="rs-vide">pas encore assez de relevés (un par minute)</div> : (
        <>
          <svg className="rs-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
            aria-label={`Courbe ${groupe.titre} sur ${heures} heures`}
            onPointerMove={bouger} onPointerDown={bouger} onPointerLeave={() => setX(null)}>
            {[0, 0.5, 1].map((f) => <line key={f} className="grille" x1={0} x2={W} y1={H * f} y2={H * f} />)}
            {montrerSeuils && (groupe.seuils ?? []).map((k) => {
              const s = seuilDe(seuils, k)
              if (!s) return null
              return (
                <g key={k}>
                  {([['warn', s.warn], ['crit', s.crit]] as const).map(([niv, v]) => {
                    const y = H - (v / e.max) * H
                    return y >= 0 && y <= H ? <line key={niv} className={`seuil ${niv}`} x1={0} x2={W} y1={y} y2={y} /> : null
                  })}
                </g>
              )
            })}
            {visibles.map((s) => <path key={s.champ} className="ligne" d={chemin(points, s.champ, e)} style={{ stroke: s.couleur }} />)}
            {survol && <line className="curseur" x1={((survol.t - t0) / (t1 - t0 || 1)) * W} x2={((survol.t - t0) / (t1 - t0 || 1)) * W} y1={0} y2={H} />}
          </svg>
          <div className="rs-axe"><span>{libelleHeure(t0, heures)}</span><span>{fmtValeur(e.max, groupe.unite)}</span><span>{libelleHeure(t1, heures)}</span></div>
          <div className="rs-bulle" aria-live="off">
            {survol ? <><b>{libelleHeure(survol.t, heures)}</b>{visibles.map((s) => ` · ${s.label} ${fmtValeur(survol[s.champ] as number | undefined, groupe.unite)}`)}</> : 'survole ou touche la courbe pour lire une valeur'}
          </div>
        </>
      )}
    </Card>
  )
}
