import { useState } from 'react'
import { resumeFiltres, VUES_INTEGREES, type Filtres, type VueEnregistree } from '../../lib/godeye/filtres'
import { ICONES_PROFIL, NB_PROFILS, NOM_VUE_MAX, profilsPersonnels, vuesLibres } from '../../lib/godeye/vues'
import { Btn, Chip } from '../ui'
import { Picto } from './Picto'

export type DemandeProfil = { slot: number; nom: string; icone: string; /** vrai = garder les filtres et le cadrage de l'écran, faux = ne changer que le nom et l'icône */ avecEtat: boolean }

type Props = {
  perso: readonly VueEnregistree[]
  /** Vue appliquée en dernier (pour proposer « mettre à jour »). */
  active: VueEnregistree | null
  filtres: Filtres
  occupe: boolean
  erreur: string
  onAppliquer: (v: VueEnregistree) => void
  /** Enregistre une vue libre sous ce nom ; `id` remplace une vue existante. */
  onEnregistrer: (nom: string, id?: string) => void
  /** Enregistre (ou renomme) un des trois profils personnels. */
  onProfil: (d: DemandeProfil) => void
  onSupprimer: (v: VueEnregistree) => void
  onReinitialiser: () => void
}

/** Un profil personnel : icône et nom modifiables, appliquer, enregistrer l'état courant dedans, ou vider l'emplacement. */
function CarteProfil({ slot, vue, active, occupe, onAppliquer, onProfil, onSupprimer }: {
  slot: number; vue: VueEnregistree | null; active: boolean; occupe: boolean
  onAppliquer: (v: VueEnregistree) => void; onProfil: (d: DemandeProfil) => void; onSupprimer: (v: VueEnregistree) => void
}) {
  const [nom, setNom] = useState(vue?.nom ?? '')
  const [icone, setIcone] = useState(vue?.icone ?? 'monde')
  const [choix, setChoix] = useState(false)
  const modifie = vue ? nom.trim() !== vue.nom || icone !== (vue.icone ?? 'monde') : false
  const nomFinal = nom.trim() || `profil ${slot}`
  return (
    <li className={`ge-profil${active ? ' on' : ''}${vue ? '' : ' libre'}`}>
      <div className="ge-profil-tete">
        <button type="button" className="ge-profil-ico" aria-label={`icône du profil ${slot}`} aria-expanded={choix} onClick={() => setChoix(!choix)}><Picto id={icone} taille={20} /></button>
        <input value={nom} maxLength={NOM_VUE_MAX} placeholder={`profil ${slot}`} aria-label={`nom du profil ${slot}`} onChange={(e) => setNom(e.target.value)} />
      </div>
      {choix && (
        <div className="ge-profil-icones" role="listbox" aria-label="choisir une icône">
          {ICONES_PROFIL.map((i) => (
            <button key={i} type="button" role="option" aria-selected={i === icone} className={i === icone ? 'on' : ''} aria-label={i} onClick={() => { setIcone(i); setChoix(false) }}><Picto id={i} taille={18} /></button>
          ))}
        </div>
      )}
      <div className="ge-profil-actions">
        {vue && <Btn sm solid={active} onClick={() => onAppliquer(vue)}>appliquer</Btn>}
        <Btn sm disabled={occupe} onClick={() => onProfil({ slot, nom: nomFinal, icone, avecEtat: true })}>{vue ? 'écraser avec l\'écran' : 'enregistrer l\'écran ici'}</Btn>
        {vue && modifie && <Btn sm disabled={occupe} onClick={() => onProfil({ slot, nom: nomFinal, icone, avecEtat: false })}>renommer</Btn>}
        {vue && <button type="button" className="ge-vue-x" disabled={occupe} aria-label={`vider le profil ${slot}`} onClick={() => onSupprimer(vue)}>vider</button>}
      </div>
      {!vue && <p className="ge-note">Emplacement libre : règle la carte, puis enregistre-la ici.</p>}
    </li>
  )
}

/** Profils prêts, trois profils personnels (nom + icône + filtres + cadrage), et vues libres : un clic applique filtres + cadrage. */
export function PanneauVues({ perso, active, filtres, occupe, erreur, onAppliquer, onEnregistrer, onProfil, onSupprimer, onReinitialiser }: Props) {
  const [nom, setNom] = useState('')
  const profils = profilsPersonnels(perso)
  const libres = vuesLibres(perso)
  const resume = resumeFiltres(filtres)
  const soumettre = () => { if (nom.trim()) { onEnregistrer(nom); setNom('') } }
  return (
    <div className="ge-vues">
      <h4 className="ge-sous-titre">profils prêts</h4>
      <ul className="ge-profils-prets">
        {VUES_INTEGREES.map((v) => (
          <li key={v.id}>
            <button type="button" className={v.id === active?.id ? 'on' : ''} aria-pressed={v.id === active?.id} onClick={() => onAppliquer(v)}>
              <Picto id={v.icone} taille={16} /><span>{v.nom}</span>
            </button>
          </li>
        ))}
      </ul>

      <h4 className="ge-sous-titre">mes {NB_PROFILS} profils</h4>
      <ul className="ge-profils">
        {profils.map((v, i) => (
          <CarteProfil key={`${i}:${v?.id ?? 'libre'}:${v?.nom ?? ''}:${v?.icone ?? ''}`} slot={i + 1} vue={v} active={!!v && v.id === active?.id} occupe={occupe}
            onAppliquer={onAppliquer} onProfil={onProfil} onSupprimer={onSupprimer} />
        ))}
      </ul>

      <details className="ge-libres">
        <summary>autres vues enregistrées ({libres.length})</summary>
        <ul className="ge-vues-liste">
          {libres.map((v) => (
            <li key={v.id} className={v.id === active?.id ? 'on' : ''}>
              <button type="button" className="ge-vue-nom" onClick={() => onAppliquer(v)} aria-pressed={v.id === active?.id}>{v.nom}</button>
              <button type="button" className="ge-vue-x" aria-label={`supprimer la vue ${v.nom}`} disabled={occupe} onClick={() => onSupprimer(v)}>supprimer</button>
            </li>
          ))}
        </ul>
        <div className="ge-vues-sauve">
          <input value={nom} maxLength={NOM_VUE_MAX} placeholder="nom de la vue" aria-label="nom de la vue à enregistrer"
            onChange={(e) => setNom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') soumettre() }} />
          <Btn sm solid disabled={occupe || !nom.trim()} onClick={soumettre}>enregistrer</Btn>
          {active && !active.integree && !active.slot && <Btn sm disabled={occupe} onClick={() => onEnregistrer(active.nom, active.id)}>mettre à jour « {active.nom} »</Btn>}
        </div>
      </details>

      <div className="ge-vues-sauve"><Btn sm onClick={onReinitialiser}>tout réinitialiser</Btn></div>
      {erreur && <p className="ge-note err">{erreur}</p>}
      <p className="ge-note">Un profil garde les couches, tous les filtres et le cadrage de la carte. Il est stocké sur le PC : on le retrouve depuis le téléphone.</p>
      {resume.length > 0 && <div className="ge-actifs" aria-label="filtres actifs">{resume.map((r) => <Chip key={r}>{r}</Chip>)}</div>}
    </div>
  )
}
