import { useRef, useState } from 'react'
import {
  ajouterPoint, changerForme, cheminCourbe, deplacerPoint, dureeLisible, FORMES, supprimerPoint, type Point,
} from '../../lib/rampes'
import { NumField } from '../NumField'
import './reveil.css'

const W = 600, H = 170

// Éditeur de courbe : tirer un point pour le déplacer, toucher le fond pour en ajouter, double-clic (ou « retirer ») pour l'enlever.
// Au clavier : flèches sur un point (gauche/droite = temps, haut/bas = valeur). Le temps est borné entre les voisins.
export function CourbeEditeur({ titre, points, duree, lo, hi, max, couleur, formatV, pas, curseur, onChange }: {
  titre: string; points: Point[]; duree: number; lo: number; hi: number; max: number; couleur: string
  formatV: (v: number) => string; pas: number; curseur?: number | null; onChange: (p: Point[]) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [choisi, setChoisi] = useState<number | null>(null)
  const glisse = useRef<number | null>(null)

  const vers = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect()          // ratios : insensibles au zoom du mode télé
    return { t: ((e.clientX - r.left) / r.width) * duree, v: hi - ((e.clientY - r.top) / r.height) * (hi - lo) }
  }
  const X = (t: number) => (t / duree) * W
  const Y = (v: number) => H - ((v - lo) / (hi - lo)) * H
  const sel = choisi !== null ? points[choisi] : undefined

  return (
    <div className="ce">
      <div className="ce-head"><b>{titre}</b><span>{points.length} point{points.length > 1 ? 's' : ''} sur {max} · toucher le fond pour ajouter</span></div>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="ce-svg" role="group" aria-label={titre}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget && (e.target as Element).getAttribute('data-fond') === null) return
          const { t, v } = vers(e)
          const apres = ajouterPoint(points, t, v, duree, max)
          if (apres !== points) { onChange(apres); setChoisi(apres.findIndex((p) => p.t === Math.round(t * 100) / 100)) }
        }}
        onPointerMove={(e) => { if (glisse.current !== null) { const { t, v } = vers(e); onChange(deplacerPoint(points, glisse.current, t, v, duree, lo, hi)) } }}
        onPointerUp={() => { glisse.current = null }} onPointerCancel={() => { glisse.current = null }}>
        <rect data-fond="" x="0" y="0" width={W} height={H} className="ce-fond" />
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="ce-grille" />)}
        <path d={`${cheminCourbe(points, duree, lo, hi, W, H)} L${W} ${H} L0 ${H} Z`} fill={couleur} opacity="0.12" pointerEvents="none" />
        <path d={cheminCourbe(points, duree, lo, hi, W, H)} fill="none" stroke={couleur} strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        {curseur != null && <line x1={X(curseur)} x2={X(curseur)} y1="0" y2={H} className="ce-curseur" />}
        {points.map((p, i) => (
          <circle key={i} cx={X(p.t)} cy={Y(p.v)} r={choisi === i ? 7 : 5.5} fill={choisi === i ? couleur : 'var(--ink)'} stroke={couleur} strokeWidth="2"
            vectorEffect="non-scaling-stroke" className="ce-pt" tabIndex={0} role="slider" aria-label={`${titre}, point ${i + 1}`}
            aria-valuetext={`${dureeLisible(p.t)} : ${formatV(p.v)}`}
            onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId); glisse.current = i; setChoisi(i) }}
            onDoubleClick={() => { onChange(supprimerPoint(points, i)); setChoisi(null) }}
            onFocus={() => setChoisi(i)}
            onKeyDown={(e) => {
              const dt = e.shiftKey ? duree / 20 : duree / 100, dv = (hi - lo) / (e.shiftKey ? 20 : 100)
              const d = { ArrowLeft: [-dt, 0], ArrowRight: [dt, 0], ArrowUp: [0, dv], ArrowDown: [0, -dv] }[e.key]
              if (d) { e.preventDefault(); onChange(deplacerPoint(points, i, p.t + d[0], p.v + d[1], duree, lo, hi)) }
              if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onChange(supprimerPoint(points, i)); setChoisi(null) }
            }} />
        ))}
      </svg>
      <div className="ce-axe"><span>0</span><span>{dureeLisible(duree / 2)}</span><span>{dureeLisible(duree)}</span></div>
      {sel && choisi !== null ? (
        <div className="ce-point">
          <label>à <NumField value={Math.round(sel.t)} min={0} max={Math.round(duree)} label="instant en secondes" onCommit={(t) => onChange(deplacerPoint(points, choisi, t, sel.v, duree, lo, hi))} /> s</label>
          <label>valeur <NumField value={Math.round(sel.v)} min={lo} max={hi} step={pas} label="valeur" onCommit={(v) => onChange(deplacerPoint(points, choisi, sel.t, v, duree, lo, hi))} /></label>
          <label>jusqu'au suivant
            <select value={sel.forme} onChange={(e) => onChange(changerForme(points, choisi, e.target.value as Point['forme']))}>
              {FORMES.map((f) => <option key={f} value={f}>{f === 'lineaire' ? 'droit' : f === 'doux' ? 'adouci' : 'en marche'}</option>)}
            </select>
          </label>
          <button type="button" className="btn sm" onClick={() => { onChange(supprimerPoint(points, choisi)); setChoisi(null) }}>retirer</button>
        </div>
      ) : <div className="ce-point ce-vide">choisis un point pour régler son instant, sa valeur et son trajet</div>}
    </div>
  )
}
