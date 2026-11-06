import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { ImageAudio } from '../../lib/djSignaux'
import { dessinerOnde, dessinerOscillo, dessinerSpectre, dessinerSpectro, dessinerVecto, dessinerVolume, lecturePic } from '../../lib/djDessin'

type Module = { id: string; label: string; large?: boolean }
const MODULES: Module[] = [
  { id: 'spectro', label: 'spectrogramme', large: true },
  { id: 'onde', label: 'forme d’onde colorée', large: true },
  { id: 'oscillo', label: 'oscilloscope' },
  { id: 'vecto', label: 'vectoroscope' },
  { id: 'spectre', label: 'spectre', large: true },
  { id: 'volume', label: 'volume perçu' },
]
const CLE = 'neutroncore_dj_modules'
const lireModules = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(CLE) ?? '{}') as Record<string, boolean> } catch { return {} } }
const DPR = () => Math.min(window.devicePixelRatio || 1, 2)

/** La bande d'analyseurs : chaque module se montre ou se masque ; rien ne se dessine pour un module masqué. */
export function Analyseurs({ image }: { image: MutableRefObject<ImageAudio | null> }) {
  const [visibles, setVisibles] = useState<Record<string, boolean>>(lireModules)
  const [lectures, setLectures] = useState<Record<string, string>>({})
  const toiles = useRef<Record<string, HTMLCanvasElement | null>>({})
  const historique = useRef<number[]>([])
  const vu = useRef(-1)
  const visiblesRef = useRef(visibles)
  visiblesRef.current = visibles

  const basculer = (id: string) => {
    const next = { ...visibles, [id]: visibles[id] === false }
    setVisibles(next)
    try { localStorage.setItem(CLE, JSON.stringify(next)) } catch { /* stockage indisponible */ }
  }

  useEffect(() => {
    const dpr = DPR()
    const ajuster = () => {
      for (const c of Object.values(toiles.current)) {
        if (!c) continue
        const r = c.getBoundingClientRect()
        if (r.width < 4) continue
        const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr)
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0) }
      }
    }
    const obs = new ResizeObserver(ajuster)
    for (const c of Object.values(toiles.current)) if (c) obs.observe(c)
    ajuster()
    let raf = 0, dernier = 0, tour = 0
    const boucle = (t: number) => {
      raf = requestAnimationFrame(boucle)
      if (document.hidden || t - dernier < 30) return
      dernier = t
      const img = image.current
      if (!img) return
      const neuve = img.t !== vu.current
      vu.current = img.t
      if (neuve) { historique.current = [...historique.current.slice(-219), img.lufs.m] }
      const dessine = (id: string, f: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
        const c = toiles.current[id]
        if (!c || visiblesRef.current[id] === false || c.width < 4) return
        const ctx = c.getContext('2d')
        if (ctx) f(ctx, c.width / dpr, c.height / dpr)
      }
      const defile = (id: string, f: (c: HTMLCanvasElement) => void) => {
        const c = toiles.current[id]
        if (neuve && c && visiblesRef.current[id] !== false && c.width >= 4) f(c)
      }
      defile('spectro', (c) => dessinerSpectro(c, img, dpr))
      defile('onde', (c) => dessinerOnde(c, img, dpr))
      dessine('oscillo', (ctx, w, h) => dessinerOscillo(ctx, w, h, img))
      dessine('vecto', (ctx, w, h) => dessinerVecto(ctx, w, h, img))
      dessine('spectre', (ctx, w, h) => dessinerSpectre(ctx, w, h, img))
      dessine('volume', (ctx, w, h) => dessinerVolume(ctx, w, h, historique.current, img.lufs.m))
      if (++tour % 6 === 0) {
        const moy = historique.current.reduce((s, v) => s + v, 0) / Math.max(1, historique.current.length)
        setLectures({
          spectro: '30 Hz - 16 kHz',
          onde: 'graves rose, médiums or, aigus bleus',
          oscillo: 'forme brute',
          vecto: `corr ${img.corr >= 0 ? '+' : ''}${img.corr.toFixed(2)}`,
          spectre: img.spec.length === 96 ? lecturePic(img.spec) : '',
          volume: `M ${img.lufs.m.toFixed(1)}  S ${img.lufs.s.toFixed(1)}  moy ${moy.toFixed(1)}`,
        })
      }
    }
    raf = requestAnimationFrame(boucle)
    return () => { cancelAnimationFrame(raf); obs.disconnect() }
  }, [image])

  return (
    <section aria-label="analyseurs">
      <div className="dj-entete">
        <h3>analyseurs</h3>
        <div className="dj-puces" role="group" aria-label="modules affichés">
          {MODULES.map((m) => <button key={m.id} type="button" className="dj-puce" aria-pressed={visibles[m.id] !== false} onClick={() => basculer(m.id)}>{m.label}</button>)}
        </div>
      </div>
      <div className="dj-bande">
        {MODULES.map((m) => (
          <div key={m.id} className={`dj-module ${m.large ? 'large' : ''}`} hidden={visibles[m.id] === false}>
            <div className="dj-mh"><span>{m.label}</span><span>{lectures[m.id] ?? ''}</span></div>
            <canvas ref={(c) => { toiles.current[m.id] = c }} />
          </div>
        ))}
      </div>
    </section>
  )
}
