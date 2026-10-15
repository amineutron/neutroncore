import { useEffect, useRef, useState } from 'react'
import { gainPulsation, phaseDeVie } from '../../lib/spatialFx'
import { BORNES, LEGENDES, SONS, TEMPS_PAR_S, balayage, communDeDemo, lampeDeDemo, seuilDeDemo, type CleCommun } from '../../lib/spatialApercu'

const L = 260, H = 96

function dessiner(ctx: CanvasRenderingContext2D, cle: CleCommun, t: number, or: string, gris: string): number {
  const [mini, maxi] = BORNES[cle]
  const v = mini + (maxi - mini) * balayage(t)
  const lampe = lampeDeDemo(cle, v, t)
  ctx.clearRect(0, 0, L, H)
  // la lampe témoin
  const halo = ctx.createRadialGradient(44, 44, 2, 44, 44, 40)
  halo.addColorStop(0, or); halo.addColorStop(1, 'transparent')
  ctx.globalAlpha = 0.08 + 0.92 * lampe; ctx.fillStyle = halo; ctx.fillRect(0, 0, 90, 90)
  ctx.globalAlpha = 1; ctx.strokeStyle = gris; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(44, 44, 13, 0, 7); ctx.stroke()
  // à droite : la forme de la lumière sur deux temps (deux mesures pour la durée de vie), ou les sons face au seuil
  const x0 = 100, x1 = L - 8, y0 = 12, y1 = 78, temps = t * TEMPS_PAR_S
  ctx.strokeStyle = gris; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke(); ctx.globalAlpha = 1
  if (cle === 'sensibilite') {
    const seuil = seuilDeDemo(v), pas = (x1 - x0) / SONS.length, courant = Math.floor(temps) % SONS.length
    SONS.forEach((son, i) => {
      ctx.fillStyle = son >= seuil ? or : gris; ctx.globalAlpha = i === courant ? 1 : 0.55
      ctx.fillRect(x0 + i * pas + 3, y1 - son * (y1 - y0), pas - 6, son * (y1 - y0))
    })
    ctx.globalAlpha = 1; ctx.strokeStyle = '#eb6f92'; ctx.setLineDash([4, 3]); ctx.beginPath()
    ctx.moveTo(x0, y1 - seuil * (y1 - y0)); ctx.lineTo(x1, y1 - seuil * (y1 - y0)); ctx.stroke(); ctx.setLineDash([])
  } else {
    const c = communDeDemo(cle, v), W = cle === 'vie' ? 8 : 2     // la durée de vie se lit sur deux mesures
    ctx.strokeStyle = or; ctx.lineWidth = 2; ctx.beginPath()
    for (let i = 0; i <= 120; i++) {
      const p = (i / 120) * W, g = (c.intensite / 100) * gainPulsation(phaseDeVie(p, c.vie).phase, c)
      const x = x0 + (i / 120) * (x1 - x0), y = y1 - g * (y1 - y0)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
    const p = temps % W, x = x0 + (p / W) * (x1 - x0)
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y1 - lampe * (y1 - y0), 3.5, 0, 7); ctx.fill()
  }
  return balayage(t)
}

/** Le mot « voir l'effet » : au survol (ou au toucher), une animation montre le réglage aller du minimum au maximum. */
export function ApercuReglage({ cle }: { cle: CleCommun }) {
  const [ouvert, setOuvert] = useState(false)
  const toile = useRef<HTMLCanvasElement>(null)
  const jauge = useRef<HTMLElement>(null)
  const leg = LEGENDES[cle]
  useEffect(() => {
    if (!ouvert) return
    const c = toile.current, ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = L * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const style = getComputedStyle(c)
    const or = style.getPropertyValue('--gold').trim() || '#f6c177', gris = style.getPropertyValue('--faint').trim() || '#777'
    const debut = performance.now()
    let id = 0
    const tour = () => {
      const u = dessiner(ctx, cle, (performance.now() - debut) / 1000, or, gris)
      if (jauge.current) jauge.current.style.left = `${u * 100}%`
      id = requestAnimationFrame(tour)
    }
    tour()
    return () => cancelAnimationFrame(id)
  }, [ouvert, cle])
  return (
    <span className="lu-apercu" onMouseEnter={() => setOuvert(true)} onMouseLeave={() => setOuvert(false)}>
      <button type="button" className="lu-apercu-mot" aria-expanded={ouvert} aria-label={`Voir l'effet du réglage ${leg.label}`}
        onFocus={() => setOuvert(true)} onBlur={() => setOuvert(false)} onClick={(e) => { e.preventDefault(); setOuvert(true) }}>voir l’effet</button>
      {ouvert && (
        <span className="lu-apercu-bulle" role="tooltip">
          <b>{leg.label}</b>
          <canvas ref={toile} style={{ width: L, height: H }} aria-hidden />
          <span className="lu-apercu-jauge"><i ref={jauge} /></span>
          <span className="lu-apercu-bouts"><em>mini : {leg.mini}</em><em>maxi : {leg.maxi}</em></span>
        </span>
      )}
    </span>
  )
}
