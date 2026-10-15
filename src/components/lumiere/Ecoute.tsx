import { useEffect, useRef, useState } from 'react'
import { apiGet } from '../../lib/api'
import { echelleEcoute, type Ecoute as Releve } from '../../lib/spatialApercu'

const H = 92

/** Ce que huebeat entend, en direct : chaque barre est un instant de musique, la ligne rose le seuil à dépasser.
 * Les barres dorées sont les temps pris. Bouger la sensibilité fait monter ou descendre la ligne. */
export function Ecoute({ actif, onSensibilite }: { actif: boolean; onSensibilite?: (v: number | null) => void }) {
  const toile = useRef<HTMLCanvasElement>(null)
  const [temps, setTemps] = useState<number | null>(null)
  const suivi = useRef(onSensibilite)
  suivi.current = onSensibilite
  useEffect(() => {
    if (!actif) { setTemps(null); return }
    let mort = false, enCours = false
    const releve = async () => {
      if (enCours || document.hidden) return
      enCours = true
      try {
        const e = await apiGet<Releve>('/spatial/ecoute')
        const c = toile.current, ctx = c?.getContext('2d')
        if (mort || !c || !ctx) return
        suivi.current?.(e.actif ? e.sensibilite ?? null : null)
        if (!e.actif) { setTemps(null); return }
        const dpr = Math.min(2, window.devicePixelRatio || 1), L = c.clientWidth
        if (c.width !== Math.round(L * dpr)) { c.width = Math.round(L * dpr); c.height = H * dpr }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const style = getComputedStyle(c), or = style.getPropertyValue('--gold').trim() || '#f6c177', rose = style.getPropertyValue('--rose').trim() || '#eb6f92', gris = style.getPropertyValue('--faint').trim() || '#777'
        const { barres, seuil, temps: n } = echelleEcoute(e)
        const pas = L / Math.max(1, barres.length), bas = H - 4, haut = bas - 6
        ctx.clearRect(0, 0, L, H)
        barres.forEach((b, i) => {
          if (b.pris) { ctx.fillStyle = or; ctx.globalAlpha = 0.22; ctx.fillRect(i * pas - pas, 0, pas * 3, bas) }
          ctx.globalAlpha = b.pris ? 1 : b.passe ? 0.85 : 0.45
          ctx.fillStyle = b.pris ? or : b.passe ? rose : gris
          ctx.fillRect(i * pas, bas - b.h * haut, Math.max(1, pas - 0.6), Math.max(1, b.h * haut))
        })
        ctx.globalAlpha = 1; ctx.strokeStyle = rose; ctx.lineWidth = 1.5; ctx.beginPath()
        seuil.forEach((s, i) => { const y = bas - s * haut; if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * pas + pas / 2, y) })
        ctx.stroke()
        setTemps(n)
      } catch { /* relevé manqué : le suivant arrive dans un instant */ } finally { enCours = false }
    }
    const t = window.setInterval(() => void releve(), 180)
    void releve()
    return () => { mort = true; window.clearInterval(t) }
  }, [actif])
  if (!actif) return <p className="lu-note">Lance les vraies lampes pour voir ici, en direct, quels sons de la musique sont pris comme des temps.</p>
  return (
    <div className="lu-ecoute">
      <canvas ref={toile} style={{ width: '100%', height: H }} role="img" aria-label="Niveau du son, seuil de détection et temps pris, sur les dernières secondes" />
      <p className="lu-ecoute-legende">
        <span><i className="or" />temps pris{temps !== null ? ` (${temps} en 3,6 s)` : ''}</span>
        <span><i className="rose" />passe le seuil, écarté (trop près du précédent)</span>
        <span><i className="gris" />sous le seuil</span>
        <span><i className="ligne" />seuil : descend quand la sensibilité monte</span>
      </p>
      {temps === null && <p className="lu-note">huebeat n’écoute rien pour l’instant.</p>}
    </div>
  )
}
