import { couleurObjet } from '../../lib/godeye/couleurs'
import { lignesFiche } from '../../lib/godeye/fiche'
import type { Donnees, Objet } from '../../lib/godeye/modele'
import { depuisTexte, typeSuivi, type Suivi } from '../../lib/godeye/suivi'
import './exploration.css'

const NOM_COUCHE: Record<Objet['couche'], string> = {
  seismes: 'séisme', avions: 'avion', satellites: 'satellite', navires: 'navire', evenements: 'événement', infos: 'actualité', cyber: 'cyber',
}

type Props = {
  objet: Objet
  donnees: Donnees
  maintenant: number
  /** Le suivi de cet objet, s'il est marqué. */
  suivi: Suivi | null
  /** La vue garde-t-elle cet objet au centre ? */
  centre: boolean
  onMarquer: (o: Objet) => void
  onRetirer: (s: Suivi) => void
  onCentrer: (o: Objet) => void
  onGarderAuCentre: (o: Objet) => void
  onFermer: () => void
}

/** Fiche détail de l'objet touché : sur ordinateur une carte en bas à gauche, sur téléphone une feuille basse dans la zone sûre. */
export function Fiche({ objet, donnees, maintenant, suivi, centre, onMarquer, onRetirer, onCentrer, onGarderAuCentre, onFermer }: Props) {
  const lignes = lignesFiche(objet, donnees, maintenant)
  const mobile = typeSuivi(objet) !== null
  const trace = objet.couche === 'satellites' ? 'trace des dernières minutes affichée en permanence' : mobile ? 'trace de ses positions depuis la sélection' : ''
  return (
    <section className="ge-fiche" data-bloque="1" role="dialog" aria-label={`fiche : ${objet.titre}`} style={{ '--c': couleurObjet(objet) } as React.CSSProperties}>
      <header className="ge-fiche-t">
        <span className="ge-fiche-type">{NOM_COUCHE[objet.couche]}</span>
        <b className="ge-fiche-nom">{objet.titre}</b>
        <button type="button" className="ge-fiche-x" onClick={onFermer} aria-label="fermer la fiche">fermer</button>
      </header>
      <dl className="ge-fiche-l">
        {lignes.map((l) => <div key={l.k}><dt>{l.k}</dt><dd>{l.v}</dd></div>)}
      </dl>
      {trace && <p className="ge-fiche-note">{trace}</p>}
      {suivi && <p className="ge-fiche-note">marqué {depuisTexte(suivi.depuis, maintenant)} : {suivi.points.length} position{suivi.points.length > 1 ? 's' : ''} enregistrée{suivi.points.length > 1 ? 's' : ''}</p>}
      <div className="ge-fiche-b">
        <button type="button" onClick={() => onCentrer(objet)}>centrer</button>
        {mobile && (
          <button type="button" className={centre ? 'on' : ''} aria-pressed={centre} onClick={() => onGarderAuCentre(objet)}
            title="La vue suit l'objet pendant son déplacement ; toucher ou faire glisser la carte arrête le suivi">
            {centre ? 'au centre : oui' : 'garder au centre'}
          </button>
        )}
        {mobile && (suivi
          ? <button type="button" onClick={() => onRetirer(suivi)}>ne plus marquer</button>
          : <button type="button" className="or" onClick={() => onMarquer(objet)} title="Enregistre sa position toutes les minutes à partir de maintenant">marquer</button>)}
        {objet.lien && <a href={objet.lien} target="_blank" rel="noopener noreferrer">source</a>}
      </div>
    </section>
  )
}
