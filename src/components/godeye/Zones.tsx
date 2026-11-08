import { confirmDialog } from '../../lib/dialog'
import { resumeForme, resumeObjets, ZONES_MAX, zoneVide, type Zone } from '../../lib/godeye/zones'
import type { EtatZones } from './useZones'
import './zones.css'

type Props = { etat: EtatZones; centreVue: () => { lat: number; lon: number } | null }

/** Onglet « zones » du panneau : liste des zones surveillées, interrupteurs actif et notifier, modifier, supprimer (avec confirmation). */
export function Zones({ etat, centreVue }: Props) {
  const nouvelle = () => { const c = centreVue(); etat.setBrouillon(c ? zoneVide(c.lat, c.lon) : zoneVide()) }
  const supprimer = async (z: Zone) => {
    const ok = await confirmDialog({ title: `supprimer la zone « ${z.nom} » ?`, body: 'La surveillance de cette zone s\'arrête et ses notifications aussi.', ok: 'supprimer', danger: true })
    if (ok) await etat.supprimer(z)
  }
  return (
    <div className="gz-liste">
      <p className="ge-note">Une zone est surveillée par le serveur : il note quand un avion, un navire, un satellite ou un séisme y entre ou en sort, même écran fermé. Rien n'est calculé ici.</p>
      <div className="gz-compte">
        <span>{etat.zones.length} / {ZONES_MAX} zones</span>
        <button type="button" className="gz-bouton gz-ok" disabled={etat.complet} onClick={nouvelle}>nouvelle zone</button>
      </div>
      {etat.complet && <p className="ge-note">Limite atteinte : supprime une zone pour en créer une autre.</p>}
      {etat.erreur && <p className="ge-note err">{etat.erreur}</p>}
      {!etat.chargees && !etat.erreur && <p className="ge-note">chargement des zones...</p>}
      {etat.chargees && !etat.erreur && etat.zones.length === 0 && (
        <p className="nc-empty">Aucune zone surveillée. Crée-en une pour être prévenu quand quelque chose entre dans un secteur qui t'intéresse.</p>
      )}
      <ul className="gz-items">
        {etat.zones.map((z) => (
          <li key={z.id} className={z.actif ? 'on' : ''}>
            <div className="gz-nomligne">
              <strong>{z.nom}</strong>
              <button type="button" className="gz-lien" onClick={() => etat.setBrouillon(z)}>modifier</button>
            </div>
            <div className="gz-meta">{resumeForme(z)} - {resumeObjets(z)}</div>
            <div className="gz-actions">
              <button type="button" className={`gz-inter${z.actif ? ' on' : ''}`} role="switch" aria-checked={z.actif} onClick={() => void etat.basculer(z, 'actif')}><i aria-hidden="true" />{z.actif ? 'active' : 'en pause'}</button>
              <button type="button" className={`gz-inter${z.notifier ? ' on' : ''}`} role="switch" aria-checked={z.notifier} onClick={() => void etat.basculer(z, 'notifier')}><i aria-hidden="true" />{z.notifier ? 'notifie' : 'muette'}</button>
              <button type="button" className="gz-lien gz-danger" disabled={etat.occupe} onClick={() => void supprimer(z)}>supprimer</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
