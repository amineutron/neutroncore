import { MAX_MOT, MAX_VEUT_DIRE } from '../../lib/lyraMemoire'
import { Btn } from '../ui'

/** Liste editable de « veut dire » : une ligne par formulation, ajouter / retirer. Controlee par le parent. */
export function VeutDireListe({ lignes, onChange, disabled, exemple = 'la télé' }: {
  lignes: string[]
  onChange: (lignes: string[]) => void
  disabled?: boolean
  exemple?: string
}) {
  const maj = (i: number, v: string) => onChange(lignes.map((l, k) => (k === i ? v : l)))
  const retirer = (i: number) => onChange(lignes.filter((_, k) => k !== i))
  const ajouter = () => onChange([...lignes, ''])
  return (
    <div className="lm-vd">
      {lignes.map((l, i) => (
        <div key={i} className="lm-vd-row">
          <input value={l} disabled={disabled} maxLength={MAX_MOT} placeholder={`ex. ${exemple}`}
            aria-label={`veut dire, ligne ${i + 1}`} autoFocus={i === lignes.length - 1 && l === '' && lignes.length > 1}
            onChange={(e) => maj(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (l.trim()) ajouter() } }} />
          <button type="button" className="lm-vd-x" aria-label={`retirer la ligne ${i + 1}`} disabled={disabled || lignes.length <= 1}
            onClick={() => retirer(i)}>-</button>
        </div>
      ))}
      <Btn sm disabled={disabled || lignes.length >= MAX_VEUT_DIRE} onClick={ajouter}>+ ajouter une formulation</Btn>
    </div>
  )
}
