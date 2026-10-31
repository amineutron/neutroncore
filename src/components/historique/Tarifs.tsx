import { useEffect, useState } from 'react'
import { apiGet, apiPut } from '../../lib/api'
import { Btn, Card } from '../ui'
import {
  ajouterRegle, lireTaux, modifierDefaut, modifierRegle, retirerRegle, type Taux, type Tarifs as TarifsT,
} from '../../lib/historique'

const CHAMPS: { k: keyof Taux; label: string }[] = [
  { k: 'entree', label: 'entrée' }, { k: 'sortie', label: 'sortie' }, { k: 'lecture', label: 'cache lu' },
  { k: 'ecriture', label: 'cache écrit 5 min' }, { k: 'ecriture_1h', label: 'cache écrit 1 h' },
]

function TauxCells({ t, onChange }: { t: Taux; onChange: (p: Partial<Taux>) => void }) {
  return (
    <>
      {CHAMPS.map((c) => (
        // saisie libre, validee a la sortie du champ (comme NumField) : une valeur bornee a chaque frappe est ininsaisissable
        <input key={c.k} defaultValue={t[c.k]} inputMode="decimal" aria-label={c.label}
          onBlur={(e) => onChange({ [c.k]: lireTaux(e.target.value) })} />
      ))}
    </>
  )
}

/** Tarif editable : prix par million de tokens, regles par nom de modele. Rien n'est pre-rempli. */
export function Tarifs({ onSaved }: { onSaved: () => void }) {
  const [t, setT] = useState<TarifsT | null>(null)
  const [msg, setMsg] = useState('')
  const [ouvert, setOuvert] = useState(false)
  useEffect(() => { apiGet<TarifsT>('/journal/tarifs').then(setT).catch((e: Error) => setMsg(e.message)) }, [])
  if (!t) return null

  async function save() {
    try {
      setT(await apiPut<TarifsT>('/journal/tarifs', t))
      setMsg('tarif enregistré')
      onSaved()
    } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <Card title="tarif" lite="prix par million de tokens, modifiable">
      <button className="btn sm" onClick={() => setOuvert(!ouvert)}>{ouvert ? 'replier' : 'modifier le tarif'}</button>
      {ouvert && (
        <div className="hi-tarif" style={{ marginTop: 10 }}>
          <div className="pdesc">Une règle s'applique aux modèles dont le nom contient son motif (ex. « opus »), la première trouvée gagne.
            Les autres modèles utilisent le tarif par défaut. Les prix viennent de ta grille officielle : rien n'est préenregistré.</div>
          <label className="mono" style={{ fontSize: 11 }}>devise{' '}
            <input defaultValue={t.devise} style={{ width: 70 }} onBlur={(e) => setT({ ...t, devise: e.target.value })} /></label>
          <div className="row head"><span>motif</span>{CHAMPS.map((c) => <span key={c.k}>{c.label}</span>)}<span /></div>
          <div className="row"><span className="mono">par défaut</span><TauxCells t={t.defaut} onChange={(p) => setT(modifierDefaut(t, p))} /><span /></div>
          {t.regles.map((r, i) => (
            <div className="row" key={`${i}-${JSON.stringify(r)}`}>
              <input defaultValue={r.motif} aria-label="motif" placeholder="motif" onBlur={(e) => setT(modifierRegle(t, i, { motif: e.target.value }))} />
              <TauxCells t={r} onChange={(p) => setT(modifierRegle(t, i, p))} />
              <Btn sm onClick={() => setT(retirerRegle(t, i))}>retirer</Btn>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <Btn sm onClick={() => setT(ajouterRegle(t))}>+ règle</Btn>
            <Btn sm solid onClick={save}>enregistrer</Btn>
            {msg && <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{msg}</span>}
          </div>
        </div>
      )}
    </Card>
  )
}
