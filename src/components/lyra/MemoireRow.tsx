import { useState } from 'react'
import { Btn, Chip } from '../ui'
import { estListe, listeDeValeur, nettoyerLignes, quand, texteEditable, validerMot, valeurDeListe, type Souvenir } from '../../lib/lyraMemoire'
import { VeutDireListe } from './VeutDireListe'

/** Un souvenir : clic sur le texte pour le corriger sur place (Entree = enregistrer, Echap = annuler). */
export function MemoireRow({ it, onSave, onRevert, onDelete }: {
  it: Souvenir
  onSave: (texte: string) => Promise<void>
  onRevert: () => void
  onDelete: () => void
}) {
  const [edition, setEdition] = useState(false)
  const editable = texteEditable(it)
  const mot = it.genre === 'mot'
  const [brouillon, setBrouillon] = useState(editable)
  const [occupe, setOccupe] = useState(false)
  const liste = estListe(it)
  const [lignes, setLignes] = useState<string[]>(() => listeDeValeur(editable))
  const [erreur, setErreur] = useState('')

  function ouvrir() { setBrouillon(editable); setLignes(listeDeValeur(editable)); setErreur(''); setEdition(true) }
  async function enregistrerListe() {
    const v = validerMot(it.texte, lignes)
    if (!v.ok) { setErreur(v.erreur); return }
    if (valeurDeListe(v.veutDire) === valeurDeListe(listeDeValeur(editable))) { setEdition(false); return }
    setOccupe(true)
    try { await onSave(valeurDeListe(v.veutDire)); setEdition(false) } catch (e) { setErreur((e as Error).message) } finally { setOccupe(false) }
  }
  async function enregistrer() {
    const t = brouillon.trim()
    if (!t || t === editable) { setEdition(false); return }
    setOccupe(true)
    try { await onSave(t); setEdition(false) } finally { setOccupe(false) }
  }

  return (
    <div className="lm-row">
      <div className="tx">
        {edition && liste ? (
          <div className="lm-add" role="group" aria-label={`corriger les « veut dire » de ${it.texte}`}>
            <div className="lm-add-l">« {it.texte} » veut dire <span className="lm-add-h">(une formulation par ligne)</span></div>
            <VeutDireListe lignes={lignes.length ? lignes : ['']} onChange={setLignes} disabled={occupe} />
            {erreur && <div className="lm-add-err" role="alert">{erreur}</div>}
            <div className="lm-add-act">
              <Btn sm disabled={occupe} onClick={() => setEdition(false)}>annuler</Btn>
              <Btn sm solid disabled={occupe || !nettoyerLignes(lignes).length} onClick={() => void enregistrerListe()}>enregistrer</Btn>
            </div>
          </div>
        ) : edition ? (
          <textarea className="lm-edit" rows={2} autoFocus value={brouillon} disabled={occupe}
            aria-label={mot ? 'corriger le sens de ce mot (synonymes séparés par des virgules)' : 'corriger ce souvenir'}
            maxLength={mot ? 100 : 500}
            onChange={(e) => setBrouillon(e.target.value)} onBlur={enregistrer}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enregistrer() }
              if (e.key === 'Escape') setEdition(false)
            }} />
        ) : (
          <div className="main" role="button" tabIndex={0} title={liste ? 'cliquer pour modifier les « veut dire »' : mot ? 'cliquer pour corriger le sens' : 'cliquer pour corriger'}
            onClick={ouvrir} onKeyDown={(e) => { if (e.key === 'Enter') ouvrir() }}>
            {it.texte}
          </div>
        )}
        {it.detail && <div className="sub">{it.detail}</div>}
        <div className="sub">
          {quand(it.at)}
          {it.local && <> <Chip tone="gold">ajouté ici seulement</Chip></>}
          {it.corrige && <> <Chip tone="gold">corrigé ici seulement</Chip> <span>(avant : {it.original})</span></>}
        </div>
      </div>
      <div className="act">
        {it.corrige && <Btn sm onClick={onRevert}>revenir</Btn>}
        <Btn sm onClick={ouvrir}>corriger</Btn>
        <Btn sm danger onClick={onDelete}>supprimer</Btn>
      </div>
    </div>
  )
}
