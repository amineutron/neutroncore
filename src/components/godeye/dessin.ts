// God Eye : dessin des couches sur une toile 2D, pour la carte à plat comme pour le globe (superposition).
// Aucune décision ici : tout vient des Objet déjà filtrés et déjà projetés en pixels.
import { projeter, type Vue } from '../../lib/vueMonde'
import { palette, REGLAGES_CARTE_DEFAUT, type ReglagesCarte } from '../../lib/godeye/apparence'
import { dessinerQuadrillagePlat, dessinerRelief } from './dessinCarte'
import { dessinerAttribution, dessinerTuilesPlat } from './dessinTuiles'
import { avecAlpha, couleurObjet } from '../../lib/godeye/couleurs'
import { terresLegeres, type FondDetaille, type Ligne } from '../../lib/godeye/fond'
import { THEMES, type Boite, type CoucheId, type Objet } from '../../lib/godeye/modele'
import { niveauDetail, pictoDe, PICTOS, tailleDemi, type PictoId } from '../../lib/godeye/pictos'

export { niveauDetail }

/** Ordre de dessin : le fond d'abord, ce qui bouge et se lit au premier plan en dernier. */
export const ORDRE_COUCHES: CoucheId[] = ['seismes', 'evenements', 'cyber', 'infos', 'navires', 'satellites', 'avions']

export type Pt = { o: Objet; x: number; y: number; cap?: number }

const fondLeger = terresLegeres

/**
 * Côtes et frontières nettes par-dessus le globe : la texture de la Terre est une image, floue de près ; ces traits sont
 * recalculés à chaque image à la résolution de l'écran. Seuls les sommets dans la zone vue sont projetés (`boite`, marge
 * comprise) : un trait est interrompu quand il sort de la zone ou passe derrière l'horizon (`projeter` rend null).
 */
export function dessinerLignesGlobe(
  ctx: CanvasRenderingContext2D, fond: FondDetaille, projeterPt: (lon: number, lat: number) => { x: number; y: number } | null,
  boite: Boite, zoom: number, frontieres = true,
): void {
  const m = 3
  const [sud, nord, ouest, est] = [boite.sud - m, boite.nord + m, boite.ouest - m, boite.est + m]
  const trace = (lignes: readonly Ligne[]): void => {
    for (const l of lignes) {
      if (l.est < ouest || l.ouest > est || l.nord < sud || l.sud > nord) continue
      const p = l.pts
      let ouvert = false
      let px = 0, py = 0
      for (let i = 0; i < p.length; i += 2) {
        const lon = p[i], lat = p[i + 1]
        const q = lon >= ouest && lon <= est && lat >= sud && lat <= nord ? projeterPt(lon, lat) : null
        if (!q) { ouvert = false; continue }
        if (!ouvert) { ctx.moveTo(q.x, q.y); ouvert = true; px = q.x; py = q.y; continue }
        if (Math.abs(q.x - px) + Math.abs(q.y - py) < 0.8) continue
        ctx.quadraticCurveTo(px, py, (px + q.x) / 2, (py + q.y) / 2)
        px = q.x; py = q.y
      }
    }
  }
  ctx.lineJoin = 'round'
  if (frontieres) {
    ctx.beginPath()
    trace(fond.frontieres)
    ctx.strokeStyle = `rgba(190,225,240,${Math.min(0.5, 0.18 + zoom * 0.03)})`
    ctx.lineWidth = 0.9
    ctx.stroke()
  }
  ctx.beginPath()
  trace(fond.terres)
  ctx.strokeStyle = 'rgba(150,215,235,0.85)'
  ctx.lineWidth = 1.3
  ctx.stroke()
}

/**
 * Ajoute des lignes au tracé courant : hors écran = ignorée, sommets à moins d'un pixel du précédent = écartés (rien à voir
 * de plus), et les angles sont arrondis par des courbes passant par les milieux de segments : à fort zoom une côte n'a plus
 * l'air d'une suite de segments droits.
 */
function tracerLignes(ctx: CanvasRenderingContext2D, lignes: readonly Ligne[], vue: Vue, w: number, h: number, fermees: boolean): void {
  for (const l of lignes) {
    const [x0, y1] = projeter(l.ouest, l.sud, vue, w, h)
    const [x1, y0] = projeter(l.est, l.nord, vue, w, h)
    if (Math.max(x0, x1) < -24 || Math.min(x0, x1) > w + 24 || Math.max(y0, y1) < -24 || Math.min(y0, y1) > h + 24) continue
    const p = l.pts
    let px = 0, py = 0, n = 0
    for (let i = 0; i < p.length; i += 2) {
      const [x, y] = projeter(p[i], p[i + 1], vue, w, h)
      if (n > 0 && Math.abs(x - px) + Math.abs(y - py) < 0.8 && i < p.length - 2) continue
      if (n === 0) ctx.moveTo(x, y)
      else if (n === 1) ctx.lineTo((px + x) / 2, (py + y) / 2)
      else ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2)
      px = x; py = y; n++
    }
    if (n > 1) ctx.lineTo(px, py)
    if (fermees && n > 2) ctx.closePath()
  }
}

/** Carte à plat : espace profond, océan, terres éclairées à la côte, frontières, graticule discret. */
export function dessinerFond(
  ctx: CanvasRenderingContext2D, vue: Vue, w: number, h: number, fond: FondDetaille | null = null,
  opt: { frontieres: boolean; quadrillage: boolean; texture?: boolean; satellite?: boolean; grille?: ReglagesCarte; tuiles?: { dpr: number; aChange: () => void } } = { frontieres: true, quadrillage: true },
): void {
  const pal = palette(opt.texture !== false, opt.satellite === true)
  const mer = ctx.createLinearGradient(0, 0, 0, h)
  mer.addColorStop(0, pal.mer[0]); mer.addColorStop(0.55, pal.mer[1]); mer.addColorStop(1, pal.mer[2])
  ctx.fillStyle = mer
  ctx.fillRect(0, 0, w, h)
  if (opt.quadrillage) dessinerQuadrillagePlat(ctx, vue, w, h, opt.grille ?? REGLAGES_CARTE_DEFAUT)
  if (pal.remplir) {
    const terre = ctx.createLinearGradient(0, 0, 0, h)
    terre.addColorStop(0, pal.terre[0]); terre.addColorStop(0.5, pal.terre[1]); terre.addColorStop(0.85, pal.terre[2]); terre.addColorStop(1, pal.terre[3])
    ctx.beginPath()
    tracerLignes(ctx, fond ? fond.terres : fondLeger(), vue, w, h, true)
    ctx.fillStyle = terre
    ctx.fill()
    if (pal.relief) { ctx.save(); ctx.clip(); dessinerRelief(ctx, vue, w, h); ctx.restore() }
  }
  // vue satellite : vraie imagerie par-dessus le fond fabriqué (qui reste visible hors ligne ou en attendant les tuiles)
  if (opt.satellite && opt.texture !== false && opt.tuiles) {
    dessinerTuilesPlat(ctx, vue, w, h, opt.tuiles.dpr, opt.tuiles.aChange)
    if (opt.quadrillage) dessinerQuadrillagePlat(ctx, vue, w, h, opt.grille ?? REGLAGES_CARTE_DEFAUT)
    dessinerAttribution(ctx, w, h)
  }
  if (fond && opt.frontieres && vue.zoom >= 1.4) {
    ctx.beginPath()
    tracerLignes(ctx, fond.frontieres, vue, w, h, false)
    ctx.strokeStyle = `rgba(190,225,240,${Math.min(0.4, 0.12 + vue.zoom * 0.04)})`
    ctx.lineWidth = 0.8
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  ctx.beginPath()
  tracerLignes(ctx, fond ? fond.terres : fondLeger(), vue, w, h, true)
  ctx.strokeStyle = 'rgba(150,215,235,0.7)'
  ctx.lineWidth = vue.zoom > 6 ? 1.4 : 1
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function fleche(ctx: CanvasRenderingContext2D, x: number, y: number, capDeg: number, r: number, etroit: number, queue: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((capDeg * Math.PI) / 180)
  if (queue > 0) {   // sillage : on voit tout de suite dans quel sens ça bouge
    const g = ctx.createLinearGradient(0, r, 0, r + queue)
    g.addColorStop(0, ctx.fillStyle as string); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha *= 0.55
    ctx.fillStyle = g
    ctx.fillRect(-0.9, r * 0.6, 1.8, queue)
    ctx.globalAlpha /= 0.55
  }
  ctx.beginPath()
  ctx.moveTo(0, -r * 1.5); ctx.lineTo(r * etroit, r); ctx.lineTo(0, r * 0.45); ctx.lineTo(-r * etroit, r)
  ctx.closePath()
  ctx.fillStyle = ctx.strokeStyle as string
  ctx.fill()
  ctx.restore()
}

const pastille = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2) }

const tracesPictos = new Map<PictoId, Path2D>()
const traceDe = (id: PictoId): Path2D => {
  let p = tracesPictos.get(id)
  if (!p) { p = new Path2D(PICTOS[id].d); tracesPictos.set(id, p) }
  return p
}

/** Pictogramme de l'objet, centré en (x, y) : `lod` 2 = sur une pastille sombre cerclée de sa couleur, 1 = seul avec un liseré sombre. */
function dessinerPicto(ctx: CanvasRenderingContext2D, o: Objet, x: number, y: number, col: string, capDeg: number, lod: 1 | 2): void {
  const id = pictoDe(o), picto = PICTOS[id], demi = tailleDemi(o, lod)
  if (lod === 2) {
    ctx.globalAlpha = 0.9
    ctx.fillStyle = '#0b1424'
    pastille(ctx, x, y, demi + 3); ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = col
    ctx.lineWidth = o.ton === 'crit' ? 2.2 : 1.5
    pastille(ctx, x, y, demi + 3); ctx.stroke()
  }
  ctx.save()
  ctx.translate(x, y)
  if (picto.oriente) ctx.rotate((capDeg * Math.PI) / 180)
  const k = (lod === 2 ? demi * 0.92 : demi) / 12
  ctx.scale(k, k)
  ctx.translate(-12, -12)
  const trace = traceDe(id)
  if (lod === 1) {   // liseré sombre : le pictogramme reste lisible sur la terre comme sur la mer
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(8,16,30,0.85)'
    ctx.lineWidth = 2.6 / k
    ctx.stroke(trace)
  }
  ctx.fillStyle = col
  ctx.strokeStyle = col
  if (picto.trait) { ctx.lineWidth = picto.trait; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(trace) } else ctx.fill(trace, 'evenodd')
  ctx.restore()
}

/**
 * Dessine un objet à (x, y) en pixels. `phase` (0..1) anime les repères qui respirent ; `capEcran` = cap déjà corrigé pour le globe ;
 * `lod` = niveau de détail (voir `niveauDetail`) : en foule, retour aux formes simples pour garder la fluidité.
 * `halos` faux : aucun cercle animé (réglage « halos animés » de la scène).
 */
export function dessinerObjet(ctx: CanvasRenderingContext2D, o: Objet, x: number, y: number, choisi: boolean, phase: number, capEcran?: number, lod: 0 | 1 | 2 = 2, halos = true): void {
  const col = couleurObjet(o)
  ctx.fillStyle = col
  ctx.strokeStyle = col
  ctx.lineWidth = 1.5
  ctx.shadowColor = avecAlpha(col, 0.9)
  ctx.shadowBlur = 0
  if (lod !== 0) {
    // repères animés conservés autour du pictogramme : onde d'un séisme, halo d'une actualité grave, alerte d'un avion en urgence
    if (!halos) {
      // aucun repère animé
    } else if (o.couche === 'seismes') {
      for (const k of [0, 0.5]) { const p = (phase + k) % 1; ctx.globalAlpha = (1 - p) * 0.55; ctx.lineWidth = 1.5; pastille(ctx, x, y, o.rayon * (0.6 + p * 1.5) + 8); ctx.stroke() }
    } else if ((o.couche === 'infos' && (o.ton === 'crit' || o.ton === 'warn')) || o.ton === 'crit') {
      const crit = o.ton === 'crit'
      ctx.globalAlpha = (1 - phase) * (crit ? 0.75 : 0.45)
      ctx.lineWidth = crit ? 2 : 1.5
      pastille(ctx, x, y, tailleDemi(o, lod) + 4 + phase * (crit ? 16 : 10)); ctx.stroke()
    } else if (o.couche === 'cyber') {
      ctx.globalAlpha = 1 - phase; ctx.lineWidth = 2; pastille(ctx, x, y, 12 + phase * 18); ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = o.couche === 'avions' && o.sorte !== 'civil' ? 6 : 0
    dessinerPicto(ctx, o, x, y, col, capEcran ?? o.cap ?? 0, lod)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    if (choisi) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; pastille(ctx, x, y, tailleDemi(o, lod) + 8); ctx.stroke() }
    return
  }
  switch (o.couche) {
    case 'seismes': {
      for (const k of halos ? [0, 0.5] : []) {   // deux ondes qui s'élargissent : un séisme, ça se propage
        const p = (phase + k) % 1
        ctx.globalAlpha = (1 - p) * 0.55
        ctx.lineWidth = 1.5
        pastille(ctx, x, y, o.rayon * (0.5 + p * 1.3)); ctx.stroke()
      }
      ctx.globalAlpha = 0.5
      pastille(ctx, x, y, o.rayon * 0.55); ctx.fill()
      ctx.globalAlpha = 1
      ctx.lineWidth = 2
      pastille(ctx, x, y, o.rayon * 0.55); ctx.stroke()
      break
    }
    case 'evenements': {
      ctx.shadowBlur = 10
      ctx.globalAlpha = 0.95
      ctx.save()
      ctx.translate(x, y); ctx.rotate(Math.PI / 4)
      ctx.fillRect(-o.rayon * 0.62, -o.rayon * 0.62, o.rayon * 1.24, o.rayon * 1.24)
      ctx.restore()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#0b1424'
      pastille(ctx, x, y, o.rayon * 0.28); ctx.fill()
      break
    }
    case 'infos': {
      const crit = o.ton === 'crit', warn = o.ton === 'warn'
      if (halos && (crit || warn)) {   // halo qui respire : plus c'est grave, plus ça se voit
        ctx.globalAlpha = (1 - phase) * (crit ? 0.75 : 0.45)
        ctx.lineWidth = crit ? 2 : 1.5
        pastille(ctx, x, y, o.rayon + 2 + phase * (crit ? 16 : 10)); ctx.stroke()
      }
      ctx.shadowBlur = crit ? 14 : 8
      ctx.globalAlpha = 1
      pastille(ctx, x, y, o.rayon); ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#0b1424'
      ctx.font = `700 ${Math.round(o.rayon * 1.2)}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(THEMES.find((t) => t.id === o.sorte)?.lettre ?? '.', x, y + 0.5)
      break
    }
    case 'cyber':
      if (halos) {
        ctx.lineWidth = 2
        ctx.globalAlpha = 1 - phase
        pastille(ctx, x, y, 6 + phase * 18); ctx.stroke()
      }
      ctx.globalAlpha = 1
      pastille(ctx, x, y, 4); ctx.fill()
      break
    case 'avions':
      if (halos && o.ton === 'crit') { ctx.globalAlpha = 1 - phase; ctx.lineWidth = 2; pastille(ctx, x, y, 8 + phase * 16); ctx.stroke() }
      ctx.globalAlpha = o.sorte === 'militaire' || o.ton === 'crit' ? 1 : 0.85
      ctx.shadowBlur = o.sorte === 'militaire' ? 8 : 0
      fleche(ctx, x, y, capEcran ?? o.cap ?? 0, o.rayon, 0.8, 11)
      break
    case 'navires':
      ctx.globalAlpha = 0.95
      fleche(ctx, x, y, capEcran ?? o.cap ?? 0, o.rayon, 0.55, 8)
      break
    case 'satellites': {
      ctx.globalAlpha = 0.95
      ctx.shadowBlur = o.sorte === 'stations' ? 12 : 4
      ctx.beginPath(); ctx.moveTo(x, y - o.rayon); ctx.lineTo(x + o.rayon, y); ctx.lineTo(x, y + o.rayon); ctx.lineTo(x - o.rayon, y); ctx.closePath(); ctx.fill()
      if (o.sorte === 'stations') { ctx.shadowBlur = 0; ctx.lineWidth = 1; ctx.globalAlpha = 0.6; pastille(ctx, x, y, o.rayon + 5); ctx.stroke() }
      break
    }
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  if (choisi) {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    pastille(ctx, x, y, Math.max(o.rayon, 5) + 7); ctx.stroke()
  }
}

/** Trace au sol d'un satellite, déjà projetée en pixels : pointillés, un tronçon par morceau. */
export function dessinerTrace(ctx: CanvasRenderingContext2D, morceaux: readonly (readonly [number, number])[][]): void {
  ctx.strokeStyle = '#6fe7ff'
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.85
  ctx.setLineDash([5, 4])
  for (const m of morceaux) {
    if (m.length < 2) continue
    ctx.beginPath()
    m.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}

/** Objet projeté le plus proche du point (x, y), dans une tolérance en pixels ; les plus petits l'emportent à distance égale. */
export function plusProcheObjet(pts: readonly Pt[], x: number, y: number, tolerance = 14): Objet | null {
  let meilleur: Objet | null = null
  let dmin = Infinity
  for (const p of pts) {
    const d = Math.hypot(p.x - x, p.y - y)
    const portee = Math.max(tolerance, p.o.rayon * 0.8)
    if (d <= portee && d - p.o.rayon * 0.2 < dmin) { dmin = d - p.o.rayon * 0.2; meilleur = p.o }
  }
  return meilleur
}
