import { useEffect, useImperativeHandle, useRef } from 'react'
import { GlobeScene, FOV } from '../../lib/globeScene'
import { chargerFond, fondPret, type FondDetaille } from '../../lib/godeye/fond'
import { boiteDeGlobe, destination, DIST_MAX, DIST_MIN, distanceDepuisZoom, zoomDepuisDistance } from '../../lib/godeye/globe'
import type { Boite } from '../../lib/godeye/modele'
import type { Vue } from '../../lib/vueMonde'
import { dessinerLignesGlobe, dessinerObjet, dessinerTrace, niveauDetail, ORDRE_COUCHES, plusProcheObjet, type Pt } from './dessin'
import { dessinerPolylignes } from './dessinTraces'
import { dessinerZonesGlobe } from './dessinZones'
import type { ZoneBrouillon } from '../../lib/godeye/zones'
import { amasTouche, centreGeo, regrouper, regrouperActif, type Amas } from '../../lib/godeye/amas'
import { pasGrille } from '../../lib/godeye/apparence'
import { lireCarte } from '../../lib/godeye/carteStore'
import { dessinerAmas } from './dessinCarte'
import { Etiquettes } from './Etiquettes'
import type { PropsVue } from './vues'

type Props = PropsVue & {
  /** Rotation automatique : la Terre tourne doucement tant qu'on n'y touche pas. */
  rotation: boolean
  /** Éclairage par le soleil réel (jour et nuit) plutôt qu'une lumière fixe. */
  jourNuit: boolean
  onErreur: (message: string) => void
  /** Degrés par seconde de la rotation automatique (5 par défaut ; réglable pour la télé). */
  vitesse?: number
}

const VITESSE_AUTO = 5          // degrés par seconde
const PAUSE_APRES_GESTE_MS = 2500

/** Globe 3D : Terre texturée et éclairée (three.js), couches dessinées par-dessus avec la même palette que la carte à plat. */
export function GlobeGodEye({ objets, choisi, onChoisir, trace, polylignes, onVue, etiquettes, maxEtiquettes, elements, bloques, zones, rotation, jourNuit, onErreur, vitesse = VITESSE_AUTO, ref }: Props) {
  const zonesRef = useRef(zones)
  zonesRef.current = zones
  const boite = useRef<HTMLDivElement>(null)
  const webgl = useRef<HTMLCanvasElement>(null)
  const dessus = useRef<HTMLCanvasElement>(null)
  const scene = useRef<GlobeScene | null>(null)
  const vue = useRef({ lon: 10, lat: 25, dist: DIST_MAX - 0.45 })
  const cibleDist = useRef(DIST_MAX - 0.45)   // distance visée : la distance réelle la rejoint en douceur (zoom amorti)
  const inertie = useRef({ lon: 0, lat: 0 })
  const dernierGeste = useRef(0)
  const points = useRef<Pt[]>([])
  const amasVus = useRef<Amas<Pt>[]>([])
  const props = useRef({ objets, choisi, trace, polylignes, rotation, jourNuit, elements })
  props.current = { objets, choisi, trace, polylignes, rotation, jourNuit, elements }
  const vitesseRef = useRef(vitesse)
  vitesseRef.current = vitesse
  const annonce = useRef({ t: 0, cle: '' })
  const rappels = useRef({ onVue, onErreur })
  rappels.current = { onVue, onErreur }

  const annoncer = (force = false) => {
    const s = scene.current
    if (!s) return
    const v = vue.current
    const cle = `${v.lon.toFixed(1)}|${v.lat.toFixed(1)}|${v.dist.toFixed(2)}|${Math.round(s.largeur)}`
    const maintenant = performance.now()
    if (!force && (cle === annonce.current.cle || maintenant - annonce.current.t < 400)) return
    annonce.current = { t: maintenant, cle }
    const cadre: Vue = { cx: v.lon, cy: v.lat, zoom: zoomDepuisDistance(v.dist) }
    rappels.current.onVue(cadre, boiteDeGlobe(v.lat, v.lon, v.dist, FOV, s.largeur / s.hauteur))
  }

  useImperativeHandle(ref, () => ({
    lireVue: () => ({ cx: vue.current.lon, cy: vue.current.lat, zoom: zoomDepuisDistance(vue.current.dist) }),
    appliquerVue: (v: Vue) => {
      vue.current = { lon: v.cx, lat: Math.max(-80, Math.min(80, v.cy)), dist: distanceDepuisZoom(v.zoom) }
      cibleDist.current = vue.current.dist
      inertie.current = { lon: 0, lat: 0 }
      dernierGeste.current = performance.now()
      annoncer(true)
    },
    projeter: (lon, lat) => scene.current?.projeter(lat, lon) ?? null,
    taille: () => ({ w: scene.current?.largeur ?? 0, h: scene.current?.hauteur ?? 0 }),
  }))

  useEffect(() => {
    const b = boite.current, c = webgl.current, o = dessus.current
    if (!b || !c || !o) return
    let s: GlobeScene
    try { s = new GlobeScene(c) } catch (e) {
      rappels.current.onErreur(e instanceof Error ? e.message : 'WebGL indisponible')
      return
    }
    scene.current = s
    let dpr = 1
    const mesurer = () => {
      const r = b.getBoundingClientRect()
      dpr = Math.min(3, window.devicePixelRatio || 1)   // couches et traits nets : ne pas brider les écrans de téléphone
      s.redimensionner(r.width, r.height)
      o.width = Math.max(1, Math.round(r.width * dpr)); o.height = Math.max(1, Math.round(r.height * dpr))
      annoncer(true)
    }
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(b)

    let raf = 0, avant = performance.now(), soleilMaj = 0, dernierDessin = 0, essaiFond = -1e9, fondApplique = false
    const boucle = (t: number) => {
      raf = requestAnimationFrame(boucle)
      if (document.hidden) { avant = t; return }
      const dt = Math.min(0.1, (t - avant) / 1000)
      avant = t
      const v = vue.current
      const actif = t - dernierGeste.current < PAUSE_APRES_GESTE_MS
      const bouge = Math.abs(inertie.current.lon) > 0.01 || Math.abs(inertie.current.lat) > 0.01
      if (bouge) {
        v.lon += inertie.current.lon * dt * 60
        v.lat = Math.max(-80, Math.min(80, v.lat + inertie.current.lat * dt * 60))
        inertie.current = { lon: inertie.current.lon * 0.93, lat: inertie.current.lat * 0.93 }
      } else if (props.current.rotation && !actif) {
        v.lon -= vitesseRef.current * dt
      }
      v.lon = ((((v.lon + 180) % 360) + 360) % 360) - 180
      const ecartZoom = Math.abs(Math.log(cibleDist.current / v.dist)) > 0.002
      if (ecartZoom) v.dist *= Math.pow(cibleDist.current / v.dist, 1 - Math.exp(-dt / 0.09))
      else v.dist = cibleDist.current
      const zoom = zoomDepuisDistance(v.dist)
      // contours détaillés (côtes à 50 m, frontières) : chargés dès qu'on s'approche, un échec n'est retenté qu'au bout de 30 s
      const el = props.current.elements, cg = lireCarte()
      s.reglerApparence({ quadrillage: el.quadrillage, pas: pasGrille(cg.grille, zoom, true), equateur: cg.equateur, tropiques: cg.tropiques, texture: el.texture, satellite: el.satellite })
      s.reglerNuit(el.nuit)
      const fond = fondPret()
      if (fond && !fondApplique) { s.majFond(fond); fondApplique = true }
      else if (!fond && zoom >= 1.5 && t - essaiFond > 30_000) {
        essaiFond = t
        chargerFond().catch(() => { /* texture légère conservée */ })
      }
      const anime = bouge || ecartZoom || (props.current.rotation && !actif)
      // immobile : on ne redessine que ~15 fois par seconde (les halos respirent encore), sans gaspiller le processeur
      if (!anime && t - dernierDessin < 66) return
      dernierDessin = t
      if (t - soleilMaj > 30_000) { s.majSoleil(new Date()); soleilMaj = t }
      s.cadrer(v.lat, v.lon, v.dist)
      s.rendre()
      const lignes = fond && zoom >= 2.2 ? { fond, boite: boiteDeGlobe(v.lat, v.lon, v.dist, FOV, s.largeur / s.hauteur), zoom } : null
      dessinerCouches(o.getContext('2d'), s, props.current, points, dpr, t, lignes, zonesRef.current, amasVus, zoom)
      annoncer()
    }
    raf = requestAnimationFrame(boucle)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); s.liberer(); scene.current = null }
  }, [])

  useEffect(() => { scene.current?.reglerJourNuit(jourNuit) }, [jourNuit])

  // gestes : glisser fait tourner (avec inertie), molette / pincement zoome, un appui sans mouvement sélectionne
  const pointeurs = useRef(new Map<number, { x: number; y: number }>())
  const geste = useRef({ bouge: 0, dist: 0 })
  const local = (e: { clientX: number; clientY: number }) => {
    const r = webgl.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const degresParPixel = () => 0.07 + 0.3 * ((vue.current.dist - 1) / (DIST_MAX - 1))
  // molette et boutons fixent une distance cible rejointe en douceur ; le pincement (`direct`) suit les doigts sans retard
  const zoomer = (f: number, direct = false) => {
    const d = Math.min(DIST_MAX, Math.max(DIST_MIN, (direct ? vue.current.dist : cibleDist.current) * f))
    cibleDist.current = d
    if (direct) vue.current.dist = d
    dernierGeste.current = performance.now()
  }

  useEffect(() => {
    const c = dessus.current
    if (!c) return
    const roue = (e: WheelEvent) => { e.preventDefault(); zoomer(Math.exp(e.deltaY * 0.0012)) }
    c.addEventListener('wheel', roue, { passive: false })
    return () => c.removeEventListener('wheel', roue)
  }, [])

  const bas = (e: React.PointerEvent) => {
    dessus.current?.setPointerCapture(e.pointerId)
    pointeurs.current.set(e.pointerId, local(e))
    geste.current = { bouge: 0, dist: 0 }
    inertie.current = { lon: 0, lat: 0 }
    dernierGeste.current = performance.now()
  }
  const mouvement = (e: React.PointerEvent) => {
    const m = pointeurs.current
    const avant = m.get(e.pointerId)
    if (!avant) return
    const maintenant = local(e)
    m.set(e.pointerId, maintenant)
    dernierGeste.current = performance.now()
    if (m.size === 1) {
      const dx = maintenant.x - avant.x, dy = maintenant.y - avant.y
      geste.current.bouge += Math.abs(dx) + Math.abs(dy)
      const k = degresParPixel()
      const v = vue.current
      v.lon -= dx * k
      v.lat = Math.max(-80, Math.min(80, v.lat + dy * k))
      inertie.current = { lon: -dx * k * 0.5, lat: dy * k * 0.5 }
    } else if (m.size === 2) {
      const [a, b] = [...m.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (geste.current.dist > 0 && d > 0) zoomer(geste.current.dist / d, true)
      geste.current.dist = d
      geste.current.bouge += 99
    }
  }
  const haut = (e: React.PointerEvent) => {
    const unDoigt = pointeurs.current.size === 1
    pointeurs.current.delete(e.pointerId)
    geste.current.dist = 0
    if (unDoigt && geste.current.bouge < 6) {
      const { x, y } = local(e)
      const a = amasTouche(amasVus.current, x, y)
      if (a) {   // une pastille se déploie : on centre dessus et on s'approche
        const c = centreGeo(a.membres.map((m) => m.o))
        vue.current = { ...vue.current, lon: c.lon, lat: Math.max(-80, Math.min(80, c.lat)) }
        inertie.current = { lon: 0, lat: 0 }
        zoomer(1 / 1.7)
        return
      }
      const o = plusProcheObjet(points.current, x, y)
      onChoisir(o ? o.id : null)
    }
  }

  const projeter = (lon: number, lat: number) => scene.current?.projeter(lat, lon) ?? null
  const taille = () => ({ w: scene.current?.largeur ?? 0, h: scene.current?.hauteur ?? 0 })
  return (
    <div className="ge-globe" ref={boite}>
      <canvas ref={webgl} className="ge-globe-gl" aria-hidden="true" />
      <canvas ref={dessus} className="ge-globe-sur" role="img" aria-label="globe terrestre en 3D : glisser pour tourner, molette pour zoomer"
        onPointerDown={bas} onPointerMove={mouvement} onPointerUp={haut} onPointerCancel={haut} />
      <div className="ge-zoom">
        <button type="button" aria-label="zoomer" onClick={() => zoomer(1 / 1.35)}>+</button>
        <button type="button" aria-label="dézoomer" onClick={() => zoomer(1.35)}>-</button>
      </div>
      <Etiquettes candidats={etiquettes} projeter={projeter} taille={taille} max={maxEtiquettes} choisi={choisi} onChoisir={onChoisir} actif bloques={bloques} />
    </div>
  )
}

/** Trace projetée sur l'écran, coupée là où elle passe derrière l'horizon. */
function traceEcran(trace: readonly (readonly [number, number])[][], s: GlobeScene): [number, number][][] {
  const sortie: [number, number][][] = []
  for (const morceau of trace) {
    let courant: [number, number][] = []
    for (const [lon, lat] of morceau) {
      const q = s.projeter(lat, lon)
      if (q) courant.push([q.x, q.y])
      else if (courant.length) { sortie.push(courant); courant = [] }
    }
    if (courant.length) sortie.push(courant)
  }
  return sortie
}

/** Dessine les couches par-dessus la Terre : projection de chaque objet, cap corrigé pour la perspective, trace du satellite choisi. */
function dessinerCouches(
  ctx: CanvasRenderingContext2D | null, s: GlobeScene, p: { objets: PropsVue['objets']; choisi: string | null; trace: PropsVue['trace']; polylignes?: PropsVue['polylignes']; elements: PropsVue['elements'] },
  points: { current: Pt[] }, dpr: number, t: number, lignes: { fond: FondDetaille; boite: Boite; zoom: number } | null,
  zones?: readonly ZoneBrouillon[], amasOut?: { current: Amas<Pt>[] }, zoom = 1,
): void {
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, s.largeur, s.hauteur)
  if (lignes) dessinerLignesGlobe(ctx, lignes.fond, (lon, lat) => s.projeter(lat, lon), lignes.boite, lignes.zoom, p.elements.frontieres)
  const phase = (t % 2400) / 2400
  const vus: Pt[] = []
  for (const o of p.objets) {
    const pos = s.projeter(o.lat, o.lon)
    if (!pos) continue
    let cap: number | undefined
    if (o.cap !== undefined) {   // le nord n'est pas « en haut » partout sur un globe : on mesure le cap sur l'écran
      const [la, lo] = destination(o.lat, o.lon, o.cap, 1.5)
      const ahead = s.projeter(la, lo)
      if (ahead) cap = (Math.atan2(ahead.x - pos.x, -(ahead.y - pos.y)) * 180) / Math.PI
    }
    vus.push({ o, x: pos.x, y: pos.y, cap })
  }
  // regroupement : objets ordinaires serrés -> pastilles ; urgences, séismes, événements et l'objet choisi restent seuls
  const { amas, libres } = regrouperActif(p.elements.regroupement, zoom, vus.length)
    ? regrouper(vus, (q) => q.o.couche, (q) => q.o.id === p.choisi || q.o.ton !== 'info' || q.o.couche === 'seismes' || q.o.couche === 'evenements')
    : { amas: [] as Amas<Pt>[], libres: vus }
  if (amasOut) amasOut.current = amas
  points.current = libres
  if (p.polylignes?.length) dessinerPolylignes(ctx, p.polylignes, (lon, lat) => s.projeter(lat, lon))
  if (zones?.length) dessinerZonesGlobe(ctx, zones, (lon, lat) => s.projeter(lat, lon))
  if (p.trace) dessinerTrace(ctx, traceEcran(p.trace, s))
  const lod = p.elements.pictos ? niveauDetail(vus.length) : 0
  for (const k of ORDRE_COUCHES) {
    for (const q of libres.filter((v) => v.o.couche === k && v.o.id !== p.choisi).sort((a, b) => b.o.rayon - a.o.rayon)) dessinerObjet(ctx, q.o, q.x, q.y, false, phase, q.cap, lod, p.elements.halos)
  }
  dessinerAmas(ctx, amas)
  const sel = vus.find((v) => v.o.id === p.choisi)
  if (sel) dessinerObjet(ctx, sel.o, sel.x, sel.y, true, phase, sel.cap, p.elements.pictos ? 2 : 0, p.elements.halos)
}
