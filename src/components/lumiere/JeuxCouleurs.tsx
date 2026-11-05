import { useState } from 'react'
import { confirmDialog, toast } from '../../lib/dialog'
import { CLE_JEUX, NOM_MAX, ajouterJeu, charger, enregistrer, retirerJeu, type JeuCouleurs } from '../../lib/jeuxCouleurs'

const degrade = (couleurs: string[]): string => `linear-gradient(90deg, ${(couleurs.length > 1 ? couleurs : [couleurs[0], couleurs[0]]).join(', ')})`

/** Les jeux de couleurs personnalisés : un clic pose le jeu sur le pad en cours d'édition (palette libre) ; les couleurs en
 * cours peuvent être gardées sous un nom. Ils restent dans ce navigateur ; le pad, lui, garde ses couleurs avec la scène. */
export function JeuxCouleurs({ couleurs, libre, onAppliquer }: { couleurs: string[]; libre: boolean; onAppliquer: (couleurs: string[]) => void }) {
  const [jeux, setJeux] = useState<JeuCouleurs[]>(() => charger())
  const [nom, setNom] = useState('')

  const changer = (suite: JeuCouleurs[]) => { setJeux(suite); enregistrer(CLE_JEUX, suite) }

  const garder = () => {
    try {
      const existe = jeux.some((j) => j.nom.trim().toLocaleLowerCase('fr') === nom.trim().toLocaleLowerCase('fr'))
      changer(ajouterJeu(jeux, nom, couleurs))
      toast(existe ? `jeu « ${nom.trim()} » mis à jour` : `jeu « ${nom.trim()} » enregistré`)
      setNom('')
    } catch (e) { toast(e instanceof Error ? e.message : 'enregistrement impossible', 'warn') }
  }

  const oter = async (j: JeuCouleurs) => {
    if (await confirmDialog({ title: `Supprimer le jeu « ${j.nom} » ?`, body: 'Les pads qui l’utilisent gardent leurs couleurs.', ok: 'supprimer', danger: true })) changer(retirerJeu(jeux, j.id))
  }

  return (
    <div className="lu-jeux">
      <p className="lu-legende">Mes jeux de couleurs</p>
      {jeux.length === 0 && <p className="lu-legende">Aucun pour l’instant : compose des couleurs avec « libre », puis donne-leur un nom ci-dessous.</p>}
      {jeux.length > 0 && (
        <div className="lu-palettes">
          {jeux.map((j) => (
            <span key={j.id} className="lu-jeu">
              <button type="button" className="lu-palette" onClick={() => onAppliquer(j.couleurs)} title={`Poser « ${j.nom} » sur ce pad`}>
                <span style={{ background: degrade(j.couleurs) }} /><i>{j.nom}</i>
              </button>
              <button type="button" className="lu-jeu-x" aria-label={`Supprimer le jeu ${j.nom}`} onClick={() => void oter(j)}>×</button>
            </span>
          ))}
        </div>
      )}
      {libre && (
        <form className="lu-jeu-nouveau" onSubmit={(e) => { e.preventDefault(); garder() }}>
          <input type="text" value={nom} maxLength={NOM_MAX} placeholder="nom du jeu (ex. bleu nuit)" aria-label="Nom du jeu de couleurs" onChange={(e) => setNom(e.target.value)} />
          <button type="submit" className="btn sm" disabled={!nom.trim()}>garder ces couleurs</button>
        </form>
      )}
    </div>
  )
}
