import { materialRows, materialTotal, pieceLabel, priceRange, type Resume } from '../../lib/atelier'
import { toast } from '../../lib/dialog'

const copy = async (text: string) => {
  try { await navigator.clipboard.writeText(text); toast('copié') } catch { toast('copie impossible sur cet appareil', 'crit') }
}

// Ce qu'il faut acheter (l'impression n'est pas comptée) : un indice de prix et un nom à coller dans une recherche.
export function Materials({ resume, onShow }: { resume: Resume | null; onShow: (cle: string) => void }) {
  const rows = materialRows(resume)
  const total = materialTotal(rows)
  const prix = resume?.prix
  if (rows.length === 0) return <p className="at-faint">Aucune nomenclature pour cette itération.</p>
  return (
    <div className="at-materials">
      <div className="at-total">
        <span>à acheter, hors impression</span>
        <b>{total.min === 0 && total.max === 0 ? 'prix non relevés' : priceRange(total.min, total.max)}</b>
        {total.manquants > 0 && total.max > 0 && <em>+ {total.manquants} article{total.manquants > 1 ? 's' : ''} sans prix : c'est un minimum</em>}
      </div>
      <p className="au-note">
        {prix?.releve_le ? `Indice relevé le ${prix.releve_le} sur de grandes plateformes, par lot tel qu'il est vendu. ` : 'Aucun relevé de prix pour ce modèle. '}
        Ce n'est pas un devis : un lot couvre souvent plus que le besoin, et le port n'est pas compté.
      </p>
      {rows.map((r) => (
        <div key={r.cle} className="at-material">
          <div className="at-material-head">
            <button type="button" className="at-name" onClick={() => onShow(r.cle)} title="Montrer dans la vue 3D">{r.nature || pieceLabel(r.cle)} <em>× {r.quantite}</em>{r.consommable && <em> · consommable</em>}</button>
            <b className={r.min === null && r.max === null ? 'at-faint' : ''}>{priceRange(r.min, r.max, r.inclus)}</b>
          </div>
          {r.recherche !== r.designation && <p>{r.nature ? `Référence : ${r.designation}` : r.designation}</p>}
          <div className="at-search">
            <code>{r.recherche}</code>
            <button type="button" className="btn sm" onClick={() => void copy(r.recherche)} aria-label={`Copier le nom de recherche : ${r.recherche}`}>copier</button>
          </div>
          {(r.conditionnement || r.plateformes.length > 0 || r.confiance) && (
            <p className="at-meta">{[r.conditionnement, r.plateformes.join(', '), r.confiance && `confiance ${r.confiance}`].filter(Boolean).join(' · ')}</p>
          )}
          {r.remarque && <p className="at-warn">{r.remarque}</p>}
        </div>
      ))}
      {(resume?.pieces_imprimees ?? []).length > 0 && (
        <>
          <b className="at-sub">à imprimer</b>
          {resume!.pieces_imprimees!.map((p) => (
            <div key={p.nom} className="at-print"><span>{p.designation} <em>× {p.quantite}</em></span><span>{p.masse_g === null ? '—' : `${p.masse_g} g`}</span></div>
          ))}
        </>
      )}
    </div>
  )
}
