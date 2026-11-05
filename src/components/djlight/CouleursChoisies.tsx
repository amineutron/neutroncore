import { JeuxCouleurs } from '../lumiere/JeuxCouleurs'
import { nettoyerCouleurs } from '../../lib/jeuxCouleurs'
import { MAX_COULEURS } from '../../lib/spatialPalette'

/** Rouge, vert, jaune : de quoi partir quand on coche « choisir les couleurs » sans autre base. */
export const COULEURS_DEPART = ['#ff0000', '#00ff00', '#ffff00']

type Props = {
  couleurs: string[] | undefined
  depart: string[]                                // ce que l'on pose en cochant : par exemple les couleurs actuelles de la scène
  onChange: (couleurs: string[]) => void          // liste vide : on revient à la palette de la scène
}

/** Choix manuel des couleurs d'une rangée (ex. un kick en rouge, vert et jaune), avec les jeux enregistrés. */
export function CouleursChoisies({ couleurs, depart, onChange }: Props) {
  const choisies = nettoyerCouleurs(couleurs ?? [])
  const actif = choisies.length > 0
  const poser = (liste: string[]) => onChange(nettoyerCouleurs(liste))
  return (
    <div className="dj-couleurs-choisies">
      <label className="dj-inverse">
        <input type="checkbox" checked={actif} onChange={(e) => onChange(e.target.checked ? (nettoyerCouleurs(depart).length > 0 ? nettoyerCouleurs(depart) : COULEURS_DEPART) : [])} />
        choisir les couleurs à la main
      </label>
      {!actif && <p className="dj-note">Les couleurs viennent de la palette de la scène. Coche pour imposer les tiennes.</p>}
      {actif && (<>
        <div className="lu-couleurs">
          {choisies.map((c, i) => (
            <span key={i} className="lu-couleur">
              <input type="color" value={c} aria-label={`Couleur ${i + 1}`} onChange={(e) => poser(choisies.map((x, j) => (j === i ? e.target.value : x)))} />
              {choisies.length > 1 && <button type="button" aria-label={`Retirer la couleur ${i + 1}`} onClick={() => poser(choisies.filter((_, j) => j !== i))}>×</button>}
            </span>
          ))}
          {choisies.length < MAX_COULEURS && <button type="button" className="btn sm" onClick={() => poser([...choisies, '#ffffff'])}>+ couleur</button>}
          <p className="dj-note">Les couleurs se succèdent dans cet ordre, au fil des mesures.</p>
        </div>
        <JeuxCouleurs couleurs={choisies} libre onAppliquer={poser} />
      </>)}
    </div>
  )
}
