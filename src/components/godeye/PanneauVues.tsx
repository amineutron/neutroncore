import { useState } from 'react'
import { resumeFiltres, type Filtres, type VueEnregistree } from '../../lib/godeye/filtres'
import { NOM_VUE_MAX, toutesLesVues } from '../../lib/godeye/vues'
import { Btn, Chip } from '../ui'

type Props = {
  perso: readonly VueEnregistree[]
  /** Vue appliquée en dernier (pour proposer « mettre à jour »). */
  active: VueEnregistree | null
  filtres: Filtres
  occupe: boolean
  erreur: string
  onAppliquer: (v: VueEnregistree) => void
  /** Enregistre sous ce nom ; `id` remplace une vue existante. */
  onEnregistrer: (nom: string, id?: string) => void
  onSupprimer: (v: VueEnregistree) => void
  onReinitialiser: () => void
}

/** Vues toutes faites et vues de l'utilisateur : un clic applique filtres + cadrage ; enregistrer garde l'état courant. */
export function PanneauVues({ perso, active, filtres, occupe, erreur, onAppliquer, onEnregistrer, onSupprimer, onReinitialiser }: Props) {
  const [nom, setNom] = useState('')
  const toutes = toutesLesVues(perso)
  const resume = resumeFiltres(filtres)
  const soumettre = () => { if (nom.trim()) { onEnregistrer(nom); setNom('') } }
  return (
    <div className="ge-vues">
      <ul className="ge-vues-liste">
        {toutes.map((v) => (
          <li key={v.id} className={v.id === active?.id ? 'on' : ''}>
            <button type="button" className="ge-vue-nom" onClick={() => onAppliquer(v)} aria-pressed={v.id === active?.id}>{v.nom}</button>
            {v.integree ? <span className="ge-vue-tag">intégrée</span> : (
              <button type="button" className="ge-vue-x" aria-label={`supprimer la vue ${v.nom}`} disabled={occupe} onClick={() => onSupprimer(v)}>supprimer</button>
            )}
          </li>
        ))}
      </ul>
      <div className="ge-vues-sauve">
        <input value={nom} maxLength={NOM_VUE_MAX} placeholder="nom de la vue" aria-label="nom de la vue à enregistrer"
          onChange={(e) => setNom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') soumettre() }} />
        <Btn sm solid disabled={occupe || !nom.trim()} onClick={soumettre}>enregistrer</Btn>
        {active && !active.integree && <Btn sm disabled={occupe} onClick={() => onEnregistrer(active.nom, active.id)}>mettre à jour « {active.nom} »</Btn>}
        <Btn sm onClick={onReinitialiser}>tout réinitialiser</Btn>
      </div>
      {erreur && <p className="ge-note err">{erreur}</p>}
      <p className="ge-note">Une vue garde les couches, tous les filtres et le cadrage de la carte. Elle est stockée sur le PC : on la retrouve depuis le téléphone.</p>
      {resume.length > 0 && <div className="ge-actifs" aria-label="filtres actifs">{resume.map((r) => <Chip key={r}>{r}</Chip>)}</div>}
    </div>
  )
}
