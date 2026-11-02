import { useState } from 'react'
import { Dette } from '../components/qualite/Dette'
import { TestsSante } from '../components/qualite/TestsSante'
import { PageTitle } from '../components/ui'
import { ecrirePref, lirePref } from '../lib/qualite'

type Onglet = 'tests' | 'dette'
const PREF = 'neutroncore_qualite_onglet'

// Qualité du code : santé des tests (historique, tendance, instables, bench) et dette technique.
export function Qualite() {
  const [onglet, setOnglet] = useState<Onglet>(() => (lirePref<Onglet>(PREF, 'tests') === 'dette' ? 'dette' : 'tests'))
  const choisir = (o: Onglet) => { setOnglet(o); ecrirePref(PREF, o) }
  return (
    <>
      <PageTitle help="qualite" title="qualité" desc="Santé des tests dans le temps et dette technique des projets suivis." />
      <div className="glyph-tabs" role="tablist" style={{ marginBottom: 14 }}>
        <button role="tab" aria-selected={onglet === 'tests'} className={onglet === 'tests' ? 'on' : ''} onClick={() => choisir('tests')}>santé des tests</button>
        <button role="tab" aria-selected={onglet === 'dette'} className={onglet === 'dette' ? 'on' : ''} onClick={() => choisir('dette')}>dette technique</button>
      </div>
      {onglet === 'tests' ? <TestsSante /> : <Dette />}
    </>
  )
}
