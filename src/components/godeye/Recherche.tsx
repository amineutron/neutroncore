import { useMemo, useState } from 'react'
import type { Donnees } from '../../lib/godeye/modele'
import { chercher, LONGUEUR_MIN, TYPES_RECHERCHE, type Resultat, type TypeRecherche } from '../../lib/godeye/recherche'
import './exploration.css'

type Props = { donnees: Donnees; onChoisir: (r: Resultat) => void }

/** Recherche sur tous les éléments (avions, navires, satellites, séismes, événements, actualités, pays), avec filtre par type. */
export function Recherche({ donnees, onChoisir }: Props) {
  const [q, setQ] = useState('')
  const [types, setTypes] = useState<ReadonlySet<TypeRecherche>>(new Set())
  const resultats = useMemo(() => chercher(donnees, q, types), [donnees, q, types])
  const bascule = (t: TypeRecherche): void => setTypes((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n })
  const pret = q.trim().length >= LONGUEUR_MIN
  return (
    <div className="ge-rech">
      <input type="search" className="ge-rech-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="indicatif, MMSI, satellite, lieu, pays..." aria-label="chercher" autoComplete="off" enterKeyHint="search" />
      <div className="ge-rech-f" role="group" aria-label="filtrer par type">
        {TYPES_RECHERCHE.map((t) => (
          <button key={t.id} type="button" className={types.has(t.id) ? 'on' : ''} aria-pressed={types.has(t.id)} onClick={() => bascule(t.id)}>{t.nom}</button>
        ))}
      </div>
      {!pret && <p className="nc-empty">Taper au moins {LONGUEUR_MIN} lettres. La recherche porte sur ce qui est chargé : une couche coupée n'est pas cherchée.</p>}
      {pret && resultats.length === 0 && <p className="nc-empty">aucun résultat</p>}
      <ul className="ge-rech-r">
        {resultats.map((r) => (
          <li key={r.cle}>
            <button type="button" onClick={() => onChoisir(r)}>
              <span className="ge-rech-type">{TYPES_RECHERCHE.find((t) => t.id === r.type)?.nom.replace(/s$/, '')}</span>
              <span className="ge-rech-t">{r.titre}</span>
              <span className="ge-rech-d">{r.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
