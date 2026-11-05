import type { EtatAmbilight } from '../../lib/djLiaisonAmbilight'

type Props = { etat: EtatAmbilight; onDemarrer: () => void; onArreter: () => void }

/** Le raccourci de la barre du haut : lance ou arrête le suivi de la musique par l'Ambilight, avec les réglages du bloc « ambilight tv ». */
export function AmbilightBarre({ etat, onDemarrer, onArreter }: Props) {
  if (etat.phase === 'arret') {
    return (
      <>
        <button type="button" className="btn solid dj-reel" onClick={onDemarrer}
          title="L’Ambilight de la télé suit la musique avec les réglages du bloc « ambilight tv ». Son style d’avant est rétabli à l’arrêt.">
          suivi ambilight
        </button>
        <span className="chip" title="Sans lancement, l’Ambilight garde son style.">la télé n’est pas touchée</span>
      </>
    )
  }
  if (etat.phase === 'demarrage') {
    return (
      <>
        <span className="chip warn" role="status">{etat.message || 'démarrage…'}</span>
        <button type="button" className="btn" onClick={onArreter}>annuler</button>
      </>
    )
  }
  if (etat.phase === 'erreur') {
    return (
      <>
        <span className="chip crit" role="alert">ambilight : {etat.message}</span>
        <button type="button" className="btn solid dj-reel" onClick={onDemarrer}>réessayer</button>
      </>
    )
  }
  return (
    <>
      <span className="chip ok" role="status" title="Navigateur, API, démon Lyra, télé. Une valeur en retard est abandonnée, jamais mise en file.">
        suivi ambilight en direct · voie {etat.voie === 'lounge' ? 'douce' : 'rapide'}{etat.ms !== null ? ` · ${Math.round(etat.ms)} ms` : ''}
      </span>
      <button type="button" className="btn dj-reel" onClick={onArreter}>arrêter le suivi</button>
    </>
  )
}
