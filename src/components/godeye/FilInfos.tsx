import type { Info } from '../../lib/godeye/modele'
import { THEMES } from '../../lib/godeye/modele'
import { ageTexte } from '../../lib/vueMonde'

const TON: Record<Info['niveau'], string> = { crit: 'crit', warn: 'warn', info: '' }

/** Fil d'actualités filtrées : le plus récent d'abord ; toucher une ligne localisée centre la carte dessus. */
export function FilInfos({ infos, max, choisi, onChoisir }: {
  infos: readonly Info[]; max: number; choisi: string | null; onChoisir: (a: Info) => void
}) {
  if (infos.length === 0) return <p className="nc-empty">aucune actualité avec ces filtres</p>
  const maintenant = Date.now()
  return (
    <ul className="ge-fil">
      {infos.slice(0, max).map((a) => (
        <li key={a.id} className={`${a.id === choisi ? 'on ' : ''}${TON[a.niveau]}`}>
          <span className={`ge-theme ${TON[a.niveau]}`} title={THEMES.find((t) => t.id === a.theme)?.nom}>{THEMES.find((t) => t.id === a.theme)?.lettre}</span>
          <div className="ge-fil-corps">
            <a href={a.lien} target="_blank" rel="noopener noreferrer">{a.titre}</a>
            <div className="ge-fil-meta">
              {a.sourceNom} - {ageTexte(a.t, maintenant)}
              {a.pays && <> - <button type="button" className="ge-lieu" onClick={() => onChoisir(a)} disabled={a.lat === null}>{a.pays}</button></>}
            </div>
          </div>
        </li>
      ))}
      {infos.length > max && <li className="muted">et {infos.length - max} autres : affiner les filtres pour les voir</li>}
    </ul>
  )
}
