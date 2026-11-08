import { useEffect, useImperativeHandle, useRef } from 'react'
import { boiteDeVue } from '../../lib/godeye/zone'
import type { Objet } from '../../lib/godeye/modele'
import { chargerFond, fondPret } from '../../lib/godeye/fond'
import { borner, deplacer, projeter, VUE_DEPART, ZOOM_MAX, ZOOM_MIN, zoomerAutour, type Vue } from '../../lib/vueMonde'
import { amasTouche, regrouper, regrouperActif, type Amas } from '../../lib/godeye/amas'
import { useReglagesCarte } from '../../lib/godeye/carteStore'
import { positionSoleil } from '../../lib/godeye/globe'
import { dessinerAmas, dessinerNuitPlat } from './dessinCarte'
import { dessinerFond, dessinerObjet, dessinerTrace, niveauDetail, ORDRE_COUCHES, plusProcheObjet, type Pt } from './dessin'
import { dessinerPolylignes } from './dessinTraces'
import { dessinerZonesPlat } from './dessinZones'
import { Etiquettes } from './Etiquettes'
import type { PropsVue } from './vues'

// Carte du monde à plat en canvas 2D (projection équirectangulaire), sans dépendance : terres, graticule puis les objets
// des couches. Glisser = déplacer, molette / pincement = zoomer, double clic = zoom, clic = sélection.
export function CarteGodEye({ objets, choisi, onChoisir, trace, polylignes, onVue, etiquettes, maxEtiquettes, elements, bloques, zones, ref }: PropsVue) {
  const toile = useRef<HTMLCanvasElement>(null)
  const boite = useRef<HTMLDivElement>(null)
  const vueRef = useRef<Vue>(VUE_DEPART)
  const taille = useRef({ w: 0, h: 0, dpr: 1 })
  const carte = useReglagesCarte()
  const props = useRef({ objets, choisi, trace, polylignes, elements, carte })
  props.current = { objets, choisi, trace, polylignes, elements, carte }
  const amasVus = useRef<Amas<Pt>[]>([])
  const points = useRef<Pt[]>([])
  const dessin = useRef<() => void>(() => {})
  const rappel = useRef(onVue)
  rappel.current = onVue
  const minuteur = useRef<number | undefined>(undefined)
  const essaiFond = useRef(0)
  const zonesRef = useRef(zones)
  zonesRef.current = zones

  const annoncer = () => {
    window.clearTimeout(minuteur.current)
    minuteur.current = window.setTimeout(() => {
      const { w, h } = taille.current
      if (w > 1) rappel.current(vueRef.current, boiteDeVue(vueRef.current, w, h))
    }, 250)
  }
  const appliquer = (v: Vue) => { vueRef.current = v; dessin.current(); annoncer() }

  // zoom amorti : la molette, les boutons et le double clic fixent un zoom CIBLE, rejoint en douceur autour du point visé
  // (le point sous le curseur ne bouge pas). Le pincement, lui, suit les doigts directement.
  const anim = useRef({ cible: 1, x: 0, y: 0, raf: 0, t: 0 })
  const arreterAnim = () => { window.cancelAnimationFrame(anim.current.raf); anim.current.raf = 0 }
  const pas = (t: number) => {
    const a = anim.current
    const { w, h } = taille.current
    const dt = Math.min(64, t - a.t || 16)
    a.t = t
    const reste = a.cible / vueRef.current.zoom
    if (!(Math.abs(Math.log(reste)) > 0.003)) {
      if (reste !== 1) appliquer(zoomerAutour(vueRef.current, reste, a.x, a.y, w, h))
      a.raf = 0
      return
    }
    appliquer(zoomerAutour(vueRef.current, Math.pow(reste, 1 - Math.exp(-dt / 80)), a.x, a.y, w, h))
    a.raf = window.requestAnimationFrame(pas)
  }
  const zoomerDoux = (facteur: number, x: number, y: number) => {
    const a = anim.current
    const { w, h } = taille.current
    const base = a.raf ? a.cible : vueRef.current.zoom
    a.cible = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, base * facteur))
    a.x = x; a.y = y
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      arreterAnim()
      appliquer(zoomerAutour(vueRef.current, a.cible / vueRef.current.zoom, x, y, w, h))
    } else if (!a.raf) { a.t = performance.now(); a.raf = window.requestAnimationFrame(pas) }
  }

  useImperativeHandle(ref, () => ({
    lireVue: () => vueRef.current,
    appliquerVue: (v) => { arreterAnim(); const { w, h } = taille.current; appliquer(w > 1 ? borner(v, w, h) : v) },
    projeter: (lon, lat) => {
      const { w, h } = taille.current
      const [x, y] = projeter(lon, lat, vueRef.current, w, h)
      return x < 0 || y < 0 || x > w || y > h ? null : { x, y }
    },
    taille: () => ({ w: taille.current.w, h: taille.current.h }),
  }))

  const rafTuiles = useRef(0)
  const redessinerBientot = () => {
    if (rafTuiles.current) return
    rafTuiles.current = window.requestAnimationFrame(() => { rafTuiles.current = 0; dessin.current() })
  }

  dessin.current = () => {
    const c = toile.current
    const ctx = c?.getContext('2d')
    const { w, h, dpr } = taille.current
    if (!c || !ctx || w < 2 || h < 2) return
    const { objets: liste, choisi: sel, trace: tr, polylignes: lignes, elements: el, carte: cg } = props.current
    const vue = vueRef.current
    const phase = (Date.now() % 2400) / 2400
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    // fond détaillé (côtes à 50 m, frontières) chargé dès qu'on zoome ; un échec n'est retenté qu'au bout de 30 s
    if (!fondPret() && vue.zoom >= 1.6 && Date.now() - essaiFond.current > 30_000) {
      essaiFond.current = Date.now()
      chargerFond().then(() => dessin.current()).catch(() => { /* fond léger conservé */ })
    }
    dessinerFond(ctx, vue, w, h, fondPret(), { frontieres: el.frontieres, quadrillage: el.quadrillage, texture: el.texture, satellite: el.satellite, grille: cg, tuiles: { dpr, aChange: redessinerBientot } })
    if (el.nuit) dessinerNuitPlat(ctx, vue, w, h, positionSoleil(new Date()))
    if (lignes?.length) dessinerPolylignes(ctx, lignes, (lon, lat) => { const [x, y] = projeter(lon, lat, vue, w, h); return { x, y } })
    if (zonesRef.current?.length) dessinerZonesPlat(ctx, zonesRef.current, (lon, lat) => projeter(lon, lat, vue, w, h), w, h)
    if (tr) dessinerTrace(ctx, tr.map((m) => m.map(([lon, lat]) => projeter(lon, lat, vue, w, h))))
    const vus: Pt[] = []
    const parCouche = new Map(ORDRE_COUCHES.map((k) => [k, [] as Pt[]]))
    for (const o of liste) {
      const [x, y] = projeter(o.lon, o.lat, vue, w, h)
      if (x < -30 || y < -30 || x > w + 30 || y > h + 30) continue
      const pt = { o, x, y }
      vus.push(pt)
    }
    // regroupement : à faible zoom les objets ordinaires serrés deviennent des pastilles ; urgences, séismes, événements et l'objet choisi restent seuls
    const { amas, libres } = regrouperActif(el.regroupement, vue.zoom, vus.length)
      ? regrouper(vus, (q) => q.o.couche, (q) => q.o.id === sel || q.o.ton !== 'info' || q.o.couche === 'seismes' || q.o.couche === 'evenements')
      : { amas: [] as Amas<Pt>[], libres: vus }
    amasVus.current = amas
    points.current = libres
    for (const q of libres) parCouche.get(q.o.couche)?.push(q)
    const lod = el.pictos ? niveauDetail(vus.length) : 0   // sans pictogrammes : formes simples, comme en foule
    for (const k of ORDRE_COUCHES) {
      for (const q of parCouche.get(k)!.sort((a, b) => b.o.rayon - a.o.rayon)) if (q.o.id !== sel) dessinerObjet(ctx, q.o, q.x, q.y, false, phase, undefined, lod, el.halos)
    }
    dessinerAmas(ctx, amas)
    const choisiPt = vus.find((v) => v.o.id === sel)
    if (choisiPt) dessinerObjet(ctx, choisiPt.o, choisiPt.x, choisiPt.y, true, phase, undefined, el.pictos ? 2 : 0, el.halos)
  }

  useEffect(() => {
    const b = boite.current
    if (!b) return
    const mesurer = () => {
      const r = b.getBoundingClientRect()
      const dpr = Math.min(3, window.devicePixelRatio || 1)   // 3 : les téléphones récents sont à 2,6-3, plafonner à 2 floutait les traits
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
    return () => { ro.disconnect(); window.clearTimeout(minuteur.current); window.cancelAnimationFrame(anim.current.raf) }
  }, [])

  useEffect(() => { dessin.current() }, [objets, choisi, trace, polylignes, elements, carte])
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
      zoomerDoux(Math.exp(-Math.max(-300, Math.min(300, e.deltaY)) * 0.0015), x, y)
    }
    c.addEventListener('wheel', roue, { passive: false })
    return () => c.removeEventListener('wheel', roue)
  }, [])

  const bas = (e: React.PointerEvent) => {
    arreterAnim()
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
      const a = amasTouche(amasVus.current, x, y)
      if (a) { zoomerDoux(2.4, x, y); return }   // une pastille se déploie en zoomant dessus
      const o: Objet | null = plusProcheObjet(points.current, x, y)
      onChoisir(o ? o.id : null)
    }
  }
  const zoomBouton = (f: number) => {
    const { w, h } = taille.current
    zoomerDoux(f, w / 2, h / 2)
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
        onDoubleClick={(e) => { const { x, y } = local(e); zoomerDoux(2, x, y) }} />
      <div className="ge-zoom">
        <button type="button" aria-label="zoomer" onClick={() => zoomBouton(1.6)}>+</button>
        <button type="button" aria-label="dézoomer" onClick={() => zoomBouton(1 / 1.6)}>-</button>
      </div>
      <Etiquettes candidats={etiquettes} projeter={projeterPourEtiquettes} taille={() => ({ w: taille.current.w, h: taille.current.h })}
        max={maxEtiquettes} choisi={choisi} onChoisir={onChoisir} actif bloques={bloques} />
    </div>
  )
}
