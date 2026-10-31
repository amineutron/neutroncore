import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import type { EtatReseau } from '../lib/reseau'
import { Appareils } from '../components/reseau/Appareils'
import { Liens } from '../components/reseau/Liens'
import { Reglages } from '../components/reseau/Reglages'
import { Tailnet } from '../components/reseau/Tailnet'
import { Chip, Loader, PageTitle } from '../components/ui'
import '../components/reseau/reseau.css'

export function Reseau() {
  const etat = usePoll<EtatReseau>(() => apiGet('/reseau'), 15000)
  const d = etat.data
  return (
    <>
      <PageTitle help="reseau" title="réseau" desc="Qui est sur ton réseau, l’état du tailnet, le débit et la latence. Un appareil inconnu qui apparaît te prévient dans les notifications." />
      {etat.error && !d && <Chip tone="crit">API injoignable : {etat.error}</Chip>}
      {!d && !etat.error && <Loader label="lecture du réseau" />}
      <div className="grid rs-grille">
        <Liens />
        <Tailnet />
      </div>
      {d && (
        <div className="grid rs-grille" style={{ marginTop: 14 }}>
          <Appareils etat={d} relire={etat.refresh} />
          <Reglages etat={d} relire={etat.refresh} />
        </div>
      )}
    </>
  )
}
