import type { ReactNode } from 'react'
import { ETATS, TYPES, etatTon, type Appareil, type TypeAppareil } from '../../lib/zonesAudio'

const FORMES: Record<TypeAppareil, ReactNode> = {
  denon: <><rect x="3" y="8" width="18" height="9" rx="2" /><circle cx="8" cy="12.5" r="2" /><path d="M13 11h5M13 14h3" /></>,
  chromecast: <><rect x="8" y="3" width="8" height="18" rx="3" /><circle cx="12" cy="15" r="2.2" /><circle cx="12" cy="7.5" r=".8" /></>,
  tv: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M9 20h6M12 17v3" /></>,
  pc: <><rect x="4" y="4" width="16" height="11" rx="1.5" /><path d="M2 19h20M9 15v4M15 15v4" /></>,
}

export function IconeAppareil({ type }: { type: TypeAppareil }) {
  return (
    <svg className="sn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {FORMES[type]}
    </svg>
  )
}

type Props = {
  appareil: Appareil
  /** mode sélection : la carte entière est une case à cocher de 44 px au moins */
  choisi?: boolean
  onChoisir?: () => void
  note?: string
}

/** Carte d'un appareil audio : icône, nom humain, état, volume, hôte discret. */
export function AppareilCard({ appareil: a, choisi, onChoisir, note }: Props) {
  const ton = etatTon(a.etat)
  const corps = (
    <>
      <IconeAppareil type={a.type} />
      <span className="sn-txt">
        <b>{a.nom}</b>
        <span className="sn-sous">{TYPES[a.type].label}{a.detail ? ` · ${a.detail}` : ''}</span>
        {note && <span className="sn-note">{note}</span>}
      </span>
      <span className="sn-droite">
        <span className={`sn-etat ${ton ?? ''}`}>{ETATS[a.etat] ?? a.etat}</span>
        {a.volume !== null && <span className="sn-vol">vol. {a.volume}</span>}
        {a.hote && <small className="sn-hote">{a.hote}</small>}
      </span>
    </>
  )
  if (!onChoisir) return <div className={`sn-carte ${ton ?? ''}`}>{corps}</div>
  return (
    <label className={`sn-carte choix ${choisi ? 'on' : ''}`}>
      <input type="checkbox" checked={!!choisi} onChange={onChoisir} aria-label={`${a.nom}, ${TYPES[a.type].label}`} />
      {corps}
    </label>
  )
}
