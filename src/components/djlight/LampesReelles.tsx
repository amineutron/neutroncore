import type { EtatLiaison } from '../../lib/djLiaison'

type Props = { etat: EtatLiaison; avanceMs: number; onDemarrer: () => void; onArreter: () => void }

/** Le bouton qui envoie DJ Light aux vraies lampes (via huebeat), et ce qu'il se passe. Aperçu seul tant qu'on ne l'a pas lancé. */
export function LampesReelles({ etat, avanceMs, onDemarrer, onArreter }: Props) {
  if (etat.phase === 'arret') {
    return (
      <>
        <button type="button" className="btn solid dj-reel" onClick={onDemarrer}
          title="Met huebeat en route et envoie la lumière calculée ici à tes lampes Hue, image par image. Les lampes quittent leur état actuel jusqu’à l’arrêt.">
          lancer sur les vraies lampes
        </button>
        <span className="chip" title="Sans lancement, seule la pièce 3d à l’écran bouge.">aperçu seulement : tes lampes ne sont pas touchées</span>
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
        <span className="chip crit" role="alert">lampes : {etat.message}</span>
        <button type="button" className="btn solid dj-reel" onClick={onDemarrer}>réessayer</button>
        <button type="button" className="btn" onClick={onArreter} title="Rend les lampes à leur état d’avant si huebeat les tenait">arrêter</button>
      </>
    )
  }
  return (
    <>
      <span className="chip ok dj-direct" role="status" title={`Chaîne : son de l’ordinateur, analyse, calcul ici, canal direct, huebeat, pont Hue. La lumière part ${avanceMs} ms avant le temps pour absorber ce retard (réglable dans « analyse et latence »).`}>
        lampes en direct · {etat.canaux.length} canaux · avance {avanceMs} ms
      </span>
      {etat.message && <span className="chip warn" role="alert">{etat.message}</span>}
      <span className="chip" title="La lumière est calculée dans cet onglet : le fermer, ou quitter cet écran, rend les lampes.">garde cet écran ouvert</span>
      <button type="button" className="btn dj-reel" onClick={onArreter}>arrêter et rendre les lampes</button>
    </>
  )
}
