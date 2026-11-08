import { PICTOS, type PictoId } from '../../lib/godeye/pictos'

type Props = { id?: string | null; taille?: number; couleur?: string }

/** Pictogramme God Eye en SVG (même tracé que sur la carte) ; un identifiant inconnu donne le globe. */
export function Picto({ id, taille = 18, couleur = 'currentColor' }: Props) {
  const p = PICTOS[(id ?? 'monde') as PictoId] ?? PICTOS.monde
  return (
    <svg className="ge-picto" viewBox="0 0 24 24" width={taille} height={taille} aria-hidden="true" focusable="false">
      {p.trait
        ? <path d={p.d} fill="none" stroke={couleur} strokeWidth={p.trait} strokeLinecap="round" strokeLinejoin="round" />
        : <path d={p.d} fill={couleur} fillRule="evenodd" />}
    </svg>
  )
}
