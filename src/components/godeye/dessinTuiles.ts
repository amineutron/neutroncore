// God Eye : dessin des tuiles satellite sur la carte à plat, et composition d'un planisphère pour le globe.
// Cache d'images en mémoire ; une tuile pas encore arrivée est remplacée par sa parente agrandie, jamais par un trou.
import { projeter, type Vue } from '../../lib/vueMonde'
import { ATTRIBUTION_TUILES, ancetre, latDeRangee, lonDeColonne, nombreBandes, tuilesVisibles, urlTuile, type Tuile } from '../../lib/godeye/tuiles'

type Entree = { img: HTMLImageElement; etat: 'charge' | 'ok' | 'echec'; t: number }
const cache = new Map<string, Entree>()
const CACHE_MAX = 500
const EN_COURS_MAX = 10
const RETENTE_MS = 20_000
let enCours = 0

const cle = (t: Tuile): string => `${t.z}/${t.x}/${t.y}`

function oterAnciennes(): void {
  while (cache.size > CACHE_MAX) {
    const premiere = cache.keys().next().value
    if (premiere === undefined) break
    cache.delete(premiere)
  }
}

/** Demande une tuile (sans doublon) ; `aChange` est appelé à son arrivée. Renvoie l'image si elle est prête. */
export function demanderTuile(t: Tuile, aChange: () => void): HTMLImageElement | null {
  const k = cle(t)
  const e = cache.get(k)
  if (e?.etat === 'ok') { cache.delete(k); cache.set(k, e); return e.img }   // la réinsérer la garde parmi les récentes
  if (e?.etat === 'charge') return null
  if (e?.etat === 'echec' && Date.now() - e.t < RETENTE_MS) return null
  if (enCours >= EN_COURS_MAX) return null
  const img = new Image()
  img.decoding = 'async'
  const entree: Entree = { img, etat: 'charge', t: Date.now() }
  cache.set(k, entree)
  enCours++
  img.onload = () => { enCours--; entree.etat = 'ok'; oterAnciennes(); aChange() }
  img.onerror = () => { enCours--; entree.etat = 'echec'; entree.t = Date.now(); aChange() }
  img.src = urlTuile(t)
  return null
}

const prete = (t: Tuile): HTMLImageElement | null => {
  const e = cache.get(cle(t))
  return e?.etat === 'ok' ? e.img : null
}

/** Dessine une partie de tuile (fractions sx, sy, sl de l'image) en bandes, chacune à sa hauteur équirectangulaire. */
function tracerTuile(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement, t: Tuile, part: { sx: number; sy: number; sl: number },
  vers: (lon: number, lat: number) => [number, number], hauteurEcran: number,
): void {
  const iw = img.naturalWidth || 256, ih = img.naturalHeight || 256
  const n = nombreBandes(hauteurEcran * part.sl)
  const lon0 = lonDeColonne(t.x + part.sx, t.z), lon1 = lonDeColonne(t.x + part.sx + part.sl, t.z)
  for (let i = 0; i < n; i++) {
    const r0 = t.y + part.sy + (part.sl * i) / n, r1 = t.y + part.sy + (part.sl * (i + 1)) / n
    const [xa, ya] = vers(lon0, latDeRangee(r0, t.z))
    const [xb, yb] = vers(lon1, latDeRangee(r1, t.z))
    // léger recouvrement vertical : pas de fil clair entre deux bandes
    ctx.drawImage(img, part.sx * iw, (part.sy + (part.sl * i) / n) * ih, part.sl * iw, (part.sl / n) * ih, xa, ya - 0.4, xb - xa, yb - ya + 0.8)
  }
}

/** Carte à plat : pose l'imagerie sur toute la toile. Renvoie le nombre de tuiles encore attendues. */
export function dessinerTuilesPlat(ctx: CanvasRenderingContext2D, vue: Vue, w: number, h: number, dpr: number, aChange: () => void): number {
  const { tuiles } = tuilesVisibles(vue, w, h, dpr)
  const vers = (lon: number, lat: number) => projeter(lon, lat, vue, w, h)
  let attendues = 0
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // d'abord les niveaux grossiers (au fond), ensuite le niveau demandé par-dessus : pas de trou pendant le chargement
  const parents = new Map<string, { t: Tuile; img: HTMLImageElement; part: { sx: number; sy: number; sl: number } }>()
  const aTracer: { t: Tuile; img: HTMLImageElement; part: { sx: number; sy: number; sl: number } }[] = []
  const entiere = { sx: 0, sy: 0, sl: 1 }
  for (const t of tuiles) {
    const img = demanderTuile(t, aChange)
    if (img) { aTracer.push({ t, img, part: entiere }); continue }
    attendues++
    for (let n = 1; n <= 5; n++) {
      const a = ancetre(t, n)
      if (!a) break
      const pi = prete(a.tuile)
      if (pi) {
        const kp = `${cle(a.tuile)}`
        if (!parents.has(kp)) parents.set(kp, { t: a.tuile, img: pi, part: entiere })
        break
      }
    }
  }
  const hEcran = (t: Tuile) => Math.abs(vers(0, latDeRangee(t.y, t.z))[1] - vers(0, latDeRangee(t.y + 1, t.z))[1])
  const tri = [...parents.values()].sort((a, b) => a.t.z - b.t.z)
  for (const p of tri) tracerTuile(ctx, p.img, p.t, p.part, vers, hEcran(p.t))
  for (const p of aTracer) tracerTuile(ctx, p.img, p.t, p.part, vers, hEcran(p.t))
  ctx.restore()
  return attendues
}

/**
 * Globe : compose les tuiles du niveau `z` dans une toile équirectangulaire (mêmes dimensions que la texture).
 * Résout quand toutes sont arrivées (ou ont échoué) ; `apres` est appelé à chaque lot pour rafraîchir la texture.
 */
export function composerPlanisphere(ctx: CanvasRenderingContext2D, w: number, h: number, z: number, apres: () => void): Promise<number> {
  const n = 2 ** z
  const vers = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * w, ((90 - lat) / 180) * h]
  const hEcran = (t: Tuile) => Math.abs(vers(0, latDeRangee(t.y, z))[1] - vers(0, latDeRangee(t.y + 1, z))[1])
  const file: Tuile[] = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) file.push({ z, x, y })
  let restant = file.length, ok = 0, dernier = 0
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return new Promise((resolve) => {
    const lancer = (t: Tuile): void => {
      const img = new Image()
      img.crossOrigin = 'anonymous'   // sans cela la toile est "salie" et WebGL refuse la texture
      img.onload = () => { tracerTuile(ctx, img, t, { sx: 0, sy: 0, sl: 1 }, vers, hEcran(t)); ok++; fin() }
      img.onerror = () => fin()
      img.src = urlTuile(t)
    }
    const fin = (): void => {
      restant--
      if (restant === 0) { apres(); resolve(ok); return }
      if (Date.now() - dernier > 400) { dernier = Date.now(); apres() }
      const suite = file.shift()
      if (suite) lancer(suite)
    }
    for (const t of file.splice(0, 8)) lancer(t)
  })
}

/** Mention de la source des images, discrète, en bas à droite. */
export function dessinerAttribution(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save()
  ctx.font = '10px "JetBrains Mono", monospace'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  const tw = ctx.measureText(ATTRIBUTION_TUILES).width
  ctx.fillRect(w - tw - 12, h - 18, tw + 8, 14)
  ctx.fillStyle = 'rgba(230,240,255,0.8)'
  ctx.fillText(ATTRIBUTION_TUILES, w - 8, h - 6)
  ctx.restore()
}
