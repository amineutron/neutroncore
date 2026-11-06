import { modeEcran, texteMode, type ModeEcran } from '../lib/ecranTv'
import './ecran-tv.css'

type Props = {
  etat: { power?: string; screen?: string } | undefined
  occupe: boolean                                        // un changement est en cours (la télé met quelques secondes)
  onChoisir: (mode: 'ecran' | 'son') => void
}

const Ecran = () => (
  <svg viewBox="0 0 64 48" className="et-ico" aria-hidden="true">
    <rect x="4" y="4" width="56" height="34" rx="5" className="et-cadre" />
    <rect x="9" y="9" width="46" height="24" rx="2.5" className="et-image" />
    <path d="M22 44h20M32 38v6" className="et-pied" />
  </svg>
)

const Son = () => (
  <svg viewBox="0 0 64 48" className="et-ico" aria-hidden="true">
    <rect x="4" y="4" width="56" height="34" rx="5" className="et-cadre et-cadre-noir" />
    <g className="et-barres">
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={15 + i * 8.5} y="14" width="4.5" height="14" rx="2.2" className={`et-barre et-barre-${i}`} />)}
    </g>
    <path d="M22 44h20M32 38v6" className="et-pied" />
  </svg>
)

/** Gros interrupteur : image à l'écran, ou « sound only » (panneau éteint, son conservé). */
export function EcranTv({ etat, occupe, onChoisir }: Props) {
  const mode: ModeEcran = modeEcran(etat)
  const actif = mode === 'ecran' || mode === 'son'
  const desactive = occupe || mode === 'indisponible'
  return (
    <section className={`ecran-tv mode-${mode} ${occupe ? 'occupe' : ''}`} aria-label="Mode d’affichage de la télé">
      <div className="et-rail" role="radiogroup" aria-label="Mode de la télé">
        {actif && <span className="et-curseur" aria-hidden="true" style={{ transform: mode === 'son' ? 'translateX(100%)' : 'translateX(0)' }} />}
        <button type="button" role="radio" aria-checked={mode === 'ecran'} className="et-choix" disabled={desactive} onClick={() => onChoisir('ecran')}>
          <Ecran /><b>écran</b><span>l’image s’affiche</span>
        </button>
        <button type="button" role="radio" aria-checked={mode === 'son'} className="et-choix" disabled={desactive} onClick={() => onChoisir('son')}>
          <Son /><b>sound only</b><span>panneau éteint, le son continue</span>
        </button>
      </div>
      <p className="et-etat" role="status">{occupe ? 'changement en cours… la télé met quelques secondes.' : texteMode(mode)}</p>
    </section>
  )
}
