import { COULEURS_THEME } from '../../lib/godeye/couleurs'
import { modifier, type Filtres } from '../../lib/godeye/filtres'
import { THEMES, type Info } from '../../lib/godeye/modele'

/** Répartition des actualités par thème : une tuile colorée par thème (décompte, part, critiques) ; toucher une tuile isole le thème. */
export function Synthese({ infos, f, onChange }: { infos: readonly Info[]; f: Filtres; onChange: (f: Filtres) => void }) {
  const lignes = THEMES.filter((t) => t.id !== 'monde').map((t) => {
    const liste = infos.filter((a) => a.theme === t.id)
    return { ...t, n: liste.length, crit: liste.filter((a) => a.niveau === 'crit').length, warn: liste.filter((a) => a.niveau === 'warn').length }
  })
  const total = Math.max(1, lignes.reduce((s, l) => s + l.n, 0))
  const seul = f.infos.themes.length === 1 ? f.infos.themes[0] : null
  const isoler = (id: Info['theme']) => onChange(modifier(f, 'infos', { themes: seul === id ? THEMES.filter((t) => t.id !== 'monde').map((t) => t.id) : [id] }))
  return (
    <section className="ge-synthese" aria-label="répartition des actualités">
      <div className="ge-barre-part" role="img" aria-label="part de chaque thème">
        {lignes.map((l) => <i key={l.id} style={{ width: `${(l.n / total) * 100}%`, background: COULEURS_THEME[l.id] }} title={`${l.nom} : ${l.n}`} />)}
      </div>
      <div className="ge-tuiles">
        {lignes.map((l) => (
          <button key={l.id} type="button" className={`ge-tuile${seul === l.id ? ' on' : ''}`} aria-pressed={seul === l.id} onClick={() => isoler(l.id)}
            style={{ '--c': COULEURS_THEME[l.id] } as React.CSSProperties} title={seul === l.id ? 'Afficher tous les thèmes' : `Ne garder que ${l.nom}`}>
            <span className="ge-tuile-n">{l.n}</span>
            <span className="ge-tuile-t">{l.nom}</span>
            <span className="ge-tuile-m">{l.crit > 0 ? `${l.crit} critique${l.crit > 1 ? 's' : ''}` : l.warn > 0 ? `${l.warn} à surveiller` : 'calme'}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
