import { useEffect, useState } from 'react'
import { apiPut } from '../../lib/api'
import { toast } from '../../lib/dialog'
import type { EtatReseau } from '../../lib/reseau'
import { Btn, Card } from '../ui'

export function Reglages({ etat, relire }: { etat: EtatReseau; relire: () => void }) {
  const r = etat.reglages
  const [cible, setCible] = useState(r.cible_internet)
  useEffect(() => setCible(r.cible_internet), [r.cible_internet])
  const envoyer = async (corps: object, message: string) => {
    try { await apiPut('/reseau/reglages', corps); toast(message); relire() }
    catch (e) { toast(e instanceof Error ? e.message : 'refusé', 'crit') }
  }
  return (
    <Card title="réglages" lite="alerte et mesure">
      <label className="rs-filtre">
        <input type="checkbox" checked={r.alerte} onChange={() => void envoyer({ alerte: !r.alerte }, r.alerte ? 'alertes coupées' : 'alertes actives')} />
        {' '}prévenir dans les notifications quand un appareil inconnu apparaît
      </label>
      <label className="rs-filtre">
        <input type="checkbox" checked={r.resoudre_noms !== false} onChange={() => void envoyer({ resoudre_noms: r.resoudre_noms === false }, 'réglage enregistré')} />
        {' '}chercher le nom des appareils (une requête mDNS / DNS par appareil sans nom, jamais de balayage)
      </label>
      <form className="rs-edit" onSubmit={(e) => { e.preventDefault(); void envoyer({ cible_internet: cible.trim() }, 'cible enregistrée') }}>
        <input type="text" value={cible} placeholder={etat.cible_internet_defaut} aria-label="cible de ping internet" onChange={(e) => setCible(e.target.value)} />
        <Btn sm onClick={() => void envoyer({ cible_internet: cible.trim() }, 'cible enregistrée')} disabled={cible.trim() === r.cible_internet}>enregistrer</Btn>
      </form>
      <p className="rs-note">Cible du ping « internet » (nom d’hôte ou adresse). Vide : valeur par défaut ({etat.cible_internet_defaut}), réglable côté API par RESEAU_CIBLE_INTERNET.</p>
    </Card>
  )
}
