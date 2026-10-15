import { ETAT_LABEL, GROUPE_LABEL, etatCommun, groupPieces, nextEtat, pieceLabel, type Etat, type Etats, type Piece } from '../../lib/atelier'

const GLYPH: Record<Etat | 'mixed', string> = { shown: '●', ghost: '◐', hidden: '○', mixed: '◑' }

// Bouton à trois états : affichée → fantôme → cachée. Sert pour une pièce, une famille ou un groupe.
export function EtatButton({ etat, label, onChange }: { etat: Etat | 'mixed'; label: string; onChange: (e: Etat) => void }) {
  const current = etat === 'mixed' ? 'shown' : etat
  const next = etat === 'mixed' ? 'shown' : nextEtat(etat)
  return (
    <button type="button" className={`at-etat ${etat}`} title={`${label} : ${etat === 'mixed' ? 'états mélangés' : ETAT_LABEL[current]} — toucher pour ${ETAT_LABEL[next]}`}
      aria-label={`${label} : ${etat === 'mixed' ? 'états mélangés' : ETAT_LABEL[current]}. Passer à ${ETAT_LABEL[next]}`} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange(next) }}>
      {GLYPH[etat]}
    </button>
  )
}

/** Ordre des pièces tel que la liste les affiche (sert à la sélection par plage, Maj + clic). */
export function ordreAffiche(pieces: Piece[], cles: string[]): string[] {
  return groupPieces(pieces, cles).flatMap((g) => g.familles.flatMap((f) => f.pieces.map((p) => p.nom)))
}

// Dans la liste, toucher un nom l'ajoute à la sélection ou l'en retire : on en prend autant qu'on veut.
// Maj + clic prend tout ce qui est entre la dernière pièce touchée et celle-ci.
export function PieceList({ pieces, cles, etats, selection, onEtat, onSelect, onSelectMany, onClear }: {
  pieces: Piece[]; cles: string[]; etats: Etats; selection: string[]
  onEtat: (noms: string[], etat: Etat) => void; onSelect: (nom: string, plage: boolean) => void
  onSelectMany: (noms: string[]) => void; onClear: () => void
}) {
  const groups = groupPieces(pieces, cles)
  const sel = new Set(selection)
  return (
    <div className="at-pieces">
      <p className="au-note">● affichée · ◐ fantôme · ○ cachée. Touche des noms pour les sélectionner ensemble ; Maj + clic prend toute la plage.</p>
      {selection.length > 0 && <p className="at-ctx">{selection.length} sélectionnée{selection.length > 1 ? 's' : ''} <button type="button" className="btn sm" onClick={onClear}>tout désélectionner</button></p>}
      {groups.map((g) => {
        const all = g.familles.flatMap((f) => f.pieces.map((p) => p.nom))
        return (
          <section key={g.groupe}>
            <header><EtatButton etat={etatCommun(etats, all)} label={GROUPE_LABEL[g.groupe]} onChange={(e) => onEtat(all, e)} /><b>{GROUPE_LABEL[g.groupe]}</b><span>{all.length}</span></header>
            {g.familles.map((f) => {
              const noms = f.pieces.map((p) => p.nom)
              if (noms.length === 1) return <PieceRow key={f.cle} nom={noms[0]} etat={etats[noms[0]] ?? 'shown'} selected={sel.has(noms[0])} onEtat={onEtat} onSelect={onSelect} />
              const toutes = noms.every((n) => sel.has(n))
              return (
                <details key={f.cle} className="at-famille">
                  <summary><EtatButton etat={etatCommun(etats, noms)} label={`famille ${f.cle}`} onChange={(e) => onEtat(noms, e)} />
                    <span className={noms.some((n) => sel.has(n)) ? 'on' : ''}>{pieceLabel(f.cle)}</span><em>× {noms.length}</em>
                    <button type="button" className={`btn sm at-fam-all ${toutes ? 'solid' : ''}`} aria-pressed={toutes} title={`Sélectionner les ${noms.length} d'un coup`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectMany(noms) }}>{toutes ? 'retirer' : 'toutes'}</button>
                  </summary>
                  {noms.map((n) => <PieceRow key={n} nom={n} etat={etats[n] ?? 'shown'} selected={sel.has(n)} onEtat={onEtat} onSelect={onSelect} />)}
                </details>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

function PieceRow({ nom, etat, selected, onEtat, onSelect }: {
  nom: string; etat: Etat; selected: boolean; onEtat: (noms: string[], etat: Etat) => void; onSelect: (nom: string, plage: boolean) => void
}) {
  return (
    <div className={`at-piece ${selected ? 'on' : ''} ${etat}`}>
      <EtatButton etat={etat} label={pieceLabel(nom)} onChange={(e) => onEtat([nom], e)} />
      <button type="button" className="at-name" aria-pressed={selected} onClick={(e) => onSelect(nom, e.shiftKey)}>{pieceLabel(nom)}</button>
    </div>
  )
}
