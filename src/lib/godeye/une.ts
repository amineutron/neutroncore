// God Eye : ce qui mérite d'être regardé en premier parmi les objets affichés (logique pure).
import type { CoucheId, Objet } from './modele'

const POIDS_TON = { crit: 1000, warn: 500, ok: 100, info: 0 } as const
const POIDS_COUCHE: Record<CoucheId, number> = { avions: 300, seismes: 200, evenements: 150, infos: 120, satellites: 50, navires: 0, cyber: 0 }

/** Note d'intérêt : une urgence aérienne passe devant un gros séisme, devant un incendie, devant un avion militaire... */
export function interet(o: Objet): number {
  const base = POIDS_TON[o.ton] + POIDS_COUCHE[o.couche]
  if (o.couche === 'seismes') return base + o.rayon * 3
  if (o.couche === 'satellites') return base + (o.sorte === 'stations' ? 400 : 0)
  return base
}

/** Les `max` objets les plus intéressants, du plus au moins ; le cyber (un repère fixe) n'y figure pas. */
export function alaUne(objets: readonly Objet[], max = 10): Objet[] {
  return objets
    .filter((o) => o.couche !== 'cyber' && (o.ton !== 'info' || o.couche === 'satellites'))
    .map((o) => [o, interet(o)] as const)
    .sort((a, b) => b[1] - a[1] || a[0].id.localeCompare(b[0].id))
    .slice(0, max)
    .map(([o]) => o)
}

/** Décompte par couche. */
export function compter(objets: readonly Objet[]): Record<CoucheId, number> {
  const n: Record<CoucheId, number> = { seismes: 0, avions: 0, satellites: 0, navires: 0, evenements: 0, infos: 0, cyber: 0 }
  for (const o of objets) n[o.couche] += 1
  return n
}
