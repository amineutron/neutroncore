import { pointsCourbe } from '../../lib/qualite'

// Petite courbe de durée (SVG). Aucune bibliothèque : une polyligne et le dernier point.
export function Courbe({ valeurs, w = 120, h = 28, tone = '' }: { valeurs: number[]; w?: number; h?: number; tone?: '' | 'ok' | 'warn' | 'crit' }) {
  if (valeurs.length === 0) return <span style={{ color: 'var(--faint)', fontSize: 11 }}>pas de courbe</span>
  const pts = pointsCourbe(valeurs, w, h)
  const [dx, dy] = pts.split(' ').at(-1)!.split(',')
  const couleur = tone === 'crit' ? 'var(--crit)' : tone === 'warn' ? 'var(--warn)' : tone === 'ok' ? 'var(--ok)' : 'var(--gold)'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`durées : ${valeurs.map((v) => v.toFixed(1)).join(', ')} secondes`}>
      <polyline points={pts} fill="none" stroke={couleur} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
      <circle cx={dx} cy={dy} r={2.5} fill={couleur} />
    </svg>
  )
}
