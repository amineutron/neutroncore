import { useState } from 'react'
import '../components/ctl.css'
import { Btn, PageTitle } from '../components/ui'
import { Secrets } from '../components/securite/Secrets'
import { JournalView } from '../components/securite/JournalView'
import { Rotation } from '../components/securite/Rotation'

const CLE = 'neutroncore_securite_onglet'
type Onglet = 'secrets' | 'rotation' | 'journal'

function onglet(): Onglet {
  try {
    const v = localStorage.getItem(CLE)
    return v === 'journal' || v === 'rotation' ? v : 'secrets'
  } catch {
    return 'secrets'
  }
}

export function Securite() {
  const [tab, setTab] = useState<Onglet>(onglet)
  const choisir = (t: Onglet) => {
    setTab(t)
    try { localStorage.setItem(CLE, t) } catch { /* onglet non retenu */ }
  }
  return (
    <>
      <PageTitle help="securite" title="sécurité" desc="Secrets (lecture seule), rotations vérifiées des mots de passe et journal système filtrable." />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Btn sm solid={tab === 'secrets'} onClick={() => choisir('secrets')}>secrets</Btn>
        <Btn sm solid={tab === 'rotation'} onClick={() => choisir('rotation')}>rotation</Btn>
        <Btn sm solid={tab === 'journal'} onClick={() => choisir('journal')}>journal système</Btn>
      </div>
      <div className="nc-scope nc-stack">{tab === 'secrets' ? <Secrets /> : tab === 'rotation' ? <Rotation /> : <JournalView />}</div>
    </>
  )
}
