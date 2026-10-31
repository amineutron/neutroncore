import { useState } from 'react'
import { apiPost } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { messageApplication, validerMot, type Application } from '../../lib/lyraMemoire'
import { Btn } from '../ui'
import { VeutDireListe } from './VeutDireListe'

/** « ajouter un mot » : le mot, puis les formulations qui doivent matcher aussi (« veut dire »). */
export function AjoutMot({ onAjoute }: { onAjoute: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const [mot, setMot] = useState('')
  const [lignes, setLignes] = useState<string[]>([''])
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  function fermer() { setOuvert(false); setMot(''); setLignes(['']); setErreur('') }

  async function envoyer() {
    const v = validerMot(mot, lignes)
    if (!v.ok) { setErreur(v.erreur); return }
    setErreur('')
    setOccupe(true)
    try {
      const r = await apiPost<Application>('/lyra/memoire/mots', { mot: v.mot, veut_dire: v.veutDire })
      const m = messageApplication('ajouté', r)
      toast(`« ${v.mot} » ${m.texte}`, m.ton)
      fermer()
      onAjoute()
    } catch (e) {
      setErreur((e as Error).message)
    } finally { setOccupe(false) }
  }

  if (!ouvert) return <Btn sm onClick={() => setOuvert(true)}>+ ajouter un mot</Btn>
  return (
    <form className="lm-add" onSubmit={(e) => { e.preventDefault(); void envoyer() }} aria-label="ajouter un mot">
      <label className="lm-add-l" htmlFor="lm-mot">le mot</label>
      <input id="lm-mot" className="lm-add-in" value={mot} autoFocus disabled={occupe} maxLength={60}
        placeholder="ex. la box" onChange={(e) => setMot(e.target.value)} />
      <div className="lm-add-l">veut dire <span className="lm-add-h">(ce qui doit matcher aussi)</span></div>
      <VeutDireListe lignes={lignes} onChange={setLignes} disabled={occupe} />
      {erreur && <div className="lm-add-err" role="alert">{erreur}</div>}
      <p className="lm-add-h">lyra comprendra ces formulations comme le mot. Pris en compte au redémarrage de son démon.</p>
      <div className="lm-add-act">
        <Btn sm onClick={fermer} disabled={occupe}>annuler</Btn>
        <button type="submit" className="btn solid sm" disabled={occupe}>{occupe ? 'ajout...' : 'ajouter'}</button>
      </div>
    </form>
  )
}
