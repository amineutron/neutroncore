import './rotation.css'
import { useState } from 'react'
import { apiGet } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import type { Liste } from '../../lib/rotation'
import { Btn, Card, Chip, Loader } from '../ui'
import { RotationRow } from './RotationRow'
import { RotationWizard } from './RotationWizard'

// Rotations planifiées : un plan vérifié par élément du coffre. Aucune valeur de secret n'est lue ici.
export function Rotation() {
  const liste = usePoll<Liste>(() => apiGet('/rotation'), 15000)
  const [assistant, setAssistant] = useState(false)
  const d = liste.data
  if (!d) return <Loader label={liste.error ?? 'lecture des rotations…'} />
  const dues = d.elements.filter((e) => e.suivi.etat === 'due' || e.suivi.etat === 'echec').length

  return (
    <>
      <div className="rot-head">
        <Btn solid sm onClick={() => setAssistant(!assistant)}>{assistant ? 'fermer l\'assistant' : 'ajouter une rotation'}</Btn>
        <Chip tone={dues ? 'crit' : 'ok'}>{dues ? `${dues} à traiter` : 'tout est à jour'}</Chip>
        <span className="sp" />
        <span className="sec-muted">
          {d.coffre.disponible ? 'coffre accessible' : d.coffre.raison}
        </span>
      </div>
      {assistant && <RotationWizard cat={d.catalogue} coffreOk={d.coffre.disponible} raison={d.coffre.raison}
        onClose={() => setAssistant(false)} onDone={() => { setAssistant(false); liste.refresh() }} />}
      {d.elements.length === 0 && <Card title="rotations"><div className="sec-muted">aucune rotation planifiée.</div></Card>}
      <div className="rot-list">
        {d.elements.map((el) => <RotationRow key={el.id} el={el} coffreOk={d.coffre.disponible} onChange={liste.refresh} />)}
      </div>
      <p className="rot-note">
        Une rotation est un plan vérifié : contrôle de l'ancien secret, nouveau secret mis en attente dans le coffre
        (l'ancien est conservé), application, vérification, puis retour arrière automatique si une étape échoue.
        Les services ne sont relancés que s'ils sont déclarés. « vérifier maintenant » ne modifie rien.
      </p>
    </>
  )
}
