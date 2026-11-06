// « sauvegarde et journal » : export / import des réglages et vue du journal d'audit.
// Nommé Reglages2 pour ne pas toucher à Parametres.tsx (réglages d'affichage de l'app).
import { useState } from 'react'
import { CLE_ONGLET } from '../lib/reglages'
import { PageTitle } from '../components/ui'
import ExportImport from '../components/reglages/ExportImport'
import Audit from '../components/reglages/Audit'
import '../components/ctl.css'
import './reglages2.css'

const ONGLETS = [{ id: 'export', label: 'export / import' }, { id: 'audit', label: 'journal d’audit' }] as const
type Onglet = (typeof ONGLETS)[number]['id']

function onglet0(): Onglet {
  try { const t = localStorage.getItem(CLE_ONGLET); return ONGLETS.some((o) => o.id === t) ? (t as Onglet) : 'export' } catch { return 'export' }
}

export function Reglages2() {
  const [tab, setTab] = useState<Onglet>(onglet0)
  const choisir = (t: Onglet) => { setTab(t); try { localStorage.setItem(CLE_ONGLET, t) } catch { /* non retenu */ } }
  return (
    <>
      <PageTitle help="reglages2" title="sauvegarde et journal" desc="Emporte tes réglages dans un fichier, remets-les ailleurs, et relis ce qui a été fait sur l’API." />
      <div className="rg-tabs" role="tablist">
        {ONGLETS.map((o) => <button key={o.id} role="tab" aria-selected={tab === o.id} className={`btn sm ${tab === o.id ? 'solid' : ''}`} onClick={() => choisir(o.id)}>{o.label}</button>)}
      </div>
      <div className="nc-scope">{tab === 'export' ? <ExportImport /> : <Audit />}</div>
    </>
  )
}
