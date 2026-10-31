import type { ReactNode } from 'react'

/** Le panneau « réglages avancés » : un titre et ses sections (musique, respiration fine, scène, sets, puis les
 * outils branchés plus tard). Chaque section est un `Bloc` repliable fourni par l'écran. */
export function ReglagesAvances({ children }: { children: ReactNode }) {
  return (
    <section className="lu-avance" aria-label="Réglages avancés">
      <h2 className="lu-avance-titre">réglages avancés</h2>
      {children}
    </section>
  )
}

/** Sépare les familles de réglages dans le panneau avancé (« son », « lumière », « outils »). */
export function GroupeAvance({ titre, children }: { titre: string; children?: ReactNode }) {
  if (!children) return null      // un groupe sans outil branché ne montre pas de titre seul
  return (
    <div className="lu-groupe" role="group" aria-label={titre}>
      <h4 className="lu-groupe-titre">{titre}</h4>
      {children}
    </div>
  )
}

/** Bascule « simple / avancé ». */
export function BasculeMode({ mode, onChange }: { mode: 'simple' | 'avance'; onChange: (m: 'simple' | 'avance') => void }) {
  return (
    <div className="lu-bascule" role="radiogroup" aria-label="Niveau de réglage">
      {(['simple', 'avance'] as const).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} className={`btn sm ${mode === m ? 'solid' : ''}`} onClick={() => onChange(m)}>{m === 'simple' ? 'simple' : 'avancé'}</button>
      ))}
    </div>
  )
}
