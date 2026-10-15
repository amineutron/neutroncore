// Atelier 3D : le scénario des vidéos (logique pure). Un film est une suite de plans ; chaque
// plan dit où est la caméra au début et à la fin, ce qui s'écarte, quel geste de montage il
// montre et quel texte il porte. La scène three.js ne fait qu'exécuter.

import type { Vec3 } from './atelier'
import type { MontageStep } from './atelierMontage'

/** Caméra en orbite autour de l'objet : azimut et élévation en degrés (0 = de face), `k` = recul (1 = cadré serré). */
export type Cam = { az: number; el: number; k: number }
export type Shot = {
  dur: number                    // secondes
  from: Cam; to: Cam
  camFin?: number                // part du plan au bout de laquelle la caméra est arrivée (défaut : tout le plan)
  explode?: [number, number]     // éclaté au début et à la fin
  step?: number                  // indice du geste de montage montré
  numero?: string                // « 3 / 21 »
  titre?: string; sous?: string; liste?: string[]
  fondu?: 'in' | 'out'
}

export const ease = (t: number): number => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function filmDuration(shots: Shot[]): number {
  return shots.reduce((s, x) => s + x.dur, 0)
}

/** Plan en cours à l'instant `t` et avancement dans ce plan (0..1) ; null une fois le film fini. */
export function shotAt(shots: Shot[], t: number): { index: number; u: number } | null {
  let debut = 0
  for (let i = 0; i < shots.length; i++) {
    if (t < debut + shots[i].dur) return { index: i, u: Math.max(0, (t - debut) / shots[i].dur) }
    debut += shots[i].dur
  }
  return null
}

export function camAt(shot: Shot, u: number): Cam {
  const t = ease(u / (shot.camFin ?? 1))
  return { az: lerp(shot.from.az, shot.to.az, t), el: lerp(shot.from.el, shot.to.el, t), k: lerp(shot.from.k, shot.to.k, t) }
}

export function explodeAt(shot: Shot, u: number): number {
  return shot.explode ? lerp(shot.explode[0], shot.explode[1], ease(u)) : 0
}

/** Arrivée d'une pièce dans un geste : elle attend, glisse, puis reste en place (0 = au départ, 1 = posée). */
export function slideAt(u: number): number {
  return ease((u - 0.3) / 0.45)
}

/** Opacité du voile noir (fondu d'ouverture ou de fermeture). */
export function fonduAt(shot: Shot, u: number): number {
  if (shot.fondu === 'in') return 1 - ease(u / 0.35)
  if (shot.fondu === 'out') return ease((u - 0.7) / 0.3)
  return 0
}

/** D'où regarder un geste : face à la direction d'où les pièces arrivent. */
export function camForDir(dir: Vec3): Cam {
  if (dir[2] < 0) return { az: 208, el: 22, k: 1.3 }
  if (dir[1] > 0) return { az: 28, el: 48, k: 1.3 }
  if (dir[1] < 0) return { az: 28, el: -34, k: 1.3 }
  if (dir[0] > 0) return { az: 62, el: 20, k: 1.3 }
  if (dir[0] < 0) return { az: -62, el: 20, k: 1.3 }
  return { az: 28, el: 22, k: 1.3 }
}

/** Même angle, exprimé au plus près de `ref` : la caméra prend le chemin court (pas un tour complet). */
function auPlusPres(cam: Cam, ref: Cam): Cam {
  let az = cam.az
  while (az - ref.az > 180) az -= 360
  while (az - ref.az < -180) az += 360
  return { ...cam, az }
}

const GESTE = 3.6        // secondes par geste : la caméra se place, la pièce arrive, on regarde

/** Notice de montage filmée : un plan par geste, dans l'ordre, puis l'objet fini. */
export function montageShots(titre: string, steps: MontageStep[], cams: Cam[], listes: string[][]): Shot[] {
  if (steps.length === 0) return []
  const depart: Cam = { az: 28, el: 22, k: 1.35 }
  const shots: Shot[] = [{ dur: 2.4, from: depart, to: { ...depart, az: 40 }, titre, sous: `montage en ${steps.length} gestes`, fondu: 'in' }]
  let cam = depart
  steps.forEach((s, i) => {
    const vers = auPlusPres(cams[i] ?? depart, cam)
    const dernier = i === steps.length - 1
    shots.push({
      dur: s.nouvelles.length || s.reprises.length ? GESTE : 2.2, from: cam, to: dernier ? { ...vers, az: vers.az + 70 } : vers, camFin: dernier ? 1 : 0.28,
      step: i, numero: `${i + 1} / ${steps.length}`, titre: s.titre, sous: s.astuce, liste: listes[i] ?? [], fondu: dernier ? 'out' : undefined,
    })
    cam = vers
  })
  return shots
}

/** Film de présentation : approche, travelling, plongée et contre-plongée, vue éclatée, pose finale. */
export function finalShots(titre: string, sous: string): Shot[] {
  return [
    { dur: 3.2, from: { az: -38, el: 10, k: 1.7 }, to: { az: -12, el: 16, k: 1.05 }, titre, fondu: 'in' },
    { dur: 4.6, from: { az: -12, el: 16, k: 1.05 }, to: { az: 172, el: 20, k: 1.02 } },
    { dur: 2.4, from: { az: 182, el: 56, k: 1.0 }, to: { az: 214, el: 48, k: 0.95 } },
    { dur: 2.4, from: { az: 34, el: -14, k: 0.92 }, to: { az: 56, el: -6, k: 0.92 } },
    { dur: 4.2, from: { az: 56, el: 18, k: 1.05 }, to: { az: 150, el: 26, k: 1.7 }, explode: [0, 1.1], sous: 'vue éclatée' },
    { dur: 2.2, from: { az: 150, el: 26, k: 1.7 }, to: { az: 196, el: 30, k: 1.7 }, explode: [1.1, 1.1] },
    { dur: 3.0, from: { az: 196, el: 30, k: 1.7 }, to: { az: 325, el: 18, k: 1.05 }, explode: [1.1, 0] },
    { dur: 3.2, from: { az: 325, el: 18, k: 1.05 }, to: { az: 336, el: 16, k: 1.4 }, titre, sous, fondu: 'out' },
  ]
}

const ISO = [35, 145, -35, -145]
/** Vue isométrique d'où des pièces se voient le mieux : la caméra se place du côté de l'objet où elles se
 * trouvent (rien ne passe devant), et par-dessous si elles sont dans le bas. Sans repère, la vue par défaut. */
export function camIso(concernees: string[], boites: Record<string, { min: Vec3; max: Vec3 }>): Cam {
  const toutes = Object.values(boites)
  const les = concernees.flatMap((n) => (boites[n] ? [boites[n]] : []))
  if (toutes.length === 0 || les.length === 0) return { az: ISO[0], el: 26, k: 1.15 }
  const centre = (bs: { min: Vec3; max: Vec3 }[]) => [0, 1, 2].map((i) => (Math.min(...bs.map((b) => b.min[i])) + Math.max(...bs.map((b) => b.max[i]))) / 2)
  const c = centre(toutes), p = centre(les)
  const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2]
  const rad = (a: number) => (a * Math.PI) / 180
  const az = Math.hypot(dx, dz) < 0.5 ? ISO[0] : [...ISO].sort((a, b) => (Math.sin(rad(b)) * dx + Math.cos(rad(b)) * dz) - (Math.sin(rad(a)) * dx + Math.cos(rad(a)) * dz))[0]
  const demiHaut = (Math.max(...toutes.map((b) => b.max[1])) - Math.min(...toutes.map((b) => b.min[1]))) / 2
  return { az, el: dy < -0.25 * demiHaut ? -22 : 26, k: 1.15 }
}
