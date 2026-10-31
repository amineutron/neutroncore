import { useState } from 'react'
import { PageTitle } from '../components/ui'
import { AvisTab } from '../components/cyber/AvisTab'
import { LumiereTab } from '../components/cyber/LumiereTab'
import '../components/cyber/cyber.css'

const CLE = 'neutroncore_cyber_onglet'
type Onglet = 'avis' | 'lumiere'

function onglet(): Onglet {
  try { return localStorage.getItem(CLE) === 'lumiere' ? 'lumiere' : 'avis' } catch { return 'avis' }
}

export function Cyber() {
  const [tab, setTab] = useState<Onglet>(onglet)
  const choisir = (t: Onglet) => { setTab(t); try { localStorage.setItem(CLE, t) } catch { /* stockage indisponible */ } }
  return (
    <>
      <PageTitle help="cyber" title="cyber" desc="Avis et alertes du CERT-FR, exposition de ton adresse, et lumière selon le niveau d'alerte." />
      <div className="cy-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'avis'} className={tab === 'avis' ? 'on' : ''} onClick={() => choisir('avis')}>avis</button>
        <button role="tab" aria-selected={tab === 'lumiere'} className={tab === 'lumiere' ? 'on' : ''} onClick={() => choisir('lumiere')}>lumière</button>
      </div>
      {tab === 'avis' ? <AvisTab /> : <LumiereTab />}
    </>
  )
}
