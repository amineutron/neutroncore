import { useState } from 'react'
import { PageTitle } from '../components/ui'
import { HistoriqueTab } from '../components/lyra/HistoriqueTab'
import { MemoireTab } from '../components/lyra/MemoireTab'
import '../components/lyra/lyra.css'

type Onglet = 'memoire' | 'historique'
const CLE = 'neutroncore_lm_onglet'

function ongletInitial(): Onglet {
  try { return localStorage.getItem(CLE) === 'historique' ? 'historique' : 'memoire' } catch { return 'memoire' }
}

/** Ce que lyra a retenu (parcourir, chercher, corriger) et ce qu'on lui a demandé (historique vocal). */
export function LyraMemoire() {
  const [onglet, setOnglet] = useState<Onglet>(ongletInitial)
  function choisir(o: Onglet) {
    setOnglet(o)
    try { localStorage.setItem(CLE, o) } catch { /* stockage indisponible */ }
  }
  return (
    <>
      <PageTitle title="mémoire de lyra" desc="ce qu'elle a retenu, ce que tu lui as demandé, et si ça a marché" help="lyra_memoire" />
      <div className="lm-tabs" role="tablist">
        <button role="tab" aria-selected={onglet === 'memoire'} className={onglet === 'memoire' ? 'on' : ''} onClick={() => choisir('memoire')}>mémoire</button>
        <button role="tab" aria-selected={onglet === 'historique'} className={onglet === 'historique' ? 'on' : ''} onClick={() => choisir('historique')}>historique vocal</button>
      </div>
      {onglet === 'memoire' ? <MemoireTab /> : <HistoriqueTab />}
    </>
  )
}
