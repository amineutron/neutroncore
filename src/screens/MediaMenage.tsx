import { useState } from 'react'
import { Nettoyage } from '../components/menage/Nettoyage'
import { Recos } from '../components/menage/Recos'
import { Sante } from '../components/menage/Sante'
import '../components/ctl.css'
import { PageTitle } from '../components/ui'

type Onglet = 'nettoyage' | 'sante' | 'recos'
const ONGLETS: [Onglet, string][] = [['nettoyage', 'nettoyage'], ['sante', 'santé des fichiers'], ['recos', 'recommandations']]
const CLE = 'neutroncore_menage_onglet'

function onglet0(): Onglet {
  try { const v = localStorage.getItem(CLE); if (ONGLETS.some(([id]) => id === v)) return v as Onglet } catch { /* défaut */ }
  return 'nettoyage'
}

export function MediaMenage() {
  const [tab, setTab] = useState<Onglet>(onglet0)
  const choisir = (t: Onglet) => { setTab(t); try { localStorage.setItem(CLE, t) } catch { /* non retenu */ } }
  return (
    <>
      <PageTitle help="menage" title="entretien de la médiathèque" desc="nettoyer, vérifier les fichiers, trouver quoi demander" />
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {ONGLETS.map(([id, nom]) => (
          <button key={id} className={`btn sm ${tab === id ? 'solid' : ''}`} aria-pressed={tab === id} onClick={() => choisir(id)}>{nom}</button>
        ))}
      </div>
      <div className="nc-scope nc-stack">
        {tab === 'nettoyage' && <Nettoyage />}
        {tab === 'sante' && <Sante />}
        {tab === 'recos' && <Recos />}
      </div>
    </>
  )
}
