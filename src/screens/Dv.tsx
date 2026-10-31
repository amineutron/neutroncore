import { useState } from 'react'
import { apiGet } from '../lib/api'
import { DAYS_CHOICES, DAYS_KEY, readChoice, saveChoice, type DvOverview } from '../lib/dv'
import { usePoll } from '../lib/poll'
import { Chip, Loader, PageTitle } from '../components/ui'
import { DvCurrent } from '../components/dv/DvCurrent'
import { DvFailures } from '../components/dv/DvFailures'
import { DvHistory, DvStatsStrip } from '../components/dv/DvHistory'

// Suivi des conversions Dolby Vision (media-server/scripts/dv_convert.py), en lecture seule :
// sessions « movie » du tracking pour le direct, journal du pipeline pour l'historique et les échecs.
export function Dv() {
  const [days, setDays] = useState<number>(() => readChoice(DAYS_KEY, DAYS_CHOICES, 30))
  // 5 s tant qu'une conversion tourne ; le polling reste gaté par la visibilité (usePoll)
  const dv = usePoll<DvOverview>(() => apiGet(`/dv?jours=${days}`), 5000)
  const pickDays = (d: number) => { setDays(d); saveChoice(DAYS_KEY, d); setTimeout(dv.refresh, 0) }
  const d = dv.data

  return (
    <>
      <PageTitle help="dv" title="conversions dv"
        desc="Le pipeline Dolby Vision (P4 et P7 vers P8, P5 vers HDR10) : ce qui tourne, l'historique, les échecs et leur cause." />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {d && !d.tracking_ok && <Chip tone="warn">suivi en direct injoignable (tracking)</Chip>}
        {d && !d.journal_ok && <Chip tone="warn">journal du pipeline introuvable</Chip>}
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>échecs sur</span>
        {DAYS_CHOICES.map((n) => <button key={n} className={`chip ${days === n ? 'on' : ''}`} onClick={() => pickDays(n)}>{n} j</button>)}
      </div>
      {dv.error && !d && <Chip tone="crit">conversions indisponibles : {dv.error}</Chip>}
      {!d && !dv.error && <Loader />}
      {d && (
        <div style={{ display: 'grid', gap: 14 }}>
          <DvCurrent current={d.current} queue={d.queue} />
          <DvFailures items={d.failures} days={days} onDone={dv.refresh} />
          <DvHistory items={d.history} />
          <DvStatsStrip stats={d.stats} />
        </div>
      )}
    </>
  )
}
