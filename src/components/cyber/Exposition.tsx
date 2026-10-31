import { useState } from 'react'
import { apiPut } from '../../lib/api'
import { toast } from '../../lib/dialog'
import type { ReglagesCyber } from '../../lib/cyber'
import { Btn, Card } from '../ui'
import './cyber.css'

// Adresse publique à surveiller (Shodan, GreyNoise) : jamais en dur, saisie ici et gardée côté API.
// Les clés SHODAN_API_KEY / GREYNOISE_API_KEY se règlent dans l'environnement de l'API, pas ici.
export function Exposition({ reglages, onSaved }: { reglages: ReglagesCyber; onSaved: () => void }) {
  const [ip, setIp] = useState(reglages.ip_publique)
  const [ports, setPorts] = useState(reglages.ports_attendus.join(', '))
  const enregistrer = async () => {
    const liste = ports.split(/[,;\s]+/).filter(Boolean).map(Number)
    try { await apiPut('/cyber/reglages', { ip_publique: ip.trim(), ports_attendus: liste }); toast('adresse enregistrée'); onSaved() } catch (e) { toast((e as Error).message, 'crit') }
  }
  return (
    <Card title="exposition de ton adresse" lite="shodan & greynoise">
      <p className="cy-note">Sans adresse publique ou sans clé dans l'environnement de l'API (SHODAN_API_KEY, GREYNOISE_API_KEY), ces deux sources restent désactivées. Les ports attendus ne déclenchent aucun avis.</p>
      <div className="cy-form">
        <label>adresse ip publique<input type="text" value={ip} placeholder="ex. l’adresse vue par internet" onChange={(e) => setIp(e.target.value)} /></label>
        <label>ports attendus<input type="text" value={ports} placeholder="ex. les ports que tu ouvres, séparés par des virgules" onChange={(e) => setPorts(e.target.value)} /></label>
      </div>
      <div style={{ marginTop: 10 }}><Btn sm onClick={() => void enregistrer()}>enregistrer</Btn></div>
    </Card>
  )
}
