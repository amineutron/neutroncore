import { COUCHES } from '../../lib/godeye/modele'
import type { Pastille } from '../../lib/godeye/fraicheur'
import { useContexteAvance } from './useAvance'
import './avance.css'

const NOM = Object.fromEntries(COUCHES.map((c) => [c.id, c.nom]))

/** Une pastille par couche allumée : vert = frais, orange = en retard ou copie gardée, rouge = source en panne (dernier état conservé). */
export function Fraicheur({ pastilles }: { pastilles?: Pastille[] }) {
  const ctx = useContexteAvance()
  const liste = (pastilles ?? ctx.pastilles).filter((p) => p.ton !== 'off')
  if (liste.length === 0) return null
  return (
    <ul className="ge-fraicheur" aria-label="fraîcheur des couches">
      {liste.map((p) => (
        <li key={p.couche} className={`ge-fr ${p.ton}${p.perime ? ' perime' : ''}`} title={p.texte}>
          <i aria-hidden="true" />
          <b>{NOM[p.couche]}</b>
          <span>{p.texte}</span>
        </li>
      ))}
    </ul>
  )
}
