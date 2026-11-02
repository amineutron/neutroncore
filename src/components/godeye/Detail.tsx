import { couleurObjet } from '../../lib/godeye/couleurs'
import type { Objet } from '../../lib/godeye/modele'
import { ageTexte } from '../../lib/vueMonde'
import { Btn, Chip } from '../ui'

const NOM_COUCHE: Record<Objet['couche'], string> = {
  seismes: 'séisme', avions: 'avion', satellites: 'satellite', navires: 'navire', evenements: 'événement', infos: 'actualité', cyber: 'cyber',
}
const coord = (n: number, pos: string, neg: string): string => `${Math.abs(n).toFixed(2)}° ${n >= 0 ? pos : neg}`

/** Fiche de l'objet touché sur la carte. */
export function Detail({ objet, onFermer, onCentrer }: { objet: Objet; onFermer: () => void; onCentrer: (o: Objet) => void }) {
  const ton = objet.ton === 'crit' ? 'crit' : objet.ton === 'warn' ? 'warn' : undefined
  return (
    <div className="vm-info ge-detail" role="status" style={{ '--c': couleurObjet(objet) } as React.CSSProperties}>
      <div className="ge-detail-t">
        <Chip tone={ton}>{NOM_COUCHE[objet.couche]}</Chip> <b>{objet.titre}</b>
        <span className="grow" />
        <Btn sm onClick={() => onCentrer(objet)}>centrer</Btn> <Btn sm onClick={onFermer}>fermer</Btn>
      </div>
      <div>{objet.detail}</div>
      <div className="ge-detail-pos">
        {coord(objet.lat, 'N', 'S')}, {coord(objet.lon, 'E', 'O')}{objet.t ? ` - ${ageTexte(objet.t, Date.now())}` : ''}
        {objet.lien && <> - <a href={objet.lien} target="_blank" rel="noopener noreferrer">source</a></>}
      </div>
    </div>
  )
}
