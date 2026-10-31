import { useState } from 'react'
import { apiGet } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { vuIl, type Tailnet as Etat } from '../../lib/reseau'
import { Card, Chip, Dot, Loader } from '../ui'

export function Tailnet() {
  const t = usePoll<Etat>(() => apiGet('/reseau/tailnet'), 30000)
  const [ips, setIps] = useState(false)
  const d = t.data
  const lite = !d ? 'relevé…' : d.etat === 'indisponible' ? 'indisponible' : `${d.en_ligne}/${d.pairs.length} en ligne`
  return (
    <Card title="tailnet" lite={lite}>
      {!d && !t.error && <Loader label="lecture de tailscale" />}
      {t.error && !d && <Chip tone="crit">API injoignable : {t.error}</Chip>}
      {d?.etat === 'indisponible' && <p className="rs-note">Tailscale ne répond pas (non installé, arrêté ou sans droits).</p>}
      {d && d.etat !== 'indisponible' && (
        <>
          <div className="rs-filtres">
            <span className="rs-note">{d.nom || 'tailnet'} · état {d.etat}</span>
            <label className="rs-filtre"><input type="checkbox" checked={ips} onChange={() => setIps(!ips)} /> afficher les adresses</label>
          </div>
          {d.pairs.map((p) => (
            <div key={p.nom + p.ips[0]} className={`rs-ligne ${p.en_ligne ? '' : 'absent'}`}>
              <Dot s={p.en_ligne ? 'ok' : 'off'} />
              <div className="rs-qui">
                <b>{p.nom}</b>
                {p.soi && <Chip tone="gold">cette machine</Chip>}
                {p.sortie && <Chip>sortie internet</Chip>}
                {p.en_ligne && !p.soi && <Chip tone={p.direct ? 'ok' : 'warn'}>{p.direct ? 'direct' : p.relais ? `relais ${p.relais}` : 'relayé'}</Chip>}
                <small>{p.os || '—'}{ips && p.ips.length ? ` · ${p.ips.join(' · ')}` : ''}</small>
              </div>
              <span className="rs-vu">{p.en_ligne ? 'en ligne' : vuIl(p.derniere_vue)}</span>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}
