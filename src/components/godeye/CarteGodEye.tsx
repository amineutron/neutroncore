import { useEffect, useImperativeHandle, useRef } from 'react'
import { boiteDeVue } from '../../lib/godeye/zone'
import type { Objet } from '../../lib/godeye/modele'
import { borner, deplacer, projeter, VUE_DEPART, zoomerAutour, type Vue } from '../../lib/vueMonde'
import { dessinerFond, dessinerObjet, dessinerTrace, ORDRE_COUCHES, plusProcheObjet, type Pt } from './dessin'
import { Etiquettes } from './Etiquettes'
import type { PropsVue } from './vues'

// Carte du monde à plat en canvas 2D (projection équirectangulaire), sans dépendance : terres, graticule puis les objets
// des couches. Glisser = déplacer, molette / pincement = zoomer, double clic = zoom, clic = sélection.
export function CarteGodEye({ objets, choisi, onChoisir, trace, onVue, etiquettes, maxEtiquettes, bloques, ref }: PropsVue) {
  const toile = useRef<HTMLCanvasElement>(null)
  const boite = useRef<HTMLDivElement>(null)
  const vueRef = useRef<Vue>(VUE_DEPART)
  const taille = useRef({ w: 0, h: 0, dpr: 1 })
  const props = useRef({ objets, choisi, trace })
  props.current = { objets, choisi, trace }
  const points = useRef<Pt[]>([])
  const dessin = useRef<() => void>(() => {})
  const rappel = useRef(onVue)
  rappel.current = onVue
  const minuteur = useRef<number | undefined>(undefined)

  const annoncer = () => {
    window.clearTimeout(minuteur.current)
    minuteur.current = window.setTimeout(() => {
      const { w, h } = taille.current
      if (w > 1) rappel.current(vueRef.current, boiteDeVue(vueRef.current, w, h))
    }, 250)
  }
  const appliquer = (v: Vue) => { vueRef.current = v; dessin.current(); annoncer() }

  useImperativeHandle(ref, () => ({
    lireVue: () => vueRef.current,
    appliquerVue: (v) => { const { w, h } = taille.current; appliquer(w > 1 ? borner(v, w, h) : v) },
    projeter: (lon, lat) => {
      const { w, h } = taille.current
      const [x, y] = projeter(lon, lat, vueRef.current, w, h)
      return x < 0 || y < 0 || x > w || y > h ? null : { x, y }
    },
    taille: () => ({ w: taille.current.w, h: taille.current.h }),
  }))

  dessin.current = () => {
    const c = toile.current
    const ctx = c?.getContext('2d')
    const { w, h, dpr } = taille.current
    if (!c || !ctx || w < 2 || h < 2) return
    const { objets: liste, choisi: sel, trace: tr } = props.current
    const vue = vueRef.current
    const phase = (Date.now() % 2400) / 2400
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    dessinerFond(ctx, vue, w, h)
    if (tr) dessinerTrace(ctx, tr.map((m) => m.map(([lon, lat]) => projeter(lon, lat, vue, w, h))))
    const vus: Pt[] = []
    const parCouche = new Map(ORDRE_COUCHES.map((k) => [k, [] as Pt[]]))
    for (const o of liste) {
      const [x, y] = projeter(o.lon, o.lat, vue, w, h)
      if (x < -30 || y < -30 || x > w + 30 || y > h + 30) continue
      const pt = { o, x, y }
      vus.push(pt)
      parCouche.get(o.couche)?.push(pt)
    }
    points.current = vus
    for (const k of ORDRE_COUCHES) {
      for (const q of parCouche.get(k)!.sort((a, b) => b.o.rayon - a.o.rayon)) if (q.o.id !== sel) dessinerObjet(ctx, q.o, q.x, q.y, false, phase)
    }
    const choisiPt = vus.find((v) => v.o.id === sel)
    if (choisiPt) dessinerObjet(ctx, choisiPt.o, choisiPt.x, choisiPt.y, true, phase)
  }

  useEffect(() => {
    const b = boite.current
    if (!b) return
    const mesurer = () => {
      const r = b.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      taille.current = { w: r.width, h: r.height, dpr }
      const c = toile.current
      if (c) { c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr)) }
      vueRef.current = borner(vueRef.current, r.width, r.height)
      dessin.current()
      annoncer()
    }
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(b)
    return () => { ro.disconnect(); window.clearTimeout(minuteur.current) }
  }, [])

  useEffect(() => { dessin.current() }, [objets, choisi, trace])
  // boucle légère (~12 i/s) pour les halos qui respirent, onglet visible
  useEffect(() => {
    const t = window.setInterval(() => { if (!document.hidden) dessin.current() }, 80)
    return () => window.clearInterval(t)
  }, [])

  const pointeurs = useRef(new Map<number, { x: number; y: number }>())
  const dep = useRef({ bouge: 0, dist: 0 })
  const local = (e: { clientX: number; clientY: number }) => {
    const r = toile.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  useEffect(() => {
    const c = toile.current
    if (!c) return
    const roue = (e: WheelEvent) => {
      e.preventDefault()
      const { x, y } = local(e)
      const { w, h } = taille.current
      appliquer(zoomerAutour(vueRef.current, Math.exp(-e.deltaY * 0.0015), x, y, w, h))
    }
    c.addEventListener('wheel', roue, { passive: false })
    return () => c.removeEventListener('wheel', roue)
  }, [])

  const bas = (e: React.PointerEvent) => {
    toile.current?.setPointerCapture(e.pointerId)
    pointeurs.current.set(e.pointerId, local(e))
    dep.current = { bouge: 0, dist: 0 }
  }
  const mouvement = (e: React.PointerEvent) => {
    const m = pointeurs.current
    const avant = m.get(e.pointerId)
    if (!avant) return
    const maintenant = local(e)
    const { w, h } = taille.current
    m.set(e.pointerId, maintenant)
    if (m.size === 1) {
      dep.current.bouge += Math.abs(maintenant.x - avant.x) + Math.abs(maintenant.y - avant.y)
      appliquer(deplacer(vueRef.current, maintenant.x - avant.x, maintenant.y - avant.y, w, h))
    } else if (m.size === 2) {
      const [a, b] = [...m.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (dep.current.dist > 0 && d > 0) appliquer(zoomerAutour(vueRef.current, d / dep.current.dist, (a.x + b.x) / 2, (a.y + b.y) / 2, w, h))
      dep.current.dist = d
      dep.current.bouge += 99
    }
  }
  const haut = (e: React.PointerEvent) => {
    const unDoigt = pointeurs.current.size === 1
    pointeurs.current.delete(e.pointerId)
    dep.current.dist = 0
    if (unDoigt && dep.current.bouge < 6) {
      const { x, y } = local(e)
      const o: Objet | null = plusProcheObjet(points.current, x, y)
      onChoisir(o ? o.id : null)
    }
  }
  const zoomBouton = (f: number) => {
    const { w, h } = taille.current
    appliquer(zoomerAutour(vueRef.current, f, w / 2, h / 2, w, h))
  }
  const projeterPourEtiquettes = (lon: number, lat: number) => {
    const { w, h } = taille.current
    const [x, y] = projeter(lon, lat, vueRef.current, w, h)
    return { x, y }
  }

  return (
    <div className="vm-carte ge-plat" ref={boite}>
      <canvas ref={toile} className="vm-toile" role="img" aria-label="carte du monde"
        onPointerDown={bas} onPointerMove={mouvement} onPointerUp={haut} onPointerCancel={haut}
        onDoubleClick={(e) => { const { x, y } = local(e); const { w, h } = taille.current; appliquer(zoomerAutour(vueRef.current, 2, x, y, w, h)) }} />
      <div className="ge-zoom">
        <button type="button" aria-label="zoomer" onClick={() => zoomBouton(1.6)}>+</button>
        <button type="button" aria-label="dézoomer" onClick={() => zoomBouton(1 / 1.6)}>-</button>
      </div>
      <Etiquettes candidats={etiquettes} projeter={projeterPourEtiquettes} taille={() => ({ w: taille.current.w, h: taille.current.h })}
        max={maxEtiquettes} choisi={choisi} onChoisir={onChoisir} actif bloques={bloques} />
    </div>
  )
}
